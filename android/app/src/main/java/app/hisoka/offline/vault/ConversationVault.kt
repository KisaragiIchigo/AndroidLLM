package app.hisoka.offline.vault

import android.content.Context
import java.io.File
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONArray
import org.json.JSONObject

/**
 * Encrypted conversation store (format v3). Each conversation has a body file and a summary file,
 * so saving never has to read anything back — which is what keeps writes free of authentication.
 * File layout: "HSK3" || session id (16) || IV (12) || AES-256-GCM ciphertext+tag.
 */
class ConversationVault(context: Context, private val keys: HistoryKeys) {

    private val dir = File(context.filesDir, "vault").apply { mkdirs() }
    private val random = SecureRandom()

    @Synchronized
    fun save(id: String, conversationJson: String, summary: JSONObject) {
        val (sid, key) = keys.sessionKey()
        writeSealed(bodyFile(id), conversationJson, sid, key)
        writeSealed(summaryFile(id), summary.toString(), sid, key)
    }

    /** Requires the history to be unlockable (authenticated when the lock is on). */
    @Synchronized
    fun list(): JSONArray {
        val summaries = files(SUMMARY_PREFIX)
        val bodies = files(BODY_PREFIX)
        keys.unlock((summaries + bodies).mapNotNull { sidOf(it) })

        val items = summaries.mapNotNull { file -> runCatching { JSONObject(open(file.readBytes())) }.getOrNull() }
            .sortedByDescending { it.optLong("updatedAt") }

        compact(summaries + bodies)
        keys.pruneUnreferenced((files(SUMMARY_PREFIX) + files(BODY_PREFIX)).mapNotNull { sidOf(it) }.toSet())
        return JSONArray(items)
    }

    @Synchronized
    fun load(id: String): String? {
        val file = bodyFile(id)
        if (!file.exists()) return null
        sidOf(file)?.let { keys.unlock(listOf(it)) }
        return open(file.readBytes())
    }

    @Synchronized
    fun remove(id: String) {
        bodyFile(id).delete()
        summaryFile(id).delete()
    }

    @Synchronized
    fun removeAll() {
        dir.listFiles()?.filter { it.isFile }?.forEach { it.delete() }
        keys.destroyAll()
        runCatching { LegacyCipher.destroyKey() }
    }

    /**
     * Moves v1 history (one index file + bodies under a non-authenticated key) into v3. Needs no
     * authentication because v3 writes only use the public key.
     */
    @Synchronized
    fun migrateLegacy() {
        val legacyIndex = File(dir, LEGACY_INDEX)
        val legacyBodies = files(BODY_PREFIX).filter { !isSealed(it) }
        if (!legacyIndex.exists() && legacyBodies.isEmpty()) {
            if (LegacyCipher.exists()) LegacyCipher.destroyKey()
            return
        }
        if (!LegacyCipher.exists()) {
            legacyIndex.delete()
            legacyBodies.forEach { it.delete() }
            return
        }

        val summaries = runCatching { JSONArray(String(LegacyCipher.decrypt(legacyIndex.readBytes()), Charsets.UTF_8)) }
            .getOrElse { JSONArray() }
        val byId = (0 until summaries.length()).map { summaries.getJSONObject(it) }.associateBy { it.optString("id") }
        val (sid, key) = keys.sessionKey()
        legacyBodies.forEach { file ->
            val id = file.name.removePrefix(BODY_PREFIX).removeSuffix(SUFFIX)
            val plain = LegacyCipher.decrypt(file.readBytes())
            writeSealed(bodyFile(id), String(plain, Charsets.UTF_8), sid, key)
            plain.fill(0)
            byId[id]?.let { writeSealed(summaryFile(id), it.toString(), sid, key) }
        }
        legacyIndex.delete()
        LegacyCipher.destroyKey()
    }

    /** Re-encrypts files written in older sessions under the current session key so old keys can be dropped. */
    private fun compact(files: List<File>) {
        val (sid, key) = keys.sessionKey()
        files.filter { sidOf(it)?.let { s -> s != sid && keys.keyFor(s) != null } == true }.forEach { file ->
            writeSealed(file, open(file.readBytes()), sid, key)
        }
    }

    private fun writeSealed(target: File, text: String, sid: String, key: ByteArray) {
        val plain = text.toByteArray(Charsets.UTF_8)
        val iv = ByteArray(IV_BYTES).also(random::nextBytes)
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
        val sealed = MAGIC + sid.hexToBytes() + iv + cipher.doFinal(plain)
        plain.fill(0)
        writeAtomic(target, sealed)
    }

    private fun open(sealed: ByteArray): String {
        check(sealed.size > HEADER_BYTES && sealed.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)) { "履歴ファイルの形式が不正です。" }
        val sid = sealed.copyOfRange(MAGIC.size, MAGIC.size + HistoryKeys.SID_BYTES).toHex()
        val key = keys.keyFor(sid) ?: throw HistoryLockedException()
        val cipher = Cipher.getInstance(AES_GCM)
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, sealed, MAGIC.size + HistoryKeys.SID_BYTES, IV_BYTES))
        val plain = cipher.doFinal(sealed, HEADER_BYTES, sealed.size - HEADER_BYTES)
        return String(plain, Charsets.UTF_8).also { plain.fill(0) }
    }

    private fun isSealed(file: File): Boolean =
        file.inputStream().use { input -> ByteArray(MAGIC.size).also { input.read(it) } }.contentEquals(MAGIC)

    private fun sidOf(file: File): String? {
        if (!isSealed(file)) return null
        return file.inputStream().use { input ->
            input.skip(MAGIC.size.toLong())
            ByteArray(HistoryKeys.SID_BYTES).also { input.read(it) }.toHex()
        }
    }

    private fun files(prefix: String): List<File> =
        dir.listFiles { f -> f.isFile && f.name.startsWith(prefix) && f.name.endsWith(SUFFIX) }?.toList().orEmpty()

    private fun bodyFile(id: String): File {
        require(ID_PATTERN.matches(id)) { "不正な会話IDです。" }
        return File(dir, "$BODY_PREFIX$id$SUFFIX")
    }

    private fun summaryFile(id: String): File {
        require(ID_PATTERN.matches(id)) { "不正な会話IDです。" }
        return File(dir, "$SUMMARY_PREFIX$id$SUFFIX")
    }

    companion object {
        private val ID_PATTERN = Regex("^[A-Za-z0-9_-]{1,64}$")
        private val MAGIC = "HSK3".toByteArray(Charsets.US_ASCII)
        private const val AES_GCM = "AES/GCM/NoPadding"
        private const val IV_BYTES = 12
        private const val TAG_BITS = 128
        private val HEADER_BYTES = MAGIC.size + HistoryKeys.SID_BYTES + IV_BYTES
        private const val BODY_PREFIX = "c_"
        private const val SUMMARY_PREFIX = "s_"
        private const val SUFFIX = ".bin"
        private const val LEGACY_INDEX = "index.bin"
    }
}
