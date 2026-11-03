package history

import (
	"context"
	"os"
	"testing"
	"time"
)

// TestLoadBigRepo times a full load of whatever GINGIT_BENCH_REPO points at.
func TestLoadBigRepo(t *testing.T) {
	root := os.Getenv("GINGIT_BENCH_REPO")
	if root == "" {
		t.Skip("set GINGIT_BENCH_REPO to a large repository")
	}
	start := time.Now()
	var first time.Duration
	n := 0
	total, err := Load(context.Background(), root, Options{ChunkSize: 1000}, func(c []Commit) {
		if n == 0 {
			first = time.Since(start)
		}
		n += len(c)
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("%d commits: first chunk after %v, all after %v", total, first, time.Since(start))
}
