.PHONY: check test build dev bindings fixture snapshots snapshots-update site-shots

# Pinned to the same version as @playwright/test in frontend/package.json;
# the image carries the matching Chromium and fonts.
PLAYWRIGHT_IMAGE = mcr.microsoft.com/playwright:v1.58.2-noble
SNAPSHOT_RUN = docker run --rm -t \
	-v $(CURDIR)/frontend:/work \
	-v gingit-e2e-node-modules:/work/node_modules \
	-w /work -e CI=$(CI) $(PLAYWRIGHT_IMAGE) \
	sh -c "npm ci --no-audit --no-fund && npm run build && npx playwright test

check: bindings
	go vet ./...
	go test ./...
	cd frontend && npm run check

test:
	go test ./...

bindings:
	wails generate module

dev:
	wails dev

build: bindings
	wails build -clean

# Regenerates frontend/e2e/fixture.json from the scripted repository.
fixture:
	GINGIT_FIXTURE_OUT=$(CURDIR)/frontend/e2e/fixture.json go test ./internal/fixture -run TestGenerate

# Visual snapshots, always inside the Playwright container so local and CI pixels agree.
snapshots:
	$(SNAPSHOT_RUN)"

snapshots-update:
	$(SNAPSHOT_RUN) --update-snapshots=all"

# The site's screenshots, light and dark, from the same fixture and container.
site-shots:
	$(SNAPSHOT_RUN) --config playwright.site.ts"
	cp frontend/e2e/site-shots/*.png site/img/
