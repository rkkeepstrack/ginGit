package gitcmd

import (
	"context"
	"errors"
	"testing"
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

func TestValidatePath(t *testing.T) {
	for _, ok := range []string{"a.go", "dir/sub/file.ts", "weird name.txt", "not-dash/..dots"} {
		if err := ValidatePath(ok); err != nil {
			t.Errorf("%q: unexpected %v", ok, err)
		}
	}
	for _, bad := range []string{"", "-rf", "--output=x", "/etc/passwd", "../x", "a/../../b", ".."} {
		if err := ValidatePath(bad); !errors.Is(err, ErrInvalidArg) {
			t.Errorf("%q: want ErrInvalidArg, got %v", bad, err)
		}
	}
}

func TestDisallowedSubcommand(t *testing.T) {
	for _, sub := range []string{"push", "commit", "reset", "checkout", "gc"} {
		_, err := Run(context.Background(), t.TempDir(), sub)
		if !errors.Is(err, ErrDisallowed) {
			t.Errorf("%s: want ErrDisallowed, got %v", sub, err)
		}
	}
}

func TestNotARepository(t *testing.T) {
	_, err := Run(context.Background(), t.TempDir(), "rev-parse", "--show-toplevel")
	if !errors.Is(err, ErrNotARepository) {
		t.Fatalf("want ErrNotARepository, got %v", err)
	}
}
