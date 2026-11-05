package app.hisoka.offline.vault

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import android.security.keystore.UserNotAuthenticatedException
import android.os.Build
import java.io.File
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.security.spec.MGF1ParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.OAEPParameterSpec
import javax.crypto.spec.PSource

enum class KeyStorage { STRONGBOX, TEE, SOFTWARE }

class HistoryLockedException : IllegalStateException("履歴を開くには認証が必要です。")
class HistoryKeyInvalidatedException : IllegalStateException("端末の画面ロックが変更されたため、保存済みの会話を復号できません。")

/**
 * Writing history never needs the user; reading it does. Each app process encrypts with a fresh
 * session AES key that is persisted only RSA-OAEP-wrapped. The RSA private key stays in the
 * Keystore (StrongBox when available) and, with the history lock on, works only for a short
 * window after biometric or screen-lock authentication.
 */
class HistoryKeys(context: Context, private val deviceSecure: () -> Boolean) {

    private val keyDir = File(context.filesDir, "vault/keys").apply { mkdirs() }
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val random = SecureRandom()
    private val unwrapped = HashMap<String, ByteArray>()
    private var session: Pair<String, ByteArray>? = null

    val authBound: Boolean get() = prefs.getBoolean(KEY_AUTH_BOUND, false)
    val initialized: Boolean get() = prefs.getString(KEY_ALIAS, null) != null
    val storage: KeyStorage
        get() = runCatching { KeyStorage.valueOf(prefs.getString(KEY_STORAGE, null)!!) }.getOrDefault(KeyStorage.TEE)

    /** The lock state a not-yet-created key pair would get: on whenever the device has a screen lock. */
    val effectiveAuthBound: Boolean get() = if (initialized) authBound else deviceSecure()

    @Synchronized
    fun sessionKey(): Pair<String, ByteArray> {
        session?.let { return it }
        if (!initialized) commitKeyPair(createKeyPair(deviceSecure()))
        val key = ByteArray(32).also(random::nextBytes)
        val sid = ByteArray(SID_BYTES).also(random::nextBytes).toHex()
        writeAtomic(keyFile(sid), wrap(key, publicKey(alias())))
        return (sid to key).also { session = it }
    }

    /** Opens the given session keys with the private key; call right after authentication when the lock is on. */
    @Synchronized
    fun unlock(sids: Collection<String>) {
        val missing = sids.toSet().filter { it != session?.first && it !in unwrapped && keyFile(it).exists() }
        if (missing.isEmpty()) return
        val private = privateKey(alias())
        missing.forEach { sid -> unwrapped[sid] = unwrap(keyFile(sid).readBytes(), private) }
    }

    @Synchronized
    fun keyFor(sid: String): ByteArray? = session?.takeIf { it.first == sid }?.second ?: unwrapped[sid]

    /** Forgets every opened key except the current session's, overwriting them in memory. */
    @Synchronized
    fun lockHistory() {
        unwrapped.values.forEach { it.fill(0) }
        unwrapped.clear()
    }

    @Synchronized
    fun pruneUnreferenced(referenced: Set<String>) {
        keyDir.listFiles()?.forEach { file ->
            val sid = file.name.removePrefix("k_").removeSuffix(".bin")
            if (sid != session?.first && sid !in referenced) file.delete()
        }
    }

    /** Re-wraps every stored session key under a new key pair. Old keys must be unlockable (auth done). */
    @Synchronized
    fun rotate(authBound: Boolean) {
        val sids = keyDir.listFiles()?.map { it.name.removePrefix("k_").removeSuffix(".bin") }.orEmpty()
        unlock(sids)
        val oldAlias = prefs.getString(KEY_ALIAS, null)
        val next = createKeyPair(authBound)
        val public = publicKey(next.alias)
        val staged = sids.mapNotNull { sid ->
            keyFor(sid)?.let { key -> File(keyDir, "k_$sid.bin.next").also { it.writeBytes(wrap(key, public)) } }
        }
        staged.forEach { it.renameTo(File(keyDir, it.name.removeSuffix(".next"))) }
        commitKeyPair(next)
        oldAlias?.let { runCatching { keystore().deleteEntry(it) } }
    }

    @Synchronized
    fun destroyAll() {
        lockHistory()
        session?.second?.fill(0)
        session = null
        keyDir.listFiles()?.forEach { it.delete() }
        prefs.getString(KEY_ALIAS, null)?.let { runCatching { keystore().deleteEntry(it) } }
        prefs.edit().remove(KEY_ALIAS).remove(KEY_AUTH_BOUND).remove(KEY_STORAGE).apply()
    }

