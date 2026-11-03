// Package gitcmd is the only place in ginGit that executes git. Every call
// goes through an argument list (never a shell), a subcommand allowlist and a
// context with a timeout. The allowlist is read-only by construction.
package gitcmd

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

var (
	ErrGitNotFound    = errors.New("git executable not found")
	ErrNotARepository = errors.New("not a git repository")
	ErrTimeout        = errors.New("git command timed out")
	ErrObjectNotFound = errors.New("git object not found")
	ErrInvalidArg     = errors.New("invalid argument")
	ErrDisallowed     = errors.New("git subcommand not allowed")
)

// DefaultTimeout is generous because a cold `git log` on a huge repository is
// legitimately slow; callers streaming output cancel through their context.
const DefaultTimeout = 2 * time.Minute

var allowed = map[string]bool{
	"rev-parse":    true,
	"log":          true,
	"rev-list":     true,
	"diff-tree":    true,
	"diff":         true,
	"cat-file":     true,
	"show-ref":     true,
	"for-each-ref": true,
	"status":       true,
	"ls-tree":      true,
}

var (
	fullHashRe   = regexp.MustCompile(`^[0-9a-f]{40}$`)
	prefixHashRe = regexp.MustCompile(`^[0-9a-f]{4,40}$`)
)

// EmptyTree is the hash of the empty tree, used as the parent of root commits.
const EmptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

// ValidateHash accepts only a full 40-character lowercase hex hash.
func ValidateHash(h string) error {
	if !fullHashRe.MatchString(h) {
		return fmt.Errorf("%w: hash %q", ErrInvalidArg, h)
	}
	return nil
}

// ValidateHashPrefix accepts a user-typed abbreviated hash.
func ValidateHashPrefix(h string) error {
	if !prefixHashRe.MatchString(h) {
		return fmt.Errorf("%w: hash prefix %q", ErrInvalidArg, h)
	}
	return nil
}

// ValidatePath rejects anything git could mistake for an option or that
// escapes the repository. Paths are always passed after "--" too; this is
// belt and braces.
func ValidatePath(p string) error {
	if p == "" || strings.HasPrefix(p, "-") || strings.Contains(p, "\x00") {
		return fmt.Errorf("%w: path %q", ErrInvalidArg, p)
	}
	if strings.HasPrefix(p, "/") || strings.HasPrefix(p, "../") || strings.Contains(p, "/../") || p == ".." {
		return fmt.Errorf("%w: path %q", ErrInvalidArg, p)
	}
	return nil
}

// Error carries git's stderr so the UI can show something useful.
type Error struct {
	Args   []string
	Stderr string
	Err    error
}

func (e *Error) Error() string {
	return fmt.Sprintf("git %s: %v: %s", strings.Join(e.Args, " "), e.Err, strings.TrimSpace(e.Stderr))
}

func (e *Error) Unwrap() error { return e.Err }

func classify(stderr string, err error) error {
	s := strings.ToLower(stderr)
	switch {
	case strings.Contains(s, "not a git repository"):
		return ErrNotARepository
	case strings.Contains(s, "bad object"), strings.Contains(s, "unknown revision"),
		strings.Contains(s, "does not exist"), strings.Contains(s, "not a valid object name"):
		return ErrObjectNotFound
	case errors.Is(err, context.DeadlineExceeded):
		return ErrTimeout
	}
	return err
}

func command(ctx context.Context, repoPath string, args []string) (*exec.Cmd, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("%w: empty argument list", ErrInvalidArg)
	}
	if !allowed[args[0]] {
		return nil, fmt.Errorf("%w: %s", ErrDisallowed, args[0])
	}
	full := append([]string{"-c", "core.quotepath=off", "-c", "color.ui=never"}, args...)
	cmd := exec.CommandContext(ctx, "git", full...)
	cmd.Dir = repoPath
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "LC_ALL=C", "GIT_OPTIONAL_LOCKS=0")
	return cmd, nil
}

// Run executes git and returns stdout. Stderr is attached to the error.
func Run(ctx context.Context, repoPath string, args ...string) ([]byte, error) {
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, DefaultTimeout)
		defer cancel()
	}
	cmd, err := command(ctx, repoPath, args)
	if err != nil {
		return nil, err
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, ErrGitNotFound
		}
		return nil, &Error{Args: args, Stderr: stderr.String(), Err: classify(stderr.String(), err)}
	}
	return stdout.Bytes(), nil
}

// Stream starts git and returns its stdout for incremental reading. The caller
// must call wait() once the reader is drained (or the context is cancelled) to
// reap the process and learn whether it failed.
func Stream(ctx context.Context, repoPath string, args ...string) (io.ReadCloser, func() error, error) {
	cmd, err := command(ctx, repoPath, args)
	if err != nil {
		return nil, nil, err
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	if err := cmd.Start(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, nil, ErrGitNotFound
		}
		return nil, nil, err
	}
	wait := func() error {
		if err := cmd.Wait(); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return &Error{Args: args, Stderr: stderr.String(), Err: classify(stderr.String(), err)}
		}
		return nil
	}
	return stdout, wait, nil
}

// Version reports the installed git version, mostly to fail early and clearly.
func Version(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "--version")
	out, err := cmd.Output()
	if err != nil {
		return "", ErrGitNotFound
	}
	return strings.TrimSpace(string(out)), nil
}

// RunInput is Run with data on stdin, for `cat-file --batch`.
func RunInput(ctx context.Context, repoPath string, stdin []byte, args ...string) ([]byte, error) {
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, DefaultTimeout)
		defer cancel()
	}
	cmd, err := command(ctx, repoPath, args)
	if err != nil {
		return nil, err
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdin = bytes.NewReader(stdin)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return nil, ErrGitNotFound
		}
		return nil, &Error{Args: args, Stderr: stderr.String(), Err: classify(stderr.String(), err)}
	}
	return stdout.Bytes(), nil
}
