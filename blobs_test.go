package main

import (
	"bytes"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ginGit/internal/gittest"
)

func TestBlobServer(t *testing.T) {
	r := gittest.New(t)
	var pic bytes.Buffer
	if err := png.Encode(&pic, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	r.Write("logo.png", pic.String())
	r.Write("logo.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")
	r.Commit("images")
	blob := func(path string) string { return strings.TrimSpace(r.Git("rev-parse", "HEAD:"+path)) }

	app := NewApp()
	get := func(url string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		blobServer{app}.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
		return w
	}
	if w := get("/blob/" + blob("logo.png") + "/logo.png"); w.Code != http.StatusNotFound {
		t.Errorf("no repository open: want 404, got %d", w.Code)
	}
	app.root = r.Path
	w := get("/blob/" + blob("logo.png") + "/logo.png")
	if w.Code != http.StatusOK || w.Header().Get("Content-Type") != "image/png" || !bytes.Equal(w.Body.Bytes(), pic.Bytes()) {
		t.Errorf("png: got %d %q, %d bytes", w.Code, w.Header().Get("Content-Type"), w.Body.Len())
	}
	if w := get("/blob/" + blob("logo.svg") + "/logo.svg"); w.Code != http.StatusUnsupportedMediaType {
		t.Errorf("svg must not be served: got %d", w.Code)
	}
	if w := get("/blob/HEAD/logo.png"); w.Code != http.StatusNotFound {
		t.Errorf("a ref is not a hash: got %d", w.Code)
	}
	if w := get("/other/thing.png"); w.Code != http.StatusNotFound {
		t.Errorf("other paths: got %d", w.Code)
	}
}
