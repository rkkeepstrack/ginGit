package main

import (
	"runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// appMenu is the native menu bar. Every item just tells the frontend which
// action to run, so menu, keyboard and buttons share one implementation.
func (a *App) appMenu() *menu.Menu {
	m := menu.NewMenu()
	if runtime.GOOS == "darwin" {
		m.Append(menu.AppMenu())
	}
	act := func(name string) menu.Callback {
		return func(*menu.CallbackData) { wrt.EventsEmit(a.ctx, "menu", name) }
	}

	file := m.AddSubmenu("File")
	file.AddText("Open Repository…", keys.CmdOrCtrl("o"), act("open"))
	file.AddText("Reload History", keys.CmdOrCtrl("r"), act("refresh"))
	file.AddSeparator()
	file.AddText("Clear Selection", keys.Key("escape"), act("escape"))
	if runtime.GOOS != "darwin" {
		file.AddSeparator()
		file.AddText("Quit", keys.CmdOrCtrl("q"), func(*menu.CallbackData) { wrt.Quit(a.ctx) })
	}

	// Edit gives the webview working copy/paste on macOS.
	m.Append(menu.EditMenu())

	view := m.AddSubmenu("View")
	view.AddText("Find in Changes", keys.CmdOrCtrl("f"), act("find"))
	view.AddText("Find Commit", keys.CmdOrCtrl("p"), act("search"))
	view.AddText("Filter Files", keys.CmdOrCtrl("e"), act("filterFiles"))
	view.AddSeparator()
	view.AddText("Toggle Side-by-side / Unified Diff", keys.Combo("d", keys.CmdOrCtrlKey, keys.ShiftKey), act("toggleDiff"))
	view.AddSeparator()
	view.AddText("Focus Log", keys.CmdOrCtrl("1"), act("focusLog"))
	view.AddText("Focus Review", keys.CmdOrCtrl("2"), act("focusReview"))
	view.AddText("Focus Files", keys.CmdOrCtrl("3"), act("focusFiles"))
	view.AddSeparator()
	appearance := view.AddSubmenu("Appearance")
	appearance.AddText("Light", nil, act("themeLight"))
	appearance.AddText("Dark", nil, act("themeDark"))
	appearance.AddText("System", nil, act("themeSystem"))
	appearance.AddSeparator()
	diffStyle := appearance.AddSubmenu("Diff Style")
	diffStyle.AddText("Editor", nil, act("diffEditor"))
	diffStyle.AddText("Patch", nil, act("diffPatch"))

	nav := m.AddSubmenu("Navigate")
	nav.AddText("Previous File", keys.CmdOrCtrl("up"), act("prevFile"))
	nav.AddText("Next File", keys.CmdOrCtrl("down"), act("nextFile"))

	if runtime.GOOS == "darwin" {
		m.Append(menu.WindowMenu())
	}
	return m
}
