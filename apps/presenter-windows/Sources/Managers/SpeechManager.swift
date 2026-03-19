import Foundation
import AVFoundation
import Speech
import Combine
import MLXAudio

@MainActor
public final class SpeechManager: NSObject, ObservableObject {
    @Published public private(set) var transcript: String = ""
    @Published public private(set) var isListening = false
    @Published public private(set) var micLevel: Float = 0
    @Published public private(set) var lastTranscriptUpdateAt: Date = .distantPast

    private static let preferredModel: WhisperModelSize = WhisperModelSize.large.isAvailable ? .large : .largeTurbo
    private let audioEngine = AVAudioEngine()
    private let whisper = STT.whisper(model: SpeechManager.preferredModel)
    private let captureLock = NSLock()
    private var capturedSamples: [Float] = []
    private var captureSampleRate: Double = 16_000
    private var transcriptionTask: Task<Void, Never>?
    private var isTranscribingChunk = false
    private var lastTranscribedSampleCount = 0
    private let transcriptionPollNanos: UInt64 = 1_000_000_000
    private let minimumSamplesBeforeTranscribe: Int = 16_000
    private let maxBufferedAudioSeconds: Double = 30
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var suppressNextRecognitionErrorStop = false
    private let recognitionRestartCooldownNanos: UInt64 = 220_000_000
    private var isUsingSpeechFallback = false
    private var whisperLoadFailed = false
    private(set) public var lastAudioActivityAt: Date = .distantPast

    public override init() {
        super.init()
        if Self.preferredModel == .large {
            AppLogger.info("whisper model selected: whisper-large-v3")
        } else {
            AppLogger.info("whisper-large-v3 unavailable in current mlx-swift-audio branch; using whisper-large-v3-turbo")
        }
    }

    public func requestPermissions(_ completion: @escaping @MainActor (Bool) -> Void) {
        requestMicPermissionIfNeeded(completion: completion)
    }

    public func permissionErrorMessage() -> String {
        let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        let speechStatus = SFSpeechRecognizer.authorizationStatus()

        let micDenied = micStatus == .denied || micStatus == .restricted
        let speechDenied = speechStatus == .denied || speechStatus == .restricted

        if micDenied {
            return "Microphone permission denied. Enable it in System Settings > Privacy & Security > Microphone."
        }
        if whisperLoadFailed && speechDenied {
            return "Whisper model failed to load and Speech Recognition permission is denied. Enable Speech Recognition in System Settings > Privacy & Security > Speech Recognition."
        }
        return "Microphone permission not granted yet."
    }

    public func startStreaming() {
        guard !isListening else { return }

        recognitionTask?.cancel()
        recognitionTask = nil
        request = nil
        suppressNextRecognitionErrorStop = false
        isUsingSpeechFallback = false

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        captureSampleRate = format.sampleRate

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.appendCapturedAudio(buffer)
            self?.updateMicLevel(from: buffer)
            self?.appendSpeechBufferIfNeeded(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            NSLog("AudioEngine start failed: \(error.localizedDescription)")
            return
        }

        captureLock.lock()
        capturedSamples = []
        lastTranscribedSampleCount = 0
        captureLock.unlock()
        transcript = ""
        startTranscriptionLoop()

        isListening = true
    }

    public func stopStreaming() {
        guard isListening else { return }
        transcriptionTask?.cancel()
        transcriptionTask = nil
        request?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        request = nil
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        captureLock.lock()
        capturedSamples = []
        lastTranscribedSampleCount = 0
        captureLock.unlock()
        isListening = false
        micLevel = 0
        isTranscribingChunk = false
        isUsingSpeechFallback = false
    }

    public func resetTranscript() {
        transcript = ""
    }

