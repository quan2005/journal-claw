import ArgumentParser
import AVFoundation
import CoreML
import Foundation
import Speech
import SpeakerKit
import WhisperKit

// MARK: - JSON Output Helpers

struct TranscribeResult: Codable {
    let status: String
    let text: String
    let segments: [TranscribeSegment]
    let engine: String  // "speech_analyzer" (macOS 26+) or "sf_speech_recognizer" (legacy)
}

struct TranscribeSegment: Codable {
    let text: String
    let start: Double
    let end: Double
}

struct DiarizeResult: Codable {
    let status: String
    let speakers: [DiarizeSpeakerSegment]
    let embeddings: [String: [Float]]?  // SPEAKER_XX → 256-dim d-vector (nil if unavailable)
}

struct DiarizeSpeakerSegment: Codable {
    let label: String
    let start: Double
    let end: Double
}

struct ErrorResult: Codable {
    let status: String
    let error: String
}

func writeJSON<T: Encodable>(_ value: T) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    guard let data = try? encoder.encode(value),
          let json = String(data: data, encoding: .utf8) else {
        let fallback = ErrorResult(status: "failed", error: "Failed to encode JSON output")
        if let fb = try? JSONEncoder().encode(fallback),
           let s = String(data: fb, encoding: .utf8) {
            print(s)
        }
        return
    }
    print(json)
}

func exitWithError(_ message: String) -> Never {
    writeJSON(ErrorResult(status: "failed", error: message))
    Foundation.exit(1)
}

// MARK: - Root Command

@main
struct JournalSpeech: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "journal-speech",
        abstract: "Speech transcription and speaker diarization CLI for Jinji",
        subcommands: [Transcribe.self, Diarize.self]
    )
}

// MARK: - Transcribe Subcommand

struct Transcribe: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Transcribe audio using SpeechAnalyzer (macOS 26+) or SFSpeechRecognizer (legacy)"
    )

    @Option(name: .long, help: "Path to the audio file")
    var audio: String

    @Option(name: .long, help: "Language code for recognition (e.g. zh-CN)")
    var language: String = "zh-CN"

    func run() async throws {
        let fileURL = URL(fileURLWithPath: audio)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            exitWithError("Audio file not found: \(audio)")
        }

        // macOS 26+: use the new SpeechAnalyzer / SpeechTranscriber API
        // macOS < 26: fall back to legacy SFSpeechRecognizer
        if #available(macOS 26, *) {
            try await transcribeWithSpeechAnalyzer(fileURL: fileURL)
        } else {
            try await transcribeWithSFSpeechRecognizer(fileURL: fileURL)
        }
    }

    // MARK: - macOS 26+ SpeechAnalyzer

    @available(macOS 26, *)
    private func transcribeWithSpeechAnalyzer(fileURL: URL) async throws {
        let locale = Locale(identifier: language)

        // Create SpeechTranscriber with time-indexed preset for segment timestamps
        let transcriber = SpeechTranscriber(
            locale: locale,
            transcriptionOptions: [],
            reportingOptions: [],
            attributeOptions: [.audioTimeRange]
        )

        // Ensure the on-device model is available
        let supportedLocales = await SpeechTranscriber.supportedLocales
        let isSupported = supportedLocales.map { $0.identifier(.bcp47) }
            .contains(locale.identifier(.bcp47))

        if !isSupported {
            // SpeechAnalyzer doesn't support this locale, fall back to legacy
            fputs("[SpeechAnalyzer] Locale \(language) not supported, falling back to SFSpeechRecognizer\n", stderr)
            try await transcribeWithSFSpeechRecognizer(fileURL: fileURL)
            return
        }

        // Check if model is installed, download if needed
        let installedLocales = await SpeechTranscriber.installedLocales
        let isInstalled = Set(installedLocales).map { $0.identifier(.bcp47) }
            .contains(locale.identifier(.bcp47))

        if !isInstalled {
            fputs("[SpeechAnalyzer] 正在下载语音模型…\n", stderr)
            if let downloader = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                try await downloader.downloadAndInstall()
            }
            fputs("[SpeechAnalyzer] 语音模型下载完成\n", stderr)
        }

        // Open audio file
        let audioFile = try AVAudioFile(forReading: fileURL)

        // Create analyzer with file input, auto-finish when file ends
        let _ = try await SpeechAnalyzer(
            inputAudioFile: audioFile,
            modules: [transcriber],
            finishAfterFile: true
        )

        // Collect all finalized results
        var segments: [TranscribeSegment] = []
        var fullText = ""

        for try await result in transcriber.results {
            if result.isFinal {
                let text = String(result.text.characters)
                fullText += text
                // Extract timing from attributed string runs
                for run in result.text.runs {
                    let runText = String(result.text[run.range].characters)
                    if runText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        continue
                    }
                    if let timeRange = run.audioTimeRange {
                        segments.append(TranscribeSegment(
                            text: runText,
                            start: timeRange.start.seconds,
                            end: timeRange.end.seconds
                        ))
                    } else {
                        segments.append(TranscribeSegment(
                            text: runText,
                            start: 0,
                            end: 0
                        ))
                    }
                }
            }
        }

        let output = TranscribeResult(
            status: "completed",
            text: fullText,
            segments: segments,
            engine: "speech_analyzer"
        )
        writeJSON(output)
    }

    // MARK: - Legacy SFSpeechRecognizer (macOS < 26)

    private func transcribeWithSFSpeechRecognizer(fileURL: URL) async throws {
        let locale = Locale(identifier: language)
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            exitWithError("SFSpeechRecognizer is not available for language: \(language)")
        }

        guard recognizer.isAvailable else {
            exitWithError("SFSpeechRecognizer is not available on this system. Please check System Settings > Privacy & Security > Speech Recognition.")
        }

        // Request authorization
        let authStatus = await withCheckedContinuation { (continuation: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }

        switch authStatus {
        case .authorized:
            break
        case .denied:
            exitWithError("Speech recognition authorization denied. Please allow access in System Settings > Privacy & Security > Speech Recognition.")
        case .restricted:
            exitWithError("Speech recognition is restricted on this device.")
        case .notDetermined:
            exitWithError("Speech recognition authorization not determined.")
        @unknown default:
            exitWithError("Unknown speech recognition authorization status.")
        }

        // Create recognition request
        let request = SFSpeechURLRecognitionRequest(url: fileURL)
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = false

        // Perform recognition using async continuation (avoids RunLoop deadlock)
        let result: SFSpeechRecognitionResult = try await withCheckedThrowingContinuation { continuation in
            recognizer.recognitionTask(with: request) { result, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                if let result = result, result.isFinal {
                    continuation.resume(returning: result)
                }
            }
        }

        // Extract segments with timestamps from bestTranscription
        let transcription = result.bestTranscription
        let segments: [TranscribeSegment] = transcription.segments.map { segment in
            TranscribeSegment(
                text: segment.substring,
                start: segment.timestamp,
                end: segment.timestamp + segment.duration
            )
        }

        let output = TranscribeResult(
            status: "completed",
            text: transcription.formattedString,
            segments: segments,
            engine: "sf_speech_recognizer"
        )
        writeJSON(output)
    }
}

