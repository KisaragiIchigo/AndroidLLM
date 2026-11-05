package app.hisoka.offline

import android.content.Context

/** Settings that must be known natively before the WebView exists. */
object DevicePrefs {
    private const val FILE = "hisoka_device"
    private const val KEY_SECURE_SCREEN = "secure_screen"

    fun secureScreen(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(KEY_SECURE_SCREEN, true)

    fun setSecureScreen(context: Context, enabled: Boolean) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(KEY_SECURE_SCREEN, enabled).apply()
    }
}
