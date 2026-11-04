package main

import (
	"errors"
	"net/http"
	"strings"

	"ginGit/internal/diff"
)

// blobServer answers <img src="/blob/<hash>/<file name>"> with an image from
// the open repository. Wails hands it every request its own assets can't
// serve. The file name is only there so the dev server sees an extension and
// answers 404 instead of index.html.
type blobServer struct{ app *App }

func (b blobServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rest, ok := strings.CutPrefix(r.URL.Path, "/blob/")
	hash, _, _ := strings.Cut(rest, "/")
	b.app.mu.Lock()
	root := b.app.root
	b.app.mu.Unlock()
	if !ok || r.Method != http.MethodGet || root == "" {
		http.NotFound(w, r)
		return
	}
	data, err := diff.Raw(r.Context(), root, hash, diff.MaxImage)
	switch {
	case errors.Is(err, diff.ErrTooLarge):
		http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
		return
	case err != nil:
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	// Raster images only: an SVG or HTML blob must never run as a document here.
	kind := http.DetectContentType(data)
	if !strings.HasPrefix(kind, "image/") || strings.HasPrefix(kind, "image/svg") {
		http.Error(w, "not a raster image", http.StatusUnsupportedMediaType)
		return
	}
	w.Header().Set("Content-Type", kind)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// Content-addressed: a hash never changes what it points to.
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	_, _ = w.Write(data)
}