// MARK: - Diarize Subcommand

struct Diarize: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Perform speaker diarization using SpeakerKit"
    )

    @Option(name: .long, help: "Path to the audio file")
    var audio: String

    func run() async throws {
        let fileURL = URL(fileURLWithPath: audio)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            exitWithError("Audio file not found: \(audio)")
        }

        // Resolve model folder from app bundle Resources or executable-relative Resources
        let modelFolder = resolveModelFolder()

        do {
            // Initialize SpeakerKit with local models from bundle Resources if available
            let config: PyannoteConfig
            if let folder = modelFolder {
                config = PyannoteConfig(modelFolder: folder, download: false)
            } else {
                // Fall back to default config (will download models on first run)
                config = PyannoteConfig()
            }

            let speakerKit = try await SpeakerKit(config)

            // Load audio as 16kHz mono PCM float array
            let audioArray = try AudioProcessor.loadAudioAsFloatArray(fromPath: fileURL.path)

            // Perform diarization
            let diarization = try await speakerKit.diarize(audioArray: audioArray)

            // Convert SpeakerKit segments to our output format and collect per-speaker audio
            let sampleRate: Float = 16000
            let maxEmbeddingSamples = 480000  // 30s at 16kHz
            var speakers: [DiarizeSpeakerSegment] = []
            var speakerAudioChunks: [String: [Float]] = [:]  // label → concatenated audio (up to 30s)

            for segment in diarization.segments {
                let speakerId = segment.speaker.speakerId ?? 0
                let label = String(format: "SPEAKER_%02d", speakerId)
                speakers.append(DiarizeSpeakerSegment(
                    label: label,
                    start: Double(segment.startTime),
                    end: Double(segment.endTime)
                ))

                // Extract audio for this segment (collect up to 30s per speaker)
                let startSample = Int(segment.startTime * sampleRate)
                let endSample = min(Int(segment.endTime * sampleRate), audioArray.count)
                if endSample > startSample {
                    let currentCount = speakerAudioChunks[label]?.count ?? 0
                    let remaining = maxEmbeddingSamples - currentCount
                    if remaining > 0 {
                        let toAppend = min(endSample - startSample, remaining)
                        speakerAudioChunks[label, default: []]
                            .append(contentsOf: audioArray[startSample..<(startSample + toAppend)])
                    }
                }
            }

            // Compute per-speaker embeddings using CoreML directly
            // SpeakerKit's SpeakerEmbedderModel is internal and not accessible from outside the module,
            // so we load the same .mlmodelc files and run predictions via MLModel directly.
            var embeddings: [String: [Float]] = [:]
            if let modelFolder = modelFolder {
                let preprocessorURL = modelFolder
                    .appendingPathComponent("speaker_embedder")
                    .appendingPathComponent("pyannote-v3")
                    .appendingPathComponent("W8A16")
                    .appendingPathComponent("SpeakerEmbedderPreprocessor.mlmodelc")
                let embedderURL = modelFolder
                    .appendingPathComponent("speaker_embedder")
                    .appendingPathComponent("pyannote-v3")
                    .appendingPathComponent("W8A16")
                    .appendingPathComponent("SpeakerEmbedder.mlmodelc")

                if FileManager.default.fileExists(atPath: preprocessorURL.path) &&
                   FileManager.default.fileExists(atPath: embedderURL.path) {
                    embeddings = computeEmbeddings(
                        speakerAudioChunks: speakerAudioChunks,
                        preprocessorURL: preprocessorURL,
                        embedderURL: embedderURL,
                        maxChunkSamples: maxEmbeddingSamples
                    )
                }
            }

            // Output result
            let result = DiarizeResult(
                status: "completed",
                speakers: speakers,
                embeddings: embeddings.isEmpty ? nil : embeddings
            )
            writeJSON(result)

        } catch {
            exitWithError("SpeakerKit diarization failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Embedding Computation via CoreML

    /// Compute per-speaker embeddings by loading CoreML models directly.
    ///
    /// The pipeline: audio [1, 480000] → Preprocessor → features [1, 2998, 80]
    ///               features + mask [1, 64, 1767] → Embedder → embeddings [1, 64, 256]
    /// We extract speaker 0's 256-dim vector (our isolated audio is all one speaker).
    private func computeEmbeddings(
        speakerAudioChunks: [String: [Float]],
        preprocessorURL: URL,
        embedderURL: URL,
        maxChunkSamples: Int
    ) -> [String: [Float]] {
        do {
            let mlConfig = MLModelConfiguration()
            mlConfig.computeUnits = .cpuAndNeuralEngine

            fputs("[embedding] Loading preprocessor model...\n", stderr)
            let preprocessorModel = try MLModel(contentsOf: preprocessorURL, configuration: mlConfig)
            fputs("[embedding] Loading embedder model...\n", stderr)
            let embedderModel = try MLModel(contentsOf: embedderURL, configuration: mlConfig)

            let maskSpeakers = 64
            let maskFrames = 1767
            var embeddings: [String: [Float]] = [:]

            for (label, audio) in speakerAudioChunks {
                guard !audio.isEmpty else { continue }

                // Pad or trim to exactly 480000 samples (30s at 16kHz)
                var chunk: [Float]
                if audio.count >= maxChunkSamples {
                    chunk = Array(audio.prefix(maxChunkSamples))
                } else {
                    chunk = audio
                    chunk.append(contentsOf: [Float](repeating: 0, count: maxChunkSamples - audio.count))
                }

                // Create waveform MLMultiArray [1, 480000] in Float16
                let waveform = try MLMultiArray(
                    shape: [1, NSNumber(value: maxChunkSamples)],
                    dataType: .float16
                )
                let waveformPtr = waveform.dataPointer.assumingMemoryBound(to: Float16.self)
                for i in 0..<maxChunkSamples {
                    waveformPtr[i] = Float16(chunk[i])
                }

                // Run preprocessor model: waveform → features
                let preprocessorInput = EmbeddingPreprocessorInput(waveforms: waveform)
                let preprocessorOutput = try preprocessorModel.prediction(from: preprocessorInput)
                guard let preprocessorFeatures = preprocessorOutput
                    .featureValue(for: "preprocessor_output_1")?.multiArrayValue else {
                    fputs("[embedding] Missing preprocessor output for \(label)\n", stderr)
                    continue
                }

                // Create speaker mask [1, 64, 1767]: speaker 0 = all 1s, rest = 0s
                // Since we extracted audio for a single speaker, the entire chunk belongs to them.
                let speakerMask = try MLMultiArray(
                    shape: [1, NSNumber(value: maskSpeakers), NSNumber(value: maskFrames)],
                    dataType: .float16
                )
                let maskPtr = speakerMask.dataPointer.assumingMemoryBound(to: Float16.self)
                let totalMaskElements = maskSpeakers * maskFrames
                for i in 0..<totalMaskElements { maskPtr[i] = 0 }
                // Set speaker 0 to all 1s
                for f in 0..<maskFrames { maskPtr[f] = Float16(1.0) }

                // Run embedder model: features + mask → embeddings
                let embedderInput = EmbedderModelInput(
                    speakerMasks: speakerMask,
                    preprocessorOutput: preprocessorFeatures
                )
                let embedderOutput = try embedderModel.prediction(from: embedderInput)
                guard let embeddingArray = embedderOutput
                    .featureValue(for: "speaker_embeddings")?.multiArrayValue else {
                    fputs("[embedding] Missing embedder output for \(label)\n", stderr)
                    continue
                }

                // Extract speaker 0's embedding vector (256-dim)
                let embeddingDim = embeddingArray.shape[2].intValue
                var embedding: [Float] = []
                embedding.reserveCapacity(embeddingDim)
                for d in 0..<embeddingDim {
                    embedding.append(embeddingArray[[0, 0, d] as [NSNumber]].floatValue)
                }
                embeddings[label] = embedding
                fputs("[embedding] Computed \(embeddingDim)-dim embedding for \(label)\n", stderr)
            }

            return embeddings
        } catch {
            fputs("[embedding] Failed: \(error.localizedDescription)\n", stderr)
            return [:]
        }
    }

    /// Resolve the SpeakerKit model folder from bundle Resources.
    /// Checks multiple locations to support both packaged .app and dev environments.
    private func resolveModelFolder() -> URL? {
        let execURL = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()

        // 1. Tauri .app layout: sidecar is in Contents/MacOS/, resources in Contents/Resources/
        // Tauri preserves the source directory structure, so "resources/speakerkit-models"
        // in src-tauri/ becomes Resources/resources/speakerkit-models/ in the bundle.
        let appResources = execURL.deletingLastPathComponent()
            .appendingPathComponent("Resources")
            .appendingPathComponent("resources")
            .appendingPathComponent("speakerkit-models")
        if FileManager.default.fileExists(atPath: appResources.path) {
            return appResources
        }

        // 2. Dev environment: binary in src-tauri/binaries/, resources in src-tauri/resources/
        let devResources = execURL.appendingPathComponent("../resources/speakerkit-models")
            .standardized
        if FileManager.default.fileExists(atPath: devResources.path) {
            return devResources
        }

        // 3. Check main bundle Resources (fallback)
        if let bundleResources = Bundle.main.resourceURL?
            .appendingPathComponent("speakerkit-models") {
            if FileManager.default.fileExists(atPath: bundleResources.path) {
                return bundleResources
            }
        }

        // 4. No local models found — return nil to use default config (will download)
        return nil
    }
}

// MARK: - CoreML Feature Providers for Embedding Pipeline

/// Input provider for SpeakerEmbedderPreprocessor model.
/// Input: waveforms [1, 480000] Float16
private class EmbeddingPreprocessorInput: MLFeatureProvider {
    let waveforms: MLMultiArray
    var featureNames: Set<String> { ["waveforms"] }

    func featureValue(for featureName: String) -> MLFeatureValue? {
        if featureName == "waveforms" {
            return MLFeatureValue(multiArray: waveforms)
        }
        return nil
    }

    init(waveforms: MLMultiArray) {
        self.waveforms = waveforms
    }
}

/// Input provider for SpeakerEmbedder model.
/// Inputs: speaker_masks [1, 64, 1767], preprocessor_output_1 [1, 2998, 80]
private class EmbedderModelInput: MLFeatureProvider {
    let speakerMasks: MLMultiArray
    let preprocessorOutput: MLMultiArray
    var featureNames: Set<String> { ["speaker_masks", "preprocessor_output_1"] }

    func featureValue(for featureName: String) -> MLFeatureValue? {
        if featureName == "speaker_masks" {
            return MLFeatureValue(multiArray: speakerMasks)
        }
        if featureName == "preprocessor_output_1" {
            return MLFeatureValue(multiArray: preprocessorOutput)
        }
        return nil
    }

    init(speakerMasks: MLMultiArray, preprocessorOutput: MLMultiArray) {
        self.speakerMasks = speakerMasks
        self.preprocessorOutput = preprocessorOutput
    }
}
