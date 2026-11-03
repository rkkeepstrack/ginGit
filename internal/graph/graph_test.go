package graph

import (
	"reflect"
	"testing"
)

type c struct {
	h string
	p []string
}

func run(commits []c) []Row {
	l := New()
	rows := make([]Row, 0, len(commits))
	for _, cm := range commits {
		rows = append(rows, l.Next(cm.h, cm.p))
	}
	return rows
}

func lanes(rows []Row) []int {
	out := make([]int, len(rows))
	for i, r := range rows {
		out[i] = r.Lane
	}
	return out
}

func TestLinear(t *testing.T) {
	rows := run([]c{{"c", []string{"b"}}, {"b", []string{"a"}}, {"a", nil}})
	if got := lanes(rows); !reflect.DeepEqual(got, []int{0, 0, 0}) {
		t.Fatalf("lanes %v", got)
	}
	for i, r := range rows {
		if r.Color != 0 {
			t.Errorf("row %d color %d", i, r.Color)
		}
	}
	if len(rows[2].Segments) != 0 {
		t.Errorf("root should have no outgoing segments, got %v", rows[2].Segments)
	}
	if rows[0].Lanes != 1 {
		t.Errorf("linear history should occupy one lane, got %d", rows[0].Lanes)
	}
}

// m merges feature f into a; f branched off a.
func TestBranchAndMerge(t *testing.T) {
	rows := run([]c{
		{"m", []string{"b", "f"}},
		{"f", []string{"a"}},
		{"b", []string{"a"}},
		{"a", nil},
	})
	if got := lanes(rows); !reflect.DeepEqual(got, []int{0, 1, 0, 0}) {
		t.Fatalf("lanes %v", got)
	}
	// merge row: edge to first parent in lane 0 and to second parent in lane 1
	want := []Segment{{0, 0, 0}, {0, 1, 1}}
	if !reflect.DeepEqual(rows[0].Segments, want) {
		t.Errorf("merge segments %v, want %v", rows[0].Segments, want)
	}
	// f row: lane 0 passes through waiting for b, f continues to a in lane 1
	if rows[1].Lanes != 2 || rows[1].Color != 1 {
		t.Errorf("feature row lanes=%d color=%d", rows[1].Lanes, rows[1].Color)
	}
	// b row: lane 1 (waiting for a) converges into b's lane? No: both lanes
	// want a. Lane 0 continues to a; lane 1 also wants a so it joins lane 0.
	foundJoin := false
	for _, s := range rows[2].Segments {
		if s.From == 1 && s.To == 0 {
			foundJoin = true
		}
	}
	if !foundJoin {
		t.Errorf("expected lane 1 to join lane 0 at b, got %v", rows[2].Segments)
	}
	if rows[3].Lanes != 1 {
		t.Errorf("root row should be back to one lane, got %d", rows[3].Lanes)
	}
}

func TestOctopus(t *testing.T) {
	rows := run([]c{
		{"m", []string{"a", "x", "y"}},
		{"y", []string{"a"}},
		{"x", []string{"a"}},
		{"a", nil},
	})
	if rows[0].Lanes != 3 {
		t.Fatalf("octopus row should open 3 lanes, got %d", rows[0].Lanes)
	}
	if got := lanes(rows); !reflect.DeepEqual(got, []int{0, 2, 1, 0}) {
		t.Fatalf("lanes %v", got)
	}
}

func TestOrphanRoot(t *testing.T) {
	rows := run([]c{
		{"b", []string{"a"}},
		{"o", nil}, // orphan branch root, unrelated
		{"a", nil},
	})
	if got := lanes(rows); !reflect.DeepEqual(got, []int{0, 1, 0}) {
		t.Fatalf("lanes %v", got)
	}
	if rows[1].Color == rows[0].Color {
		t.Errorf("orphan should get its own color")
	}
}

func TestLongParallelBranchKeepsColor(t *testing.T) {
	// main: d -> c -> a ; feature: f2 -> f1 -> a ; interleaved
	rows := run([]c{
		{"d", []string{"c"}},
		{"f2", []string{"f1"}},
		{"c", []string{"a"}},
		{"f1", []string{"a"}},
		{"a", nil},
	})
	if rows[1].Color != rows[3].Color {
		t.Errorf("feature commits should share a color: %d vs %d", rows[1].Color, rows[3].Color)
	}
	if rows[0].Color != rows[2].Color || rows[0].Color == rows[1].Color {
		t.Errorf("main/feature colors wrong: %v", []int{rows[0].Color, rows[1].Color, rows[2].Color, rows[3].Color})
	}
}

func TestCrissCross(t *testing.T) {
	// two merges each pulling the other side
	rows := run([]c{
		{"m1", []string{"a1", "b1"}},
		{"m2", []string{"b1", "a1"}},
		{"a1", []string{"r"}},
		{"b1", []string{"r"}},
		{"r", nil},
	})
	if rows[4].Lanes != 1 {
		t.Errorf("all lanes should collapse at root, got %d", rows[4].Lanes)
	}
	for i, r := range rows {
		if r.Lane >= r.Lanes {
			t.Errorf("row %d lane %d outside %d lanes", i, r.Lane, r.Lanes)
		}
		for _, s := range r.Segments {
			if s.From < 0 || s.To < 0 {
				t.Errorf("row %d negative segment %v", i, s)
			}
		}
	}
}
