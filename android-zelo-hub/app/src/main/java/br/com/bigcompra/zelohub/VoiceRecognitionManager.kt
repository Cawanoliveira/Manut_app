package br.com.bigcompra.zelohub

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

class VoiceRecognitionManager(
    private val context: Context,
    private val onEvent: (VoiceEvent) -> Unit
) {

    enum class EventType {
        STARTED,
        PARTIAL,
        FINAL,
        STOPPED,
        ERROR
    }

    data class VoiceEvent(
        val type: EventType,
        val targetId: String,
        val finalTranscript: String = "",
        val interimTranscript: String = "",
        val message: String = ""
    )

    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var currentTargetId: String = ""
    private var accumulatedFinal: String = ""
    private var manualStop: Boolean = false

    fun start(targetId: String, baseValue: String) {
        stop()
        currentTargetId = targetId
        accumulatedFinal = ""
        manualStop = false
        recognizer = createRecognizer()
        val recognitionListener = object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                emit(EventType.STARTED)
            }

            override fun onBeginningOfSpeech() = Unit

            override fun onRmsChanged(rmsdB: Float) = Unit

            override fun onBufferReceived(buffer: ByteArray?) = Unit

            override fun onEndOfSpeech() = Unit

            override fun onError(error: Int) {
                val isHarmless = manualStop || error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                if (isHarmless) {
                    emit(EventType.STOPPED, finalTranscript = accumulatedFinal)
                } else {
                    emit(EventType.ERROR, message = errorMessageFor(error))
                }
                destroyRecognizer()
            }

            override fun onResults(results: Bundle?) {
                val finals = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
                val finalText = finals.firstOrNull().orEmpty()
                accumulatedFinal = appendChunk(accumulatedFinal, finalText)
                emit(EventType.FINAL, finalTranscript = accumulatedFinal)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val partials = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
                val partialText = partials.firstOrNull().orEmpty()
                emit(
                    EventType.PARTIAL,
                    finalTranscript = accumulatedFinal,
                    interimTranscript = partialText
                )
            }

            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        }

        recognizer?.setRecognitionListener(recognitionListener)
        recognizer?.startListening(buildRecognizerIntent())
    }

    fun stop() {
        manualStop = true
        recognizer?.stopListening()
        destroyRecognizer()
    }

    fun destroy() {
        destroyRecognizer()
    }

    private fun emit(
        type: EventType,
        finalTranscript: String = "",
        interimTranscript: String = "",
        message: String = ""
    ) {
        val event = VoiceEvent(
            type = type,
            targetId = currentTargetId,
            finalTranscript = finalTranscript,
            interimTranscript = interimTranscript,
            message = message
        )
        mainHandler.post { onEvent(event) }
    }

    private fun buildRecognizerIntent(): Intent {
        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
    }

    private fun createRecognizer(): SpeechRecognizer {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && isOnDeviceSpeechAvailable(context)) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        } else {
            SpeechRecognizer.createSpeechRecognizer(context)
        }
    }

    private fun destroyRecognizer() {
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
    }

    private fun appendChunk(current: String, next: String): String {
        if (next.isBlank()) return current
        if (current.isBlank()) return next.trim()
        val normalizedCurrent = current.trim().lowercase()
        val normalizedNext = next.trim().lowercase()
        if (normalizedCurrent.endsWith(normalizedNext)) {
            return current
        }
        return "$current $next".replace(Regex("\\s+"), " ").trim()
    }

    private fun errorMessageFor(error: Int): String {
        return when (error) {
            SpeechRecognizer.ERROR_NETWORK,
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Ditado offline indisponivel neste dispositivo."
            SpeechRecognizer.ERROR_AUDIO -> "Falha ao capturar audio do microfone."
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permita o uso do microfone para o ditado."
            else -> "Nao foi possivel iniciar o ditado nativo."
        }
    }

    companion object {
        fun isOnDeviceSpeechAvailable(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
            } else {
                false
            }
        }
    }
}
