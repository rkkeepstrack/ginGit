.PHONY: check test build dev bindings

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
