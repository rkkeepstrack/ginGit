package changes

import (
	"context"
	"errors"
	"testing"

	"ginGit/internal/gitcmd"
	"ginGit/internal/gittest"
	"ginGit/internal/history"
)

func index(t *testing.T, r *gittest.Repo) *history.Index {
	t.Helper()
	ix := history.NewIndex()
	if _, err := history.Load(context.Background(), r.Path, history.Options{All: true}, ix.Append); err != nil {
		t.Fatal(err)
	}
	return ix
}

func files(cs *ChangeSet) map[string]FileChange {
	m := map[string]FileChange{}
	for _, f := range cs.Files {
		m[f.Path] = f
	}
	return m
}

// Builds: c1 add a,b | c2 modify a | c3 rename b->c, modify a | c4 delete a, add d
func linearRepo(t *testing.T) *gittest.Repo {
	r := gittest.New(t)
	r.Write("a.txt", "a1\na2\n")
	r.Write("b.txt", "b1\nb2\nb3\nb4\nb5\nb6\n")
	r.Commit("c1")
	r.Write("a.txt", "a1\na2\na3\n")
	r.Commit("c2")
	r.Rename("b.txt", "dir/c.txt")
	r.Write("a.txt", "a1\na2\na3\na4\n")
	r.Commit("c3")
	r.Remove("a.txt")
	r.Write("d.txt", "d\n")
	r.Commit("c4")
	return r
}

func TestSingleCommit(t *testing.T) {
	r := linearRepo(t)
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("c3")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	f := files(cs)
	if len(f) != 2 {
		t.Fatalf("want 2 files, got %+v", cs.Files)
	}
	if c := f["dir/c.txt"]; c.Type != "renamed" || c.OldPath != "b.txt" || c.Additions != 0 {
		t.Errorf("rename: %+v", c)
	}
	if a := f["a.txt"]; a.Type != "modified" || a.Additions != 1 || a.Deletions != 0 || !a.Composable {
		t.Errorf("modify: %+v", a)
	}
	if !cs.Contiguous {
		t.Error("single commit is contiguous")
	}
}

func TestRootCommitDiffsAgainstEmptyTree(t *testing.T) {
	r := linearRepo(t)
	ix := index(t, r)
	for _, mode := range []Mode{Aggregate, Range} {
		cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("c1")}, mode)
		if err != nil {
			t.Fatal(err)
		}
		f := files(cs)
		if f["a.txt"].Type != "added" || f["b.txt"].Type != "added" || f["b.txt"].Additions != 6 {
			t.Errorf("%s: %+v", mode, cs.Files)
		}
		if mode == Range && cs.RangeBase != gitcmd.EmptyTree {
			t.Errorf("range base %s", cs.RangeBase)
		}
	}
}

