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

	// Any other lane that was also waiting for this commit (a merge into it)
	// ends here. Collect them so we can draw their edges converging on us.
	// We do this by scanning after the main lane is settled.
	before := make([]lane, len(l.active))
	copy(before, l.active)

	// Build the next row's lane list.
	next := make([]lane, 0, len(l.active)+len(parents))
	type pending struct {
		from, to, color int
	}
	var segs []pending

	// Map from parent hash to the lane index it has in `next` (so a second
	// lane wanting the same parent merges into it).
	nextIndexOf := func(h string) int {
		for i, ln := range next {
			if ln.waitingFor == h {
				return i
			}
		}
		return -1
	}

	for i, ln := range before {
		switch {
		case i == idx:
			// The commit's own lane continues to its first parent, keeping
			// the color. Extra parents branch off.
			if len(parents) == 0 {
				continue // root commit, lane closes
			}
			first := parents[0]
			if j := nextIndexOf(first); j >= 0 {
				segs = append(segs, pending{i, j, color})
			} else {
				next = append(next, lane{waitingFor: first, color: color})
				segs = append(segs, pending{i, len(next) - 1, color})
			}
		case ln.waitingFor == hash:
			// Another lane also wanted this commit: it merges into us and ends.
			segs = append(segs, pending{i, -1, ln.color})
		default:
			// Pass-through lane.
			if j := nextIndexOf(ln.waitingFor); j >= 0 {
				segs = append(segs, pending{i, j, ln.color})
			} else {
				next = append(next, ln)
				segs = append(segs, pending{i, len(next) - 1, ln.color})
			}
		}
	}
	for _, p := range parents[min(1, len(parents)):] {
		if j := nextIndexOf(p); j >= 0 {
			segs = append(segs, pending{idx, j, next[j].color})
		} else {
			next = append(next, lane{waitingFor: p, color: l.color()})
			segs = append(segs, pending{idx, len(next) - 1, next[len(next)-1].color})
		}
	}

	row := Row{Lane: idx, Color: color, Lanes: max(len(before), len(next)), Segments: make([]Segment, 0, len(segs))}
	for _, s := range segs {
		if s.to < 0 {
			// Converging edge: draw it as landing on our lane in this row.
			row.Segments = append(row.Segments, Segment{From: s.from, To: idx, Color: s.color})
			continue
		}
		row.Segments = append(row.Segments, Segment{From: s.from, To: s.to, Color: s.color})
	}
	l.active = next
	return row
}
