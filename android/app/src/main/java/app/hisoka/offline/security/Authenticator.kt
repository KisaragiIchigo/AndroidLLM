package app.hisoka.offline.security

import android.content.Context
import android.app.KeyguardManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

class AuthCancelledException(message: String) : Exception(message)

/** Biometric (class 3) or screen-lock credential, which is what time-bound Keystore keys accept. */
object Authenticator {

    fun deviceSecure(context: Context): Boolean =
        context.getSystemService(KeyguardManager::class.java)?.isDeviceSecure == true

    suspend fun authenticate(activity: FragmentActivity, title: String, subtitle: String): Unit =
        suspendCancellableCoroutine { cont ->
            activity.runOnUiThread {
                val prompt = BiometricPrompt(
                    activity,
                    ContextCompat.getMainExecutor(activity),
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            if (cont.isActive) cont.resume(Unit)
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            if (cont.isActive) cont.resumeWithException(AuthCancelledException(errString.toString()))
                        }
                    },
                )
                prompt.authenticate(
                    BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
                        .build(),
                )
                cont.invokeOnCancellation { activity.runOnUiThread { prompt.cancelAuthentication() } }
            }
        }
}
