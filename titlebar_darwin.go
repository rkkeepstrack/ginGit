//go:build darwin

package main

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

// Where macOS put the traffic lights, measured from the top of the window in
// points. The position moved between macOS versions, so we ask instead of
// hard-coding a title bar height.
static double trafficLightCenterY(void) {
	__block double y = 0;
	void (^measure)(void) = ^{
		NSWindow *win = [NSApp mainWindow] ?: [[NSApp windows] firstObject];
		if (win == nil) return;
		NSButton *close = [win standardWindowButton:NSWindowCloseButton];
		if (close == nil || close.superview == nil) return;
		NSRect f = [close.superview convertRect:close.frame toView:nil];
		double top = win.contentView.frame.size.height;
		y = top - (f.origin.y + f.size.height / 2.0);
	};
	if ([NSThread isMainThread]) measure(); else dispatch_sync(dispatch_get_main_queue(), measure);
	return y;
}
*/
import "C"

func trafficLightCenterY() float64 { return float64(C.trafficLightCenterY()) }
