import ArgumentParser
import AVFoundation
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

            // Convert SpeakerKit segments to our output format
            var speakers: [DiarizeSpeakerSegment] = []
            for segment in diarization.segments {
                let speakerId = segment.speaker.speakerId ?? 0
                let label = String(format: "SPEAKER_%02d", speakerId)
                speakers.append(DiarizeSpeakerSegment(
                    label: label,
                    start: Double(segment.startTime),
                    end: Double(segment.endTime)
                ))
            }

            // Output result — consistent format whether single or multiple speakers
            let result = DiarizeResult(
                status: "completed",
                speakers: speakers
            )
            writeJSON(result)

        } catch {
            exitWithError("SpeakerKit diarization failed: \(error.localizedDescription)")
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
