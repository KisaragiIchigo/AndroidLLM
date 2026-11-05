package app.hisoka.offline

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import app.hisoka.offline.llm.LlmPlugin
import app.hisoka.offline.media.MediaPlugin
import app.hisoka.offline.vault.VaultPlugin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        applySecureScreen(DevicePrefs.secureScreen(this))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) window.setHideOverlayWindows(true)
        registerPlugin(LlmPlugin::class.java)
        registerPlugin(MediaPlugin::class.java)
        registerPlugin(VaultPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    fun applySecureScreen(enabled: Boolean) {
        if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }
}
