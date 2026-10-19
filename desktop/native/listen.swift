// Momo's ears on macOS: turns speech from the microphone into text with Apple's speech recognizer, on
// this Mac whenever the Mac supports it. Momo Desktop decides what the words mean (his name, a request);
// this helper only hears.
//
// Reads commands on stdin, one per line:
//   start   turn the microphone on and keep listening (recognition restarts by itself as needed)
//   reset   forget what was heard so far and keep listening (after a request, or while Momo talks)
//   stop    turn the microphone off
// Writes one line of JSON per event:
//   {"listening":true} / {"listening":false}
//   {"heard":"momo what is happening"}     everything heard since the last start or reset
//   {"error":"speech-permission" | "microphone" | "unavailable"}

import AVFoundation
import Foundation
import Speech

setvbuf(stdout, nil, _IOLBF, 0)

func emit(_ event: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: event), let line = String(data: data, encoding: .utf8) {
        print(line)
    }
}

final class Ears {
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var isOn = false
    private var session = 0
    // Recognition tasks end after about a minute; start a fresh one before that.
    private var renewal: DispatchWorkItem?

    func start() {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else { return emit(["error": "speech-permission"]) }
                self.turnOn()
            }
        }
    }

    private func turnOn() {
        guard !isOn else { return }
        guard let recognizer, recognizer.isAvailable else { return emit(["error": "unavailable"]) }
        let input = engine.inputNode
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            return emit(["error": "microphone"])
        }
        isOn = true
        emit(["listening": true])
        newTask()
    }

    /** A fresh recognition task: what was heard before is forgotten. */
    func newTask() {
        guard isOn, let recognizer else { return }
        task?.cancel()
        request?.endAudio()
        session += 1
        let current = session
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Without a hint the recognizer tends to hear "Momo" as "mama".
        request.contextualStrings = ["Momo", "Hey Momo", "Hi Momo", "Okay Momo"]
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, current == self.session else { return }
                if let result {
                    emit(["heard": result.bestTranscription.formattedString])
                    if result.isFinal { self.newTask() }
                } else if error != nil {
                    self.newTask()
                }
            }
        }
        renewal?.cancel()
        let renew = DispatchWorkItem { [weak self] in
            if current == self?.session { self?.newTask() }
        }
        renewal = renew
        DispatchQueue.main.asyncAfter(deadline: .now() + 50, execute: renew)
    }

    func stop() {
        guard isOn else { return }
        isOn = false
        renewal?.cancel()
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        emit(["listening": false])
    }
}

let ears = Ears()
DispatchQueue.global().async {
    while let line = readLine() {
        DispatchQueue.main.async {
            switch line {
            case "start": ears.start()
            case "reset": ears.newTask()
            case "stop": ears.stop()
            default: break
            }
        }
    }
    exit(0)
}
RunLoop.main.run()
