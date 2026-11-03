//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

// With TitleBarHiddenInset the titlebar is transparent over the content. In
// fullscreen macOS reveals it on hover and the webview shows through, which
// flickers. Make it solid for the duration of fullscreen.
static void installFullscreenTitlebarFix(void) {
	dispatch_async(dispatch_get_main_queue(), ^{
		NSWindow *win = [NSApp mainWindow] ?: [[NSApp windows] firstObject];
		if (win == nil) {
			return;
		}
		NSNotificationCenter *nc = [NSNotificationCenter defaultCenter];
		[nc addObserverForName:NSWindowWillEnterFullScreenNotification object:win queue:[NSOperationQueue mainQueue]
			usingBlock:^(NSNotification *note) { win.titlebarAppearsTransparent = NO; }];
		[nc addObserverForName:NSWindowWillExitFullScreenNotification object:win queue:[NSOperationQueue mainQueue]
			usingBlock:^(NSNotification *note) { win.titlebarAppearsTransparent = YES; }];
	});
}
*/
import "C"

func fixFullscreenTitlebar() {
	C.installFullscreenTitlebarFix()
}
