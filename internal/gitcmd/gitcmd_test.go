package gitcmd

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestValidateHash(t *testing.T) {
	if err := ValidateHash("4b825dc642cb6eb9a060e54bf8d69288fbee4904"); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"", "abc", "HEAD", "4B825DC642CB6EB9A060E54BF8D69288FBEE4904", "--all", "4b825dc642cb6eb9a060e54bf8d69288fbee49040"} {
		if err := ValidateHash(bad); !errors.Is(err, ErrInvalidArg) {
			t.Errorf("%q: want ErrInvalidArg, got %v", bad, err)
		}
	}
}

func TestDisallowedSubcommand(t *testing.T) {
	for _, sub := range []string{"push", "commit", "reset", "checkout", "gc", "status"} {
		_, err := Run(context.Background(), t.TempDir(), sub)
		if !errors.Is(err, ErrDisallowed) {
			t.Errorf("%s: want ErrDisallowed, got %v", sub, err)
		}
	}
}

func TestTimeoutIsReportedAsSuch(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Nanosecond)
	defer cancel()
	_, err := Run(ctx, t.TempDir(), "rev-parse", "--show-toplevel")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("want DeadlineExceeded, got %v", err)
	}
}

func TestNotARepository(t *testing.T) {
	_, err := Run(context.Background(), t.TempDir(), "rev-parse", "--show-toplevel")
	if !errors.Is(err, ErrNotARepository) {
		t.Fatalf("want ErrNotARepository, got %v", err)
	}
}