    private class NewKeyPair(val alias: String, val authBound: Boolean, val storage: KeyStorage)

    private fun createKeyPair(authBound: Boolean): NewKeyPair {
        val alias = "hisoka_history_${System.currentTimeMillis()}"
        fun spec(strongBox: Boolean) = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(2048)
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
            .setIsStrongBoxBacked(strongBox)
            .apply {
                if (authBound) {
                    setUserAuthenticationRequired(true)
                    setUserAuthenticationParameters(AUTH_VALIDITY_SECONDS, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
                    setInvalidatedByBiometricEnrollment(false)
                }
            }
            .build()

        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE)
        val strongBox = try {
            generator.initialize(spec(true))
            generator.generateKeyPair()
            true
        } catch (_: StrongBoxUnavailableException) {
            generator.initialize(spec(false))
            generator.generateKeyPair()
            false
        }
        return NewKeyPair(alias, authBound, if (strongBox) KeyStorage.STRONGBOX else securityLevel(alias))
    }

    private fun commitKeyPair(pair: NewKeyPair) {
        prefs.edit()
            .putString(KEY_ALIAS, pair.alias)
            .putBoolean(KEY_AUTH_BOUND, pair.authBound)
            .putString(KEY_STORAGE, pair.storage.name)
            .commit()
    }

    private fun securityLevel(alias: String): KeyStorage {
        val key = keystore().getKey(alias, null) as PrivateKey
        val info = KeyFactory.getInstance(key.algorithm, KEYSTORE).getKeySpec(key, KeyInfo::class.java)
        return if (Build.VERSION.SDK_INT >= 31) {
            when (info.securityLevel) {
                KeyProperties.SECURITY_LEVEL_STRONGBOX -> KeyStorage.STRONGBOX
                KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> KeyStorage.TEE
                else -> KeyStorage.SOFTWARE
            }
        } else {
            @Suppress("DEPRECATION")
            if (info.isInsideSecureHardware) KeyStorage.TEE else KeyStorage.SOFTWARE
        }
    }

    private fun alias(): String = prefs.getString(KEY_ALIAS, null) ?: throw HistoryKeyInvalidatedException()

    private fun keystore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    /** Encryption needs no authentication, so it runs on a software copy of the public key. */
    private fun publicKey(alias: String): PublicKey {
        val keystorePublic = keystore().getCertificate(alias)?.publicKey ?: throw HistoryKeyInvalidatedException()
        return KeyFactory.getInstance(keystorePublic.algorithm).generatePublic(X509EncodedKeySpec(keystorePublic.encoded))
    }

    private fun privateKey(alias: String): PrivateKey =
        keystore().getKey(alias, null) as? PrivateKey ?: throw HistoryKeyInvalidatedException()

    private fun wrap(key: ByteArray, public: PublicKey): ByteArray {
        val cipher = Cipher.getInstance(RSA_OAEP)
        cipher.init(Cipher.ENCRYPT_MODE, public, OAEP)
        return cipher.doFinal(key)
    }

    private fun unwrap(wrapped: ByteArray, private: PrivateKey): ByteArray {
        val cipher = Cipher.getInstance(RSA_OAEP)
        try {
            cipher.init(Cipher.DECRYPT_MODE, private, OAEP)
        } catch (_: KeyPermanentlyInvalidatedException) {
            throw HistoryKeyInvalidatedException()
        } catch (_: UserNotAuthenticatedException) {
            throw HistoryLockedException()
        }
        return cipher.doFinal(wrapped)
    }

    private fun keyFile(sid: String) = File(keyDir, "k_$sid.bin")

    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val PREFS = "hisoka_vault"
        private const val KEY_ALIAS = "history_alias"
        private const val KEY_AUTH_BOUND = "history_auth_bound"
        private const val KEY_STORAGE = "history_storage"
        private const val RSA_OAEP = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding"
        const val SID_BYTES = 16
        const val AUTH_VALIDITY_SECONDS = 30

        // Keystore OAEP supports MGF1 with SHA-1 on every API level, so pin it explicitly on both sides.
        private val OAEP = OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT)
    }
}

fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

fun String.hexToBytes(): ByteArray = chunked(2).map { it.toInt(16).toByte() }.toByteArray()

fun writeAtomic(target: File, bytes: ByteArray) {
    val tmp = File(target.parentFile, target.name + ".tmp")
    tmp.writeBytes(bytes)
    if (!tmp.renameTo(target)) {
        target.delete()
        check(tmp.renameTo(target)) { "保存に失敗しました。" }
    }
}
