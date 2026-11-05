package app.hisoka.offline.vault

import androidx.fragment.app.FragmentActivity
import app.hisoka.offline.DevicePrefs
import app.hisoka.offline.MainActivity
import app.hisoka.offline.security.AccessibilityAudit
import app.hisoka.offline.security.AuthCancelledException
import app.hisoka.offline.security.Authenticator
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

@CapacitorPlugin(name = "HisokaVault")
class VaultPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var keys: HistoryKeys
    private lateinit var vault: ConversationVault

    override fun load() {
        keys = HistoryKeys(context) { Authenticator.deviceSecure(context) }
        vault = ConversationVault(context, keys)
        scope.launch { runCatching { vault.migrateLegacy() } }
    }

    @PluginMethod
    fun status(call: PluginCall) = io(call) {
        JSObject()
            .put("historyLock", keys.effectiveAuthBound)
            .put("lockAvailable", Authenticator.deviceSecure(context))
            .put("keyStorage", if (keys.initialized) keys.storage.name.lowercase() else null)
            .put("accessibilityServices", JSArray(AccessibilityAudit.nonSystemServices(context)))
    }

    @PluginMethod
    fun openHistory(call: PluginCall) {
        scope.launch {
            try {
                if (keys.initialized && keys.authBound) {
                    Authenticator.authenticate(fragmentActivity(), "履歴を開く", "保存した会話を表示するには認証が必要です")
                }
                call.resolve(JSObject().put("items", vault.list()))
            } catch (t: Throwable) {
                reject(call, t)
            }
        }
    }

    @PluginMethod
    fun closeHistory(call: PluginCall) {
        keys.lockHistory()
        call.resolve()
    }

    @PluginMethod
    fun read(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id がありません。")
        io(call) {
            val json = vault.load(id) ?: throw IllegalStateException("会話が見つかりません。")
            JSObject().put("conversation", JSONObject(json))
        }
    }

    @PluginMethod
    fun save(call: PluginCall) {
        val conversation = call.getObject("conversation") ?: return call.reject("conversation がありません。")
        val summary = call.getObject("summary") ?: return call.reject("summary がありません。")
        val id = conversation.optString("id")
        io(call) {
            vault.save(id, conversation.toString(), summary)
            JSObject()
        }
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("id がありません。")
        io(call) {
            vault.remove(id)
            JSObject()
        }
    }

    /** Wiping is destructive, so it asks for the same authentication as reading whenever that is possible. */
    @PluginMethod
    fun removeAll(call: PluginCall) {
        scope.launch {
            try {
                if (keys.initialized && keys.authBound && Authenticator.deviceSecure(context)) {
                    Authenticator.authenticate(fragmentActivity(), "すべての会話を削除", "削除するには認証が必要です")
                }
                vault.removeAll()
                call.resolve()
            } catch (t: Throwable) {
                reject(call, t)
            }
        }
    }

    @PluginMethod
    fun setHistoryLock(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) == true
        if (enabled && !Authenticator.deviceSecure(context)) {
            return call.reject("端末に画面ロックが設定されていないため、履歴のロックは使えません。")
        }
        scope.launch {
            try {
                if (enabled || (keys.initialized && keys.authBound)) {
                    Authenticator.authenticate(fragmentActivity(), "履歴のロック設定を変更", "変更するには認証が必要です")
                }
                keys.rotate(enabled)
                keys.lockHistory()
                call.resolve(JSObject().put("historyLock", keys.authBound).put("keyStorage", keys.storage.name.lowercase()))
            } catch (t: Throwable) {
                reject(call, t)
            }
        }
    }

    @PluginMethod
    fun getSecureScreen(call: PluginCall) {
        call.resolve(JSObject().put("enabled", DevicePrefs.secureScreen(context)))
    }

    @PluginMethod
    fun setSecureScreen(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) == true
        DevicePrefs.setSecureScreen(context, enabled)
        activity.runOnUiThread {
            (activity as? MainActivity)?.applySecureScreen(enabled)
            call.resolve()
        }
    }

    override fun handleOnDestroy() {
        keys.lockHistory()
        super.handleOnDestroy()
    }

    private fun fragmentActivity(): FragmentActivity = activity as FragmentActivity

    private fun reject(call: PluginCall, t: Throwable) {
        when (t) {
            is AuthCancelledException -> call.reject(t.message ?: "認証されませんでした。", "AUTH_CANCELLED")
            is HistoryKeyInvalidatedException -> call.reject(t.message, "KEY_INVALIDATED")
            is HistoryLockedException -> call.reject(t.message, "HISTORY_LOCKED")
            else -> call.reject(t.message ?: "保存領域の操作に失敗しました。")
        }
    }

    private fun io(call: PluginCall, work: () -> JSObject) {
        scope.launch {
            try {
                call.resolve(work())
            } catch (t: Throwable) {
                reject(call, t)
            }
        }
    }
}
