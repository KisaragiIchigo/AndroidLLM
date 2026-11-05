package app.hisoka.offline

import android.content.Context
import android.util.AttributeSet
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import com.getcapacitor.CapacitorWebView

/**
 * Asks the keyboard not to learn from or sync anything typed into the app
 * (IME_FLAG_NO_PERSONALIZED_LEARNING), which a stock WebView never requests, and drops touches
 * that arrive while another app's window covers this one (tapjacking).
 */
class SecureWebView(context: Context, attrs: AttributeSet?) : CapacitorWebView(context, attrs) {
    init {
        filterTouchesWhenObscured = true
    }

    override fun onCreateInputConnection(outAttrs: EditorInfo): InputConnection? {
        val connection = super.onCreateInputConnection(outAttrs)
        outAttrs.imeOptions = outAttrs.imeOptions or EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING
        return connection
    }
}
