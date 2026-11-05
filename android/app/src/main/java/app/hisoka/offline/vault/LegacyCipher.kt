package app.hisoka.offline.vault

import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The v1 vault format (AES-256-GCM, Keystore key without user authentication, 12-byte IV || ciphertext+tag).
 * Kept only to migrate existing history into the v3 format; it never encrypts new data.
 */
object LegacyCipher {
    private const val KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "hisoka_vault_v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128

    fun exists(): Boolean = KeyStore.getInstance(KEYSTORE).apply { load(null) }.containsAlias(ALIAS)

    private fun key(): SecretKey =
        KeyStore.getInstance(KEYSTORE).apply { load(null) }.getKey(ALIAS, null) as SecretKey

    fun decrypt(sealed: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
        return cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES)
    }

    fun destroyKey() {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS)
    }
}
