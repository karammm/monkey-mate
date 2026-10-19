// Push-to-talk for Momo Desktop on macOS: listens to the microphone and turns speech into text with
// Apple's speech recognizer, on this Mac whenever the Mac supports it. It listens only between
// "start" and "stop".
//
// Reads commands on stdin, one per line: "start" or "stop". Writes one line of JSON per event:
//   {"listening":true}           the microphone is on
//   {"partial":"run the te"}     what was heard so far
//   {"final":"run the tests"}    what was said, once listening ends
//   {"error":"…"}                speech-permission, microphone, unavailable

import AVFoundation
import Foundation
import Speech

setvbuf(stdout, nil, _IOLBF, 0)

func emit(_ event: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: event), let line = String(data: data, encoding: .utf8) {
        print(line)
    }
}

final class Listener {
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var heard = ""
    private var isDone = true

    func start() {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else { return emit(["error": "speech-permission"]) }
                self.begin()
            }
        }
    }

    private func begin() {
        guard isDone else { return }
        guard let recognizer, recognizer.isAvailable else { return emit(["error": "unavailable"]) }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request
        heard = ""
        isDone = false

        let input = engine.inputNode
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            isDone = true
            return emit(["error": "microphone"])
        }
        emit(["listening": true])

        task = recognizer.recognitionTask(with: request) { result, error in
            DispatchQueue.main.async {
                if let result {
                    self.heard = result.bestTranscription.formattedString
                    emit(["partial": self.heard])
                    if result.isFinal { self.finish() }
                } else if error != nil {
                    self.finish()
                }
            }
        }
    }

    func stop() {
        guard !isDone else { return }
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        // If the recognizer has nothing more to say, finish with what was heard.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self.finish() }
    }

    private func finish() {
        guard !isDone else { return }
        isDone = true
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        task?.cancel()
        task = nil
        request = nil
        emit(["final": heard])
    }
}

let listener = Listener()
DispatchQueue.global().async {
    while let line = readLine() {
        DispatchQueue.main.async {
            if line == "start" { listener.start() } else if line == "stop" { listener.stop() }
        }
    }
    exit(0)
}
RunLoop.main.run()
