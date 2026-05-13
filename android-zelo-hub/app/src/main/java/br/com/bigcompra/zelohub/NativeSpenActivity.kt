package br.com.bigcompra.zelohub

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import br.com.bigcompra.zelohub.databinding.ActivityNativeSpenBinding

class NativeSpenActivity : AppCompatActivity() {

    private lateinit var binding: ActivityNativeSpenBinding
    private var locked: Boolean = true
    private val targetId: String by lazy { intent.getStringExtra(EXTRA_TARGET_ID).orEmpty() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNativeSpenBinding.inflate(layoutInflater)
        setContentView(binding.root)
        enableImmersiveMode()
        applyInsets()

        binding.titleView.text = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        binding.editText.setText(intent.getStringExtra(EXTRA_VALUE).orEmpty())
        binding.editText.requestFocus()

        renderLockState()

        binding.lockButton.setOnClickListener {
            locked = !locked
            renderLockState()
        }
        binding.closeButton.setOnClickListener {
            finishWithResult(applied = false)
        }
        binding.clearButton.setOnClickListener {
            if (!locked) binding.editText.setText("")
        }
        binding.applyButton.setOnClickListener {
            if (!locked) finishWithResult(applied = true)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (!locked) return super.dispatchTouchEvent(ev)
        val toolType = ev.getToolType(0)
        val isStylus = toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER
        if (isStylus) {
            return super.dispatchTouchEvent(ev)
        }
        val allowTouch = isTouchInside(binding.lockButton, ev) || isTouchInside(binding.closeButton, ev)
        return if (allowTouch) super.dispatchTouchEvent(ev) else true
    }

    private fun renderLockState() {
        binding.lockButton.text = if (locked) "\uD83D\uDD12" else "\uD83D\uDD13"
        binding.clearButton.isEnabled = !locked
        binding.applyButton.isEnabled = !locked
        binding.lockHint.text =
            if (locked) "Travado: use a S Pen para escrever e toque no cadeado para destravar."
            else "Destravado: dedo e caneta liberados."
    }

    private fun finishWithResult(applied: Boolean) {
        val data = Intent().apply {
            putExtra(EXTRA_TARGET_ID, targetId)
            putExtra(EXTRA_APPLIED, applied)
            putExtra(EXTRA_VALUE, binding.editText.text?.toString().orEmpty())
        }
        setResult(Activity.RESULT_OK, data)
        finish()
    }

    private fun isTouchInside(view: android.view.View, event: MotionEvent): Boolean {
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val x = event.rawX
        val y = event.rawY
        return x >= location[0] &&
            x <= location[0] + view.width &&
            y >= location[1] &&
            y <= location[1] + view.height
    }

    private fun enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun applyInsets() {
        val baseRootPaddingTop = binding.rootContainer.paddingTop
        val baseRootPaddingLeft = binding.rootContainer.paddingLeft
        val baseRootPaddingRight = binding.rootContainer.paddingRight
        val baseActionsPaddingBottom = binding.actionsContainer.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(binding.rootContainer) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            binding.rootContainer.setPadding(
                baseRootPaddingLeft + systemBars.left,
                baseRootPaddingTop + systemBars.top,
                baseRootPaddingRight + systemBars.right,
                binding.rootContainer.paddingBottom
            )
            binding.actionsContainer.setPadding(
                binding.actionsContainer.paddingLeft,
                binding.actionsContainer.paddingTop,
                binding.actionsContainer.paddingRight,
                baseActionsPaddingBottom + systemBars.bottom + 32
            )
            insets
        }
    }

    companion object {
        const val EXTRA_TARGET_ID = "target_id"
        const val EXTRA_TITLE = "title"
        const val EXTRA_VALUE = "value"
        const val EXTRA_APPLIED = "applied"
    }
}