func TestRangeVsAggregateOnContiguousChain(t *testing.T) {
	r := linearRepo(t)
	ix := index(t, r)
	sel := []string{r.H("c2"), r.H("c4"), r.H("c3")} // deliberately unordered

	rng, err := Compute(context.Background(), r.Path, ix, sel, Range)
	if err != nil {
		t.Fatal(err)
	}
	if rng.Hashes[0] != r.H("c4") || rng.Hashes[2] != r.H("c2") || rng.RangeBase != r.H("c1") {
		t.Errorf("ordering/base: %+v", rng.Hashes)
	}
	rf := files(rng)
	// Snapshot c1..c4: a deleted, b renamed to dir/c, d added. 3 files.
	if len(rf) != 3 || rf["a.txt"].Type != "deleted" || rf["dir/c.txt"].Type != "renamed" || rf["d.txt"].Type != "added" {
		t.Errorf("range files: %+v", rng.Files)
	}
	if rf["a.txt"].Deletions != 2 { // net: the original two lines vanish
		t.Errorf("range a.txt deletions %d", rf["a.txt"].Deletions)
	}

	agg, err := Compute(context.Background(), r.Path, ix, sel, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	af := files(agg)
	a := af["a.txt"]
	if a.Type != "deleted" || len(a.Touches) != 3 || !a.Composable {
		t.Errorf("aggregate a.txt: %+v", a)
	}
	// c2 +1, c3 +1, c4 -4 → summed over the individual commits
	if a.Additions != 2 || a.Deletions != 4 {
		t.Errorf("aggregate a.txt stats +%d -%d", a.Additions, a.Deletions)
	}
	if a.Touches[0].Commit != r.H("c4") || a.Touches[2].Commit != r.H("c2") {
		t.Errorf("touch order: %+v", a.Touches)
	}
	if !agg.Contiguous {
		t.Error("aggregate should still report the selection as contiguous")
	}
}

func TestRangeRefusesGap(t *testing.T) {
	r := linearRepo(t)
	ix := index(t, r)
	_, err := Compute(context.Background(), r.Path, ix, []string{r.H("c2"), r.H("c4")}, Range)
	if !errors.Is(err, ErrNotContiguous) {
		t.Fatalf("want ErrNotContiguous, got %v", err)
	}
}

func TestAggregateWithGapMarksNonConsecutive(t *testing.T) {
	r := linearRepo(t)
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("c2"), r.H("c4")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	if cs.Contiguous {
		t.Error("gap selection must not be contiguous")
	}
	a := files(cs)["a.txt"]
	if a.Composable || len(a.Touches) != 2 || a.Type != "deleted" {
		t.Errorf("a.txt: %+v", a)
	}
	if d := files(cs)["d.txt"]; !d.Composable || d.Type != "added" {
		t.Errorf("single-touch file must be composable: %+v", d)
	}
}

func TestRenameThenModifyKeysByFinalPath(t *testing.T) {
	r := linearRepo(t)
	r.Write("dir/c.txt", "b1\nb2\nb3\nb4\nb5\nb6\nb7\n")
	r.Commit("c5")
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("c3"), r.H("c5")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	f := files(cs)
	if _, ok := f["b.txt"]; ok {
		t.Error("old path must not survive as its own entry")
	}
	c := f["dir/c.txt"]
	if c.Type != "renamed" || c.OldPath != "b.txt" || len(c.Touches) != 2 || c.Additions != 1 {
		t.Errorf("%+v", c)
	}
}

func TestModifyThenRenameCarriesTouchesForward(t *testing.T) {
	r := gittest.New(t)
	r.Write("x.txt", "1\n2\n3\n4\n5\n")
	r.Commit("c1")
	r.Write("x.txt", "1\n2\n3\n4\n5\n6\n")
	r.Commit("c2")
	r.Rename("x.txt", "y.txt")
	r.Commit("c3")
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("c2"), r.H("c3")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	if len(cs.Files) != 1 {
		t.Fatalf("want one entry, got %+v", cs.Files)
	}
	y := cs.Files[0]
	if y.Path != "y.txt" || y.OldPath != "x.txt" || y.Type != "renamed" || len(y.Touches) != 2 || y.Additions != 1 {
		t.Errorf("%+v", y)
	}
}

func TestAddedThenDeletedIsDeleted(t *testing.T) {
	r := gittest.New(t)
	r.Write("keep", "k")
	r.Commit("c0")
	r.Write("tmp.txt", "t\n")
	r.Commit("c1")
	r.Remove("tmp.txt")
	r.Commit("c2")
	ix := index(t, r)
	cs, _ := Compute(context.Background(), r.Path, ix, []string{r.H("c1"), r.H("c2")}, Aggregate)
	if f := files(cs)["tmp.txt"]; f.Type != "deleted" {
		t.Errorf("%+v", f)
	}
	rng, _ := Compute(context.Background(), r.Path, ix, []string{r.H("c1"), r.H("c2")}, Range)
	if len(rng.Files) != 0 {
		t.Errorf("range of add+delete should be empty, got %+v", rng.Files)
	}
}

func TestMergeDiffsAgainstFirstParent(t *testing.T) {
	r := gittest.New(t)
	r.Write("base", "b\n")
	r.Commit("root")
	r.Branch("feature")
	r.Write("feat.txt", "f\n")
	r.Commit("feat")
	r.Checkout("main")
	r.Write("main.txt", "m\n")
	r.Commit("main1")
	r.Merge("merge", "feature")
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("merge")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	if len(cs.Merges) != 1 || cs.Merges[0] != r.H("merge") {
		t.Errorf("merges: %v", cs.Merges)
	}
	f := files(cs)
	if len(f) != 1 || f["feat.txt"].Type != "added" {
		t.Errorf("merge vs first parent should only show feat.txt: %+v", cs.Files)
	}
	// merge + main1 is a first-parent chain, so range works and equals the snapshot
	rng, err := Compute(context.Background(), r.Path, ix, []string{r.H("merge"), r.H("main1")}, Range)
	if err != nil {
		t.Fatal(err)
	}
	if len(rng.Files) != 2 {
		t.Errorf("range root..merge: %+v", rng.Files)
	}
	// merge + feat is not a first-parent chain
	if _, err := Compute(context.Background(), r.Path, ix, []string{r.H("merge"), r.H("feat")}, Range); !errors.Is(err, ErrNotContiguous) {
		t.Errorf("merge+feat should not be a range, got %v", err)
	}
}

func TestCherryPickIsNeverConsecutive(t *testing.T) {
	r := gittest.New(t)
	r.Write("f.txt", "1\n2\n3\n")
	r.Commit("root")
	r.Branch("feature")
	r.Write("f.txt", "1\n2\n3\n4\n")
	r.Commit("orig")
	r.Checkout("main")
	r.Write("other.txt", "o\n")
	r.Commit("main1")
	r.CherryPick("pick", r.H("orig"))
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("orig"), r.H("pick")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	f := files(cs)["f.txt"]
	if len(f.Touches) != 2 || f.Composable || f.Additions != 2 {
		t.Errorf("%+v", f)
	}
}

func TestBinaryFile(t *testing.T) {
	r := gittest.New(t)
	r.Write("img.bin", "\x00\x01\x02\xff")
	r.Commit("c1")
	ix := index(t, r)
	cs, err := Compute(context.Background(), r.Path, ix, []string{r.H("c1")}, Aggregate)
	if err != nil {
		t.Fatal(err)
	}
	if f := files(cs)["img.bin"]; !f.Binary || f.Type != "added" {
		t.Errorf("%+v", f)
	}
}

func TestRejectsBadHash(t *testing.T) {
	r := linearRepo(t)
	ix := index(t, r)
	if _, err := Compute(context.Background(), r.Path, ix, []string{"HEAD"}, Aggregate); !errors.Is(err, gitcmd.ErrInvalidArg) {
		t.Errorf("got %v", err)
	}
}
