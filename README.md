# ginGit

Read-only git history explorer with multi-commit review. Select any number of
commits, or a whole branch with one click, get one consolidated file list, and
read every diff as one review.

Site: https://rkkeepstrack.github.io/ginGit/ · Releases: tag `v*` and the
release workflow builds a universal macOS app and a Linux binary.

Wails v2 + Go backend, Svelte 5 + Tailwind + daisyUI frontend, CodeMirror diffs.

    make dev      # hot-reloading dev build
    make build    # build/bin/ginGit.app
    make check    # vet, go tests, tsc, vitest
    make snapshots         # visual snapshots, in the Playwright container
    make snapshots-update  # accept new baselines (frontend/e2e/__snapshots__)
    make fixture           # regenerate frontend/e2e/fixture.json from the scripted repo

Design notes: docs/superpowers/specs/2026-11-03-gingit-design.md
