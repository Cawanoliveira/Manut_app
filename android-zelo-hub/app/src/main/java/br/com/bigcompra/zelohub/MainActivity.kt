package br.com.bigcompra.zelohub

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import br.com.bigcompra.zelohub.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var bridge: WebAppBridge
    private lateinit var voiceManager: VoiceRecognitionManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pendingVoiceTargetId: String? = null
    private var pendingVoiceBaseValue: String = ""

    private val audioPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val targetId = pendingVoiceTargetId
            if (granted && targetId != null) {
                voiceManager.start(targetId, pendingVoiceBaseValue)
            } else {
                sendVoiceEvent(
                    targetId,
                    "error",
                    message = "Permita o microfone para usar o ditado offline."
                )
            }
            pendingVoiceTargetId = null
            pendingVoiceBaseValue = ""
        }

    private val spenEditorLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data ?: return@registerForActivityResult
            val targetId = data.getStringExtra(NativeSpenActivity.EXTRA_TARGET_ID).orEmpty()
            val applied = data.getBooleanExtra(NativeSpenActivity.EXTRA_APPLIED, false)
            val value = data.getStringExtra(NativeSpenActivity.EXTRA_VALUE).orEmpty()
            sendSpenResult(targetId, value, applied)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        enableImmersiveMode()

        voiceManager = VoiceRecognitionManager(
            context = this,
            onEvent = { event -> handleVoiceEvent(event) }
        )

        bridge = WebAppBridge(
            activity = this,
            onStartVoice = { targetId, baseValue -> startVoiceSession(targetId, baseValue) },
            onStopVoice = { voiceManager.stop() },
            onOpenSpen = { targetId, title, value -> openNativeSpenEditor(targetId, title, value) },
            onOpenExternalDocument = { url, mimeType, fileName -> openExternalDocument(url, mimeType, fileName) }
        )

        setupWebView(binding.webView)

        if (savedInstanceState == null) {
            binding.webView.loadUrl(BuildConfig.APP_URL)
        } else {
            binding.webView.restoreState(savedInstanceState)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    override fun onDestroy() {
        voiceManager.destroy()
        binding.webView.removeJavascriptInterface("ZeloHubAndroid")
        binding.webView.destroy()
        super.onDestroy()
    }

    private fun setupWebView(webView: WebView) {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(webView.settings, WebSettingsCompat.FORCE_DARK_OFF)
        }

        webView.addJavascriptInterface(bridge, "ZeloHubAndroid")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                return handleExternalUrl(url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return url?.let { handleExternalUrl(Uri.parse(it)) } ?: false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                return super.onConsoleMessage(consoleMessage)
            }
        }
    }

    private fun handleExternalUrl(uri: Uri): Boolean {
        val host = uri.host.orEmpty()
        val isInternal =
            host.contains("github.io") ||
                host.contains("script.google.com") ||
                host.contains("googleusercontent.com")
        if (isInternal) {
            return false
        }
        startActivity(Intent(Intent.ACTION_VIEW, uri))
        return true
    }

    private fun startVoiceSession(targetId: String, baseValue: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            voiceManager.start(targetId, baseValue)
            return
        }
        pendingVoiceTargetId = targetId
        pendingVoiceBaseValue = baseValue
        audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }

    private fun openNativeSpenEditor(targetId: String, title: String, value: String) {
        val intent = Intent(this, NativeSpenActivity::class.java).apply {
            putExtra(NativeSpenActivity.EXTRA_TARGET_ID, targetId)
            putExtra(NativeSpenActivity.EXTRA_TITLE, title)
            putExtra(NativeSpenActivity.EXTRA_VALUE, value)
        }
        spenEditorLauncher.launch(intent)
    }

    private fun openExternalDocument(url: String, mimeType: String, fileName: String) {
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType.ifBlank { null } ?: "*/*")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(Intent.createChooser(intent, fileName.ifBlank { "Abrir arquivo" }))
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            } catch (inner: Exception) {
                showToast("Nao foi possivel abrir o arquivo no dispositivo.")
            }
        }
    }

    private fun handleVoiceEvent(event: VoiceRecognitionManager.VoiceEvent) {
        when (event.type) {
            VoiceRecognitionManager.EventType.STARTED ->
                sendVoiceEvent(event.targetId, "started")

            VoiceRecognitionManager.EventType.PARTIAL ->
                sendVoiceEvent(
                    event.targetId,
                    "partial",
                    finalTranscript = event.finalTranscript,
                    interimTranscript = event.interimTranscript
                )

            VoiceRecognitionManager.EventType.FINAL ->
                sendVoiceEvent(
                    event.targetId,
                    "final",
                    finalTranscript = event.finalTranscript,
                    interimTranscript = ""
                )

            VoiceRecognitionManager.EventType.STOPPED ->
                sendVoiceEvent(
                    event.targetId,
                    "stopped",
                    finalTranscript = event.finalTranscript,
                    interimTranscript = ""
                )

            VoiceRecognitionManager.EventType.ERROR ->
                sendVoiceEvent(
                    event.targetId,
                    "error",
                    message = event.message
                )
        }
    }

    private fun sendVoiceEvent(
        targetId: String?,
        type: String,
        finalTranscript: String = "",
        interimTranscript: String = "",
        message: String = ""
    ) {
        val safeTarget = targetId.orEmpty().toJsString()
        val safeType = type.toJsString()
        val safeFinal = finalTranscript.toJsString()
        val safeInterim = interimTranscript.toJsString()
        val safeMessage = message.toJsString()
        val script =
            """
            window.handleNativeVoiceEvent && window.handleNativeVoiceEvent({
              targetId: "$safeTarget",
              type: "$safeType",
              finalTranscript: "$safeFinal",
              interimTranscript: "$safeInterim",
              message: "$safeMessage"
            });
            """.trimIndent()
        evaluateJavascript(script)
    }

    private fun sendSpenResult(targetId: String, value: String, applied: Boolean) {
        val script =
            """
            window.handleNativeSpenResult && window.handleNativeSpenResult({
              targetId: "${targetId.toJsString()}",
              value: "${value.toJsString()}",
              applied: $applied
            });
            """.trimIndent()
        evaluateJavascript(script)
    }

    private fun evaluateJavascript(script: String, callback: ValueCallback<String>? = null) {
        mainHandler.post {
            binding.webView.evaluateJavascript(script, callback)
        }
    }

    fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
}

private fun String.toJsString(): String =
    replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "")
