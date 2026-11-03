# ginGit

Read-only git history explorer with multi-commit review. Select any number of
commits, get one consolidated file list, click through the diffs.

Wails v2 + Go backend, React + Tailwind + daisyUI frontend, CodeMirror diffs.

    make dev      # hot-reloading dev build
    make build    # build/bin/ginGit.app
    make check    # vet, go tests, tsc, vitest
    make snapshots         # visual snapshots, in the Playwright container
    make snapshots-update  # accept new baselines (frontend/e2e/__snapshots__)
    make fixture           # regenerate frontend/e2e/fixture.json from the scripted repo

Design notes: docs/superpowers/specs/2026-11-03-gingit-design.md
