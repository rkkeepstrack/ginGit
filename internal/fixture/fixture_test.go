// Package fixture writes the JSON the snapshot tests feed to the frontend's
// mock bridge. It scripts a small repository and runs the real packages over
// it, so the screenshots show what the backend actually produces.
//
//	GINGIT_FIXTURE_OUT=../../frontend/e2e/fixture.json go test ./internal/fixture
package fixture

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"ginGit/internal/changes"
	"ginGit/internal/diff"
	"ginGit/internal/gittest"
	"ginGit/internal/history"
	"ginGit/internal/repo"
)

type Fixture struct {
	Repo     repo.Info                     `json:"repo"`
	Refs     []repo.Ref                    `json:"refs"`
	Commits  []history.Commit              `json:"commits"`
	Changes  map[string]*changes.ChangeSet `json:"changes"` // key: changes.Key of the selection
	Diffs    map[string]*diff.Result       `json:"diffs"`   // key: changes.Key + "|" + path
	Branches map[string][]string           `json:"branches"`
	Names    map[string]string             `json:"names"`
	Labels   map[string]string             `json:"labels"` // label -> hash, so tests can pick commits by name
}

// script builds a history with everything the UI renders differently:
// a feature branch and merge, a rename, a deletion, a binary, a tag, a
// stacked branch, and a file touched twice with a gap between.
func script(t *testing.T) *gittest.Repo {
	r := gittest.New(t)
	r.Write("README.md", "# demo\n\nA small repository for screenshots.\n")
	r.Write("src/app.ts", "export function main() {\n  console.log('hello')\n}\n")
	r.Write("package.json", "{\n  \"name\": \"demo\",\n  \"version\": \"1.0.0\"\n}\n")
	r.Commit("chore: initial import")

	r.Branch("feature/login")
	r.Write("src/login.ts", "export function login(user: string) {\n  return user.length > 0\n}\n")
	r.Write("src/app.ts", "import { login } from './login'\n\nexport function main() {\n  console.log('hello', login('ada'))\n}\n")
	r.Commit("feat(LD-1): login helper and wire it into main")
	r.Write("src/login.ts", "export function login(user: string, password: string) {\n  if (!password) return false\n  return user.length > 0\n}\n")
	r.Commit("fix(LD-1): a login needs a password")

	r.Checkout("main")
	r.Write("README.md", "# demo\n\nA small repository for screenshots.\n\n## Usage\n\nRun it.\n")
	r.Write("CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\n- first release\n- nothing else yet\n")
	r.Commit("docs: usage section")
	r.Rename("src/app.ts", "src/main.ts")
	r.Write("assets/logo.png", "\x89PNG\r\n\x1a\n\x00\x00binary")
	r.Commit("refactor: app.ts becomes main.ts, logo lands")
	r.Merge("Merge branch 'feature/login'", "feature/login")
	r.Git("tag", "v1.0.0")

	r.Write("package.json", "{\n  \"name\": \"demo\",\n  \"version\": \"1.1.0\",\n  \"dependencies\": {\n    \"left-pad\": \"^1.3.0\"\n  }\n}\n")
	r.Commit("chore(LD-2): depend on left-pad, as one does")
	r.Remove("assets/logo.png")
	r.Remove("CHANGELOG.md")
	r.Commit("chore: logo was a mistake")
	r.Write("README.md", "# demo\n\nA small repository for screenshots.\n\n## Usage\n\nRun it. Then run it again.\n")
	r.Commit("docs: more usage")

	r.Branch("feature/stack-base")
	r.Write("src/base.ts", "export const base = 1\n")
	r.Commit("feat(LD-3): base of the stack")
	r.Branch("feature/stack-top")
	r.Write("src/top.ts", "import { base } from './base'\nexport const top = base + 1\n")
	r.Commit("feat(LD-3): top of the stack")
	r.Checkout("main")
	return r
}

func TestGenerate(t *testing.T) {
	out := os.Getenv("GINGIT_FIXTURE_OUT")
	if out == "" {
		t.Skip("set GINGIT_FIXTURE_OUT to write the fixture")
	}
	ctx := context.Background()
	r := script(t)
	info, err := repo.Open(ctx, r.Path)
	if err != nil {
		t.Fatal(err)
	}
	info.Path = "/home/demo/repos/demo"
	info.Name = "demo"
	refs, err := repo.Refs(ctx, r.Path)
	if err != nil {
		t.Fatal(err)
	}
	ix := history.NewIndex()
	fx := Fixture{Repo: info, Refs: refs, Changes: map[string]*changes.ChangeSet{}, Diffs: map[string]*diff.Result{}, Branches: map[string][]string{}, Labels: r.Hashes}
	if _, err := history.Load(ctx, r.Path, history.Options{ChunkSize: 1000}, func(cs []history.Commit) {
		ix.Append(cs)
		fx.Commits = append(fx.Commits, cs...)
	}); err != nil {
		t.Fatal(err)
	}

	// Every single commit, plus the selections the specs make.
	var selections [][]string
	for _, c := range fx.Commits {
		selections = append(selections, []string{c.Hash})
	}
	selections = append(selections,
		[]string{r.H("docs: more usage"), r.H("chore: logo was a mistake"), r.H("chore(LD-2): depend on left-pad, as one does")},
		[]string{r.H("docs: more usage"), r.H("chore: initial import")}, // README twice with "usage section" in between: stacked diff
	)
	var tips []history.RefTip
	for _, ref := range refs {
		tips = append(tips, history.RefTip{Full: ref.Full, Hash: ref.Hash, Tag: ref.Kind == "tag"})
	}
	for _, ref := range refs {
		hashes, _ := ix.BranchCommits(tips, ref.Full)
		fx.Branches[ref.Full] = hashes
		if len(hashes) > 0 {
			selections = append(selections, hashes)
		}
	}
	var all []string
	for _, c := range fx.Commits {
		all = append(all, c.Hash)
	}
	if fx.Names, err = repo.NameCommits(ctx, r.Path, all); err != nil {
		t.Fatal(err)
	}
	blobs := diff.NewCache(64 << 20)
	for _, sel := range selections {
		key := changes.Key(sel)
		if _, done := fx.Changes[key]; done {
			continue
		}
		cs, err := changes.Compute(ctx, r.Path, ix, sel)
		if err != nil {
			t.Fatal(err)
		}
		fx.Changes[key] = cs
		for _, fc := range cs.Files {
			res, err := diff.ForFile(ctx, r.Path, fc, blobs)
			if err != nil {
				t.Fatal(err)
			}
			fx.Diffs[key+"|"+fc.Path] = res
		}
	}
	data, err := json.MarshalIndent(fx, "", " ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(out, data, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Logf("wrote %s: %d commits, %d change sets, %d diffs", out, len(fx.Commits), len(fx.Changes), len(fx.Diffs))
}
