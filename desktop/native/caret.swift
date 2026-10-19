// Where you are typing, for Momo Desktop on macOS: the screen rectangle of the text caret in the focused
// app, read through the Accessibility API. Only the position is read, never any text.
//
// Reads commands on stdin, one per line, and answers each with one line of JSON:
//   where  -> {"x":…,"y":…,"w":…,"h":…,"exact":true}  the caret (or, without one, the focused field: exact false)
//             {"found":false}                         nothing focused that has a position
//             {"permission":false}                    Accessibility permission not granted yet
//   ask    -> asks macOS to show the Accessibility permission prompt; answers {"permission":true|false}

import ApplicationServices
import Foundation

setvbuf(stdout, nil, _IOLBF, 0)

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func json(_ rect: CGRect, exact: Bool) -> String {
    "{\"x\":\(Int(rect.origin.x)),\"y\":\(Int(rect.origin.y)),\"w\":\(Int(rect.width)),\"h\":\(Int(rect.height)),\"exact\":\(exact)}"
}

func caret() -> String {
    guard AXIsProcessTrusted() else { return "{\"permission\":false}" }
    let system = AXUIElementCreateSystemWide()
    guard let focused = attribute(system, kAXFocusedUIElementAttribute) else { return "{\"found\":false}" }
    let element = focused as! AXUIElement

    // The caret: the bounds of the selected range (an empty selection is the caret itself).
    if let range = attribute(element, kAXSelectedTextRangeAttribute) {
        var bounds: CFTypeRef?
        if AXUIElementCopyParameterizedAttributeValue(element, kAXBoundsForRangeParameterizedAttribute as CFString, range, &bounds) == .success,
           let bounds {
            var rect = CGRect.zero
            if AXValueGetValue(bounds as! AXValue, .cgRect, &rect), rect.origin != .zero {
                return json(rect, exact: true)
            }
        }
    }

    // Apps that do not report a caret (many terminals): the focused field's frame instead.
    if let position = attribute(element, kAXPositionAttribute), let size = attribute(element, kAXSizeAttribute) {
        var origin = CGPoint.zero
        var extent = CGSize.zero
        AXValueGetValue(position as! AXValue, .cgPoint, &origin)
        AXValueGetValue(size as! AXValue, .cgSize, &extent)
        return json(CGRect(origin: origin, size: extent), exact: false)
    }
    return "{\"found\":false}"
}

while let line = readLine() {
    if line == "ask" {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        print(AXIsProcessTrustedWithOptions(options) ? "{\"permission\":true}" : "{\"permission\":false}")
    } else {
        print(caret())
    }
}
