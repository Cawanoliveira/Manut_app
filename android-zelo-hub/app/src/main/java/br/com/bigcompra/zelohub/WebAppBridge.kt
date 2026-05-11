package br.com.bigcompra.zelohub

import android.webkit.JavascriptInterface

class WebAppBridge(
    private val activity: MainActivity,
    private val onStartVoice: (targetId: String, baseValue: String) -> Unit,
    private val onStopVoice: () -> Unit,
    private val onOpenSpen: (targetId: String, title: String, value: String) -> Unit
) {

    @JavascriptInterface
    fun startVoiceSession(targetId: String, baseValue: String) {
        activity.runOnUiThread {
            onStartVoice(targetId, baseValue)
        }
    }

    @JavascriptInterface
    fun stopVoiceSession() {
        activity.runOnUiThread {
            onStopVoice()
        }
    }

    @JavascriptInterface
    fun openSpenEditor(targetId: String, title: String, value: String) {
        activity.runOnUiThread {
            onOpenSpen(targetId, title, value)
        }
    }

    @JavascriptInterface
    fun isOnDeviceSpeechAvailable(): Boolean {
        return VoiceRecognitionManager.isOnDeviceSpeechAvailable(activity)
    }

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            activity.showToast(message)
        }
    }
}
