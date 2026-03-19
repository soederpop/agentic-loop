import AppKit
import Foundation

final class ANSIRenderer {
    private struct Style {
        var fg: NSColor?
        var bg: NSColor?
        var bold: Bool = false
        var underline: Bool = false

        static let `default` = Style()
    }

    private var style = Style.default
    private var carry = ""
    private let font: NSFont
    private let boldFont: NSFont
    private let defaultTextColor = NSColor.white
    private let palette: [Int: NSColor] = [
        30: .black, 31: .systemRed, 32: .systemGreen, 33: .systemYellow,
        34: .systemBlue, 35: .systemPink, 36: .systemTeal, 37: .white,
        90: .darkGray, 91: .systemRed, 92: .systemGreen, 93: .systemYellow,
        94: .systemBlue, 95: .systemPink, 96: .systemTeal, 97: .white
    ]
    private let backgroundPalette: [Int: NSColor] = [
        40: .black, 41: .systemRed, 42: .systemGreen, 43: .systemYellow,
        44: .systemBlue, 45: .systemPink, 46: .systemTeal, 47: .white,
        100: .darkGray, 101: .systemRed, 102: .systemGreen, 103: .systemYellow,
        104: .systemBlue, 105: .systemPink, 106: .systemTeal, 107: .white
    ]

    init(fontSize: CGFloat = 12) {
        font = NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
        boldFont = NSFont.monospacedSystemFont(ofSize: fontSize, weight: .bold)
    }

    func parse(_ chunk: String) -> (output: NSAttributedString, shouldClear: Bool) {
        var shouldClear = false
        let output = NSMutableAttributedString()
        let input = carry + chunk.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
        carry = ""

        var textBuffer = ""
        var index = input.startIndex
        while index < input.endIndex {
            let char = input[index]
            if char == "\u{001B}" {
                if !textBuffer.isEmpty {
                    output.append(makeAttributed(textBuffer))
                    textBuffer.removeAll(keepingCapacity: true)
                }

                let sequenceStart = index
                index = input.index(after: index)
                guard index < input.endIndex else {
                    carry = String(input[sequenceStart...])
                    break
                }

                if input[index] != "[" {
                    continue
                }
                index = input.index(after: index)
                let payloadStart = index
                while index < input.endIndex, !input[index].isAsciiLetter {
                    index = input.index(after: index)
                }
                guard index < input.endIndex else {
                    carry = String(input[sequenceStart...])
                    break
                }

                let finalChar = input[index]
                let payload = String(input[payloadStart..<index])
                if finalChar == "m" {
                    applySGR(payload: payload)
                } else if finalChar == "J" && payload == "2" {
                    shouldClear = true
                }
                index = input.index(after: index)
                continue
            }

            textBuffer.append(char)
            index = input.index(after: index)
        }

        if !textBuffer.isEmpty {
            output.append(makeAttributed(textBuffer))
        }

        return (output, shouldClear)
    }

    private func makeAttributed(_ text: String) -> NSAttributedString {
        var attributes: [NSAttributedString.Key: Any] = [
            .font: style.bold ? boldFont : font,
            .foregroundColor: style.fg ?? defaultTextColor
        ]
        if let bg = style.bg {
            attributes[.backgroundColor] = bg
        }
        if style.underline {
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        return NSAttributedString(string: text, attributes: attributes)
    }

    private func applySGR(payload: String) {
        let values = payload.split(separator: ";").compactMap { Int($0) }
        let codes = values.isEmpty ? [0] : values
        for code in codes {
            switch code {
            case 0:
                style = .default
            case 1:
                style.bold = true
            case 22:
                style.bold = false
            case 4:
                style.underline = true
            case 24:
                style.underline = false
            case 39:
                style.fg = nil
            case 49:
                style.bg = nil
            default:
                if let fg = palette[code] {
                    style.fg = fg
                } else if let bg = backgroundPalette[code] {
                    style.bg = bg
                }
            }
        }
    }
}

private extension Character {
    var isAsciiLetter: Bool {
        guard let scalar = unicodeScalars.first, unicodeScalars.count == 1 else { return false }
        return (65...90).contains(Int(scalar.value)) || (97...122).contains(Int(scalar.value))
    }
}