    public func resetForNextUtterance() {
        guard isListening else {
            transcript = ""
            return
        }

        AppLogger.info("whisper resetForNextUtterance begin")
        transcript = ""

        if isUsingSpeechFallback {
            suppressNextRecognitionErrorStop = true
            request?.endAudio()
            recognitionTask?.cancel()
            recognitionTask = nil
            request = SFSpeechAudioBufferRecognitionRequest()
            request?.shouldReportPartialResults = true

            Task { @MainActor [weak self] in
                guard let self else { return }
                try? await Task.sleep(nanoseconds: self.recognitionRestartCooldownNanos)
                guard self.isListening else { return }
                self.beginRecognitionTask()
            }
            return
        }

        captureLock.lock()
        capturedSamples = []
        lastTranscribedSampleCount = 0
        captureLock.unlock()
    }

    private func updateMicLevel(from buffer: AVAudioPCMBuffer) {
        let samples = monoSamples(from: buffer)
        guard !samples.isEmpty else { return }
        var sum: Float = 0
        for sample in samples {
            sum += abs(sample)
        }
        let avg = sum / Float(samples.count)

        Task { @MainActor in
            self.micLevel = min(max(avg * 8, 0), 1)
            if self.micLevel > 0.02 {
                self.lastAudioActivityAt = Date()
            }
        }
    }

