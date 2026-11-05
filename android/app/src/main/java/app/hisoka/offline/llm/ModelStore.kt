package app.hisoka.offline.llm

import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.os.SystemClock
import android.provider.OpenableColumns
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

/**
 * Locates the .litertlm model. Three sources are accepted:
 * - internal storage, filled by [importFrom] (system file picker) or [extractBundled] (APK asset)
 * - the app-specific external folder, which a PC can write to directly over USB
 * LiteRT-LM only opens real file paths, so a bundled asset must be copied out before use.
 */
class ModelStore(private val context: Context) {

    private val internalDir: File get() = File(context.filesDir, "models")

    val externalDir: File
        get() = File(context.getExternalFilesDir(null), "models").apply { mkdirs() }

    fun locate(): File? {
        File(internalDir, MODEL_FILE).takeIf { it.isFile && it.length() > 0 }?.let { return it }
        return externalDir
            .listFiles { f -> f.isFile && f.name.endsWith(MODEL_SUFFIX) }
            ?.maxByOrNull { it.length() }
    }

    /** Size of the model packed into the APK (bundled flavor only), or null when absent. */
    fun bundledSize(): Long? =
        runCatching { context.assets.openFd(BUNDLED_ASSET).use { it.length } }.getOrNull()

    fun displayName(uri: Uri): String? =
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }

    private fun size(uri: Uri): Long =
        context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else -1L
        } ?: -1L

    fun importFrom(uri: Uri, onProgress: (copied: Long, total: Long) -> Unit): File {
        val name = displayName(uri).orEmpty()
        require(name.endsWith(MODEL_SUFFIX)) { "選択されたファイルは .litertlm 形式ではありません。" }
        val input = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("ファイルを開けませんでした。")
        return install(input, size(uri), onProgress)
    }

    fun extractBundled(onProgress: (copied: Long, total: Long) -> Unit): File {
        val total = bundledSize() ?: throw IllegalStateException("この APK にはモデルが同梱されていません。")
        return install(context.assets.open(BUNDLED_ASSET), total, onProgress)
    }

    private fun install(input: InputStream, total: Long, onProgress: (copied: Long, total: Long) -> Unit): File {
        internalDir.mkdirs()
        val free = StatFs(internalDir.path).availableBytes
        if (total > 0 && free < total + SPACE_MARGIN) {
            input.close()
            throw IllegalStateException("空き容量が不足しています。あと ${(total + SPACE_MARGIN - free) / MB} MB 必要です。")
        }

        val part = File(internalDir, "$MODEL_FILE.part")
        try {
            input.use { inp ->
                FileOutputStream(part).use { out ->
                    val buffer = ByteArray(1 shl 20)
                    var copied = 0L
                    var lastReport = 0L
                    while (true) {
                        val read = inp.read(buffer)
                        if (read < 0) break
                        out.write(buffer, 0, read)
                        copied += read
                        val now = SystemClock.elapsedRealtime()
                        if (now - lastReport > PROGRESS_INTERVAL_MS) {
                            lastReport = now
                            onProgress(copied, total)
                        }
                    }
                    out.fd.sync()
                    onProgress(copied, total)
                }
            }
            val target = File(internalDir, MODEL_FILE)
            target.delete()
            if (!part.renameTo(target)) throw IllegalStateException("モデルの保存に失敗しました。")
            return target
        } catch (t: Throwable) {
            part.delete()
            throw t
        }
    }

    fun deleteAll() {
        File(internalDir, MODEL_FILE).delete()
        File(internalDir, "$MODEL_FILE.part").delete()
        externalDir.listFiles { f -> f.name.endsWith(MODEL_SUFFIX) }?.forEach { it.delete() }
    }

    companion object {
        const val MODEL_FILE = "model.litertlm"
        const val MODEL_SUFFIX = ".litertlm"
        private const val BUNDLED_ASSET = "models/gemma-4-E2B-it.litertlm"
        private const val MB = 1024L * 1024L
        private const val SPACE_MARGIN = 512L * MB
        private const val PROGRESS_INTERVAL_MS = 150L
    }
}
