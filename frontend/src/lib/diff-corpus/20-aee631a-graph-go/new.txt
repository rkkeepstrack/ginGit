// Package graph assigns lanes to commits for the commit graph. It is a pure
// function of the topologically ordered commit list and knows nothing about
// git itself, so it can be tested on hand-built DAGs.
package graph

// Segment is one edge drawn from this row down into the next one.
type Segment struct {
	From  int `json:"from"`  // lane index in this row
	To    int `json:"to"`    // lane index in the next row
	Color int `json:"color"` // color index of the branch the edge belongs to
}

// Row is the layout of one commit.
type Row struct {
	Lane     int       `json:"lane"`
	Color    int       `json:"color"`
	Segments []Segment `json:"segments"`
	// Lanes is the total number of lanes occupied in this row, including the
	// ones only passing through. It sizes the SVG cell.
	Lanes int `json:"lanes"`
}

type lane struct {
	waitingFor string // hash of the commit this lane will land on
	color      int
}

// Layout walks commits in topo order and assigns lanes incrementally. Create
// one per history load and feed it commits as they stream in.
type Layout struct {
	active    []lane
	nextColor int
	// Palette size; lanes cycle through it. 8 matches the CSS variables.
	Colors int
}

func New() *Layout { return &Layout{Colors: 8} }

func (l *Layout) color() int {
	c := l.nextColor % l.Colors
	l.nextColor++
	return c
}

func (l *Layout) find(hash string) int {
	for i, ln := range l.active {
		if ln.waitingFor == hash {
			return i
		}
	}
	return -1
}

// Next places one commit and returns its row. parents are in git order (first
// parent first).
func (l *Layout) Next(hash string, parents []string) Row {
	idx := l.find(hash)
	if idx < 0 {
		l.active = append(l.active, lane{waitingFor: hash, color: l.color()})
		idx = len(l.active) - 1
	}
	color := l.active[idx].color

	// Build the next row's lane list while recording the edges into it.
	next := make([]lane, 0, len(l.active)+len(parents))
	var segs []Segment
	nextIndexOf := func(h string) int {
		for i, ln := range next {
			if ln.waitingFor == h {
				return i
			}
		}
		return -1
	}
	continueTo := func(from int, h string, ln lane) {
		if j := nextIndexOf(h); j >= 0 {
			segs = append(segs, Segment{From: from, To: j, Color: ln.color})
			return
		}
		next = append(next, lane{waitingFor: h, color: ln.color})
		segs = append(segs, Segment{From: from, To: len(next) - 1, Color: ln.color})
	}

	for i, ln := range l.active {
		switch {
		case i == idx:
			// Our lane carries on to the first parent, keeping its color.
			if len(parents) > 0 {
				continueTo(i, parents[0], lane{color: color})
			}
		case ln.waitingFor == hash:
			// Another lane also wanted this commit: it merges into us and ends.
			segs = append(segs, Segment{From: i, To: idx, Color: ln.color})
		default:
			continueTo(i, ln.waitingFor, ln)
		}
	}
	for _, p := range parents[min(1, len(parents)):] {
		if j := nextIndexOf(p); j >= 0 {
			segs = append(segs, Segment{From: idx, To: j, Color: next[j].color})
		} else {
			continueTo(idx, p, lane{color: l.color()})
		}
	}

	row := Row{Lane: idx, Color: color, Lanes: max(len(l.active), len(next)), Segments: segs}
	if row.Segments == nil {
		row.Segments = []Segment{}
	}
	l.active = next
	return row
}