    private func requestMicPermissionIfNeeded(completion: @escaping @MainActor (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                Task { @MainActor in
                    completion(granted)
                }
            }
        case .denied, .restricted:
            completion(false)
        @unknown default:
            completion(false)
        }
    }

    private func appendCapturedAudio(_ buffer: AVAudioPCMBuffer) {
        let samples = monoSamples(from: buffer)
        guard !samples.isEmpty else { return }
        captureLock.lock()
        capturedSamples.append(contentsOf: samples)
        let maxSamples = Int(captureSampleRate * maxBufferedAudioSeconds)
        if capturedSamples.count > maxSamples {
            capturedSamples.removeFirst(capturedSamples.count - maxSamples)
        }
        captureLock.unlock()
    }

    private func startTranscriptionLoop() {
        transcriptionTask?.cancel()
        transcriptionTask = Task { [weak self] in
            guard let self else { return }

            if self.whisperLoadFailed {
                await self.activateSpeechFallback()
                return
            }

            do {
                try await self.whisper.load()
            } catch {
                AppLogger.error("whisper load failed: \(error.localizedDescription)")
                self.whisperLoadFailed = true
                await self.activateSpeechFallback()
                return
            }

            while !Task.isCancelled {
                if !self.isListening {
                    return
                }
                if !self.isTranscribingChunk {
                    await self.transcribeLatestAudioIfNeeded()
                }
                try? await Task.sleep(nanoseconds: self.transcriptionPollNanos)
            }
        }
    }

    private func activateSpeechFallback() async {
        guard isListening else { return }
        let granted = await requestSpeechPermissionIfNeeded()
        guard granted else {
            AppLogger.error("speech fallback unavailable: speech recognition permission denied")
            return
        }
        isUsingSpeechFallback = true
        request = SFSpeechAudioBufferRecognitionRequest()
        request?.shouldReportPartialResults = true
        beginRecognitionTask()
        AppLogger.info("speech fallback active after whisper load failure")
    }

    private func appendSpeechBufferIfNeeded(_ buffer: AVAudioPCMBuffer) {
        guard isUsingSpeechFallback else { return }
        request?.append(buffer)
    }

    private func requestSpeechPermissionIfNeeded() async -> Bool {
        let status = SFSpeechRecognizer.authorizationStatus()
        switch status {
        case .authorized:
            return true
        case .notDetermined:
            return await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { auth in
                    continuation.resume(returning: auth == .authorized)
                }
            }
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    private func beginRecognitionTask() {
        guard isUsingSpeechFallback else { return }
        guard let recognizer else {
            AppLogger.error("speech fallback unavailable: recognizer could not be created for current locale")
            return
        }
        let activeRequest = request ?? SFSpeechAudioBufferRecognitionRequest()
        request = activeRequest
        activeRequest.shouldReportPartialResults = true

        recognitionTask = recognizer.recognitionTask(with: activeRequest) { [weak self] result, error in
            guard let self else { return }
            if let result {
                Task { @MainActor in
                    self.transcript = result.bestTranscription.formattedString
                    self.lastTranscriptUpdateAt = Date()
                }
            }
            if error != nil {
                if self.suppressNextRecognitionErrorStop {
                    self.suppressNextRecognitionErrorStop = false
                    AppLogger.info("speech recognition expected reset error ignored")
                    return
                }
                AppLogger.error("speech recognition fallback task error; stopping stream")
                Task { @MainActor in
                    self.stopStreaming()
                }
            }
        }
    }

    private func monoSamples(from buffer: AVAudioPCMBuffer) -> [Float] {
        let frameLength = Int(buffer.frameLength)
        guard frameLength > 0 else { return [] }

        if let channel = buffer.floatChannelData?[0] {
            return Array(UnsafeBufferPointer(start: channel, count: frameLength))
        }

        if let channel = buffer.int16ChannelData?[0] {
            let source = UnsafeBufferPointer(start: channel, count: frameLength)
            return source.map { Float($0) / Float(Int16.max) }
        }

        return []
    }

    private func transcribeLatestAudioIfNeeded() async {
        let (snapshot, sampleRate) = snapshotCapturedAudio()

        guard snapshot.count >= minimumSamplesBeforeTranscribe else { return }
        guard snapshot.count - lastTranscribedSampleCount >= Int(sampleRate * 0.35) else { return }

        isTranscribingChunk = true
        defer { isTranscribingChunk = false }

        do {
            let url = try writeWaveSnapshot(samples: snapshot, sampleRate: sampleRate)
            defer { try? FileManager.default.removeItem(at: url) }
            let result = try await whisper.transcribe(url, temperature: 0.0, timestamps: TimestampGranularity.none)
            let text = result.text.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
            guard !text.isEmpty else { return }
            transcript = text
            lastTranscriptUpdateAt = Date()
            lastTranscribedSampleCount = snapshot.count
        } catch {
            AppLogger.error("whisper transcription failed: \(error.localizedDescription)")
        }
    }

    private func snapshotCapturedAudio() -> ([Float], Double) {
        captureLock.lock()
        defer { captureLock.unlock() }
        return (capturedSamples, captureSampleRate)
    }

    private func writeWaveSnapshot(samples: [Float], sampleRate: Double) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("voice-launcher-whisper-\(UUID().uuidString)")
            .appendingPathExtension("wav")
        let wav = makeWaveData(samples: samples, sampleRate: Int(sampleRate))
        try wav.write(to: url, options: .atomic)
        return url
    }

    private func makeWaveData(samples: [Float], sampleRate: Int) -> Data {
        let channels: UInt16 = 1
        let bitsPerSample: UInt16 = 16
        let bytesPerSample = Int(bitsPerSample / 8)
        let byteRate = UInt32(sampleRate * Int(channels) * bytesPerSample)
        let blockAlign = UInt16(Int(channels) * bytesPerSample)
        let pcmDataByteCount = UInt32(samples.count * bytesPerSample)
        let riffChunkSize = UInt32(36) + pcmDataByteCount

        var data = Data()
        data.reserveCapacity(Int(44 + pcmDataByteCount))

        data.append("RIFF".data(using: .ascii)!)
        appendLE(&data, riffChunkSize)
        data.append("WAVE".data(using: .ascii)!)

        data.append("fmt ".data(using: .ascii)!)
        appendLE(&data, UInt32(16))
        appendLE(&data, UInt16(1))
        appendLE(&data, channels)
        appendLE(&data, UInt32(sampleRate))
        appendLE(&data, byteRate)
        appendLE(&data, blockAlign)
        appendLE(&data, bitsPerSample)

        data.append("data".data(using: .ascii)!)
        appendLE(&data, pcmDataByteCount)

        for sample in samples {
            let clipped = max(-1.0, min(1.0, sample))
            let intSample = Int16(clipped * Float(Int16.max))
            appendLE(&data, intSample)
        }

        return data
    }

    private func appendLE<T: FixedWidthInteger>(_ data: inout Data, _ value: T) {
        var le = value.littleEndian
        withUnsafeBytes(of: &le) { bytes in
            data.append(bytes.bindMemory(to: UInt8.self))
        }
    }
}
