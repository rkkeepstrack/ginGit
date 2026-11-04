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
	"runtime"
	"strings"
	"sync"
	"time"
)

var (
	ErrGitNotFound    = errors.New("git executable not found")
	ErrNotARepository = errors.New("not a git repository")
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
	"cat-file":     true,
	"for-each-ref": true,
	"name-rev":     true,
}

var fullHashRe = regexp.MustCompile(`^[0-9a-f]{40}$`)

// ValidateHash accepts only a full 40-character lowercase hex hash.
func ValidateHash(h string) error {
	if !fullHashRe.MatchString(h) {
		return fmt.Errorf("%w: hash %q", ErrInvalidArg, h)
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
	}
	return err
}

var (
	binaryOnce sync.Once
	binary     = "git"
)

// Binary is the git executable we spawn. On macOS /usr/bin/git is Xcode's
// xcrun shim, which adds about 6ms to every spawn; the real binary behind it
// (or a Homebrew git) is found once.
func Binary() string {
	binaryOnce.Do(func() {
		for _, candidate := range []string{"/opt/homebrew/bin/git", "/usr/local/bin/git"} {
			if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
				binary = candidate
				return
			}
		}
		if runtime.GOOS == "darwin" {
			if out, err := exec.Command("/usr/bin/xcrun", "--find", "git").Output(); err == nil {
				if p := strings.TrimSpace(string(out)); p != "" {
					binary = p
					return
				}
			}
		}
		if p, err := exec.LookPath("git"); err == nil {
			binary = p
		}
	})
	return binary
}

func command(ctx context.Context, repoPath string, args []string) (*exec.Cmd, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("%w: empty argument list", ErrInvalidArg)
	}
	if !allowed[args[0]] {
		return nil, fmt.Errorf("%w: %s", ErrDisallowed, args[0])
	}
	full := append([]string{"-c", "core.quotepath=off", "-c", "color.ui=never"}, args...)
	cmd := exec.CommandContext(ctx, Binary(), full...)
	cmd.Dir = repoPath
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "LC_ALL=C", "GIT_OPTIONAL_LOCKS=0")
	return cmd, nil
}

// Run executes git and returns stdout. Stderr is attached to the error.
func Run(ctx context.Context, repoPath string, args ...string) ([]byte, error) {
	return RunInput(ctx, repoPath, nil, args...)
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
	if stdin != nil {
		cmd.Stdin = bytes.NewReader(stdin)
	}
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		// A killed process reports "signal: killed"; the context knows why.
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
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
