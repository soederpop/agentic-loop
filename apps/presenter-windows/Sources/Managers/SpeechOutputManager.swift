import Foundation
import AVFoundation

@MainActor
public final class SpeechOutputManager: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var selectedVoiceIdentifier: String = ""
    public var onSpeakingStateChange: ((Bool) -> Void)?

    public override init() {
        super.init()
        synthesizer.delegate = self
    }

    public func speak(_ text: String) {
        let phrase = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !phrase.isEmpty else { return }

        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .word)
        }

        let utterance = AVSpeechUtterance(string: phrase)
        if !selectedVoiceIdentifier.isEmpty,
           let voice = AVSpeechSynthesisVoice(identifier: selectedVoiceIdentifier) {
            utterance.voice = voice
        }
        utterance.rate = 0.48
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0
        AppLogger.info("speaking phrase from server: \(phrase)")
        synthesizer.speak(utterance)
    }

    public func setVoiceIdentifier(_ identifier: String) {
        selectedVoiceIdentifier = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public func playAudioFile(_ path: String) {
        let url = URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: path) else {
            AppLogger.error("audio file not found: \(path)")
            return
        }

        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        audioPlayer?.stop()

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.delegate = self
            audioPlayer = player
            AppLogger.info("playing audio file: \(path)")
            onSpeakingStateChange?(true)
            player.play()
        } catch {
            AppLogger.error("failed to play audio file: \(error.localizedDescription)")
        }
    }

    nonisolated public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor [weak self] in
            self?.audioPlayer = nil
            self?.onSpeakingStateChange?(false)
        }
    }

    nonisolated public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: (any Error)?) {
        Task { @MainActor [weak self] in
            self?.audioPlayer = nil
            self?.onSpeakingStateChange?(false)
            if let error = error {
                AppLogger.error("audio decode error: \(error.localizedDescription)")
            }
        }
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.onSpeakingStateChange?(true)
        }
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        if !synthesizer.isSpeaking {
            Task { @MainActor [weak self] in
                self?.onSpeakingStateChange?(false)
            }
        }
    }

    nonisolated public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        if !synthesizer.isSpeaking {
            Task { @MainActor [weak self] in
                self?.onSpeakingStateChange?(false)
            }
        }
    }
}
