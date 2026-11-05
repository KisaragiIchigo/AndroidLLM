package app.hisoka.offline.media

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(
    name = "HisokaMedia",
    permissions = [Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO])],
)
class MediaPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var recorder: AudioRecorder? = null
    private var pendingCapture: File? = null

    @PluginMethod
    fun pick(call: PluginCall) {
        val kind = call.getString("kind") ?: return call.reject("kind が指定されていません。")
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            when (kind) {
                "image" -> {
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                "audio" -> type = "audio/*"
                "video" -> type = "video/*"
                "document" -> {
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, DOCUMENT_MIME_TYPES)
                }
                else -> return call.reject("未対応の種類です: $kind")
            }
        }
        startActivityForResult(call, intent, "onPicked")
    }

    @ActivityCallback
    fun onPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.resolve(JSObject().put("attachments", JSArray()))
            return
        }
        val data = result.data!!
        val uris = buildList {
            val clip = data.clipData
            if (clip != null) {
                for (i in 0 until minOf(clip.itemCount, MAX_IMAGES_PER_PICK)) add(clip.getItemAt(i).uri)
            } else {
                data.data?.let { add(it) }
            }
        }
        val kind = call.getString("kind")!!
        val maxChars = call.getInt("maxChars") ?: DEFAULT_MAX_CHARS
        process(call) { uris.map { prepare(kind, it, maxChars) } }
    }

    @PluginMethod
    fun capturePhoto(call: PluginCall) {
        val dir = File(context.cacheDir, "capture").apply { mkdirs() }
        val file = File(dir, "capture_${System.currentTimeMillis()}.jpg")
        pendingCapture = file
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "onCaptured")
    }

    @ActivityCallback
    fun onCaptured(call: PluginCall?, result: ActivityResult) {
        val file = pendingCapture
        pendingCapture = null
        if (call == null) {
            file?.delete()
            return
        }
        if (result.resultCode != Activity.RESULT_OK || file == null || !file.exists() || file.length() == 0L) {
            file?.delete()
            call.resolve(JSObject().put("attachments", JSArray()))
            return
        }
        process(call) {
            try {
                val bitmap = ImagePrep.decode(file)
                listOf(imageMeta(bitmap, "カメラ ${java.text.SimpleDateFormat("HH:mm", java.util.Locale.JAPAN).format(java.util.Date())}", file.length()))
            } finally {
                file.delete()
            }
        }
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "onMicPermission")
            return
        }
        beginRecording(call)
    }

    @PermissionCallback
    fun onMicPermission(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            beginRecording(call)
        } else {
            call.reject("マイクの使用が許可されていません。設定アプリから許可してください。")
        }
    }

    private fun beginRecording(call: PluginCall) {
        recorder?.stop()
        val next = AudioRecorder(RECORD_MAX_SECONDS) { level, elapsedMs ->
            notifyListeners("recordLevel", JSObject().put("level", level).put("elapsedMs", elapsedMs))
        }
        try {
            next.start()
            recorder = next
            call.resolve(JSObject().put("maxSeconds", RECORD_MAX_SECONDS))
        } catch (t: Throwable) {
            call.reject(t.message ?: "録音を開始できませんでした。")
        }
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        val active = recorder ?: return call.reject("録音していません。")
        recorder = null
        process(call) {
            val pcm = active.stop()
            check(pcm.isNotEmpty()) { "録音データが空でした。" }
            val chunks = AudioPcm.chunkToWav(pcm)
            val id = AttachmentStore.put(Prepared.Audio(chunks))
            listOf(
                JSObject()
                    .put("id", id)
                    .put("kind", "audio")
                    .put("name", "ボイスメモ")
                    .put("mime", "audio/wav")
                    .put("durationMs", AudioPcm.durationMs(pcm))
                    .put("segments", chunks.size)
                    .put("wave", JSArray(AudioPcm.waveform(pcm))),
            )
        }
    }

    @PluginMethod
    fun cancelRecording(call: PluginCall) {
        recorder?.stop()
        recorder = null
        call.resolve()
    }

    @PluginMethod
    fun discard(call: PluginCall) {
        val ids = call.getArray("ids")?.toList<String>().orEmpty()
        ids.forEach { AttachmentStore.remove(it) }
        call.resolve()
    }

    override fun handleOnDestroy() {
        recorder?.stop()
        recorder = null
        super.handleOnDestroy()
    }

    private fun process(call: PluginCall, work: () -> List<JSObject>) {
        scope.launch {
            try {
                val metas = work()
                call.resolve(JSObject().put("attachments", JSArray(metas)))
            } catch (t: Throwable) {
                call.reject(t.message ?: "添付ファイルを処理できませんでした。")
            }
        }
    }

    private fun prepare(kind: String, uri: Uri, maxChars: Int): JSObject {
        val (name, size) = describe(uri)
        val mime = context.contentResolver.getType(uri).orEmpty()
        return when (kind) {
            "image" -> imageMeta(ImagePrep.decode(context, uri), name, size)
            "audio" -> {
                val decoded = AudioPcm.decode(context, uri, AUDIO_MAX_SECONDS)
                    ?: throw IllegalStateException("音声トラックが見つかりませんでした。")
                check(decoded.pcm.isNotEmpty()) { "音声を読み取れませんでした。" }
                val chunks = AudioPcm.chunkToWav(decoded.pcm)
                val id = AttachmentStore.put(Prepared.Audio(chunks))
                JSObject()
                    .put("id", id).put("kind", "audio").put("name", name).put("mime", mime).put("sizeBytes", size)
                    .put("durationMs", if (decoded.sourceDurationMs > 0) decoded.sourceDurationMs else AudioPcm.durationMs(decoded.pcm))
                    .put("segments", chunks.size)
                    .put("truncated", decoded.truncated)
                    .put("wave", JSArray(AudioPcm.waveform(decoded.pcm)))
            }
            "video" -> {
                val video = VideoPrep.frames(context, uri)
                val audio = runCatching { AudioPcm.decode(context, uri, VIDEO_AUDIO_SECONDS) }.getOrNull()
                val chunks = audio?.pcm?.takeIf { it.isNotEmpty() }?.let { AudioPcm.chunkToWav(it) }.orEmpty()
                val frames = video.frames.map { ImagePrep.jpeg(it, 85) }
                val thumb = ImagePrep.thumbDataUrl(video.frames[video.frames.size / 2])
                val id = AttachmentStore.put(Prepared.Video(frames, chunks, video.durationMs))
                JSObject()
                    .put("id", id).put("kind", "video").put("name", name).put("mime", mime).put("sizeBytes", size)
                    .put("durationMs", video.durationMs)
                    .put("frames", frames.size)
                    .put("segments", chunks.size)
                    .put("truncated", video.durationMs > VIDEO_AUDIO_SECONDS * 1000L && chunks.isNotEmpty())
                    .put("thumb", thumb)
            }
            "document" -> {
                val doc = DocumentText.extract(context, uri, name, mime, maxChars)
                check(doc.text.isNotBlank() || doc.pageImages.isNotEmpty()) { "文書から本文を取り出せませんでした。" }
                val pageImages = doc.pageImages.map { ImagePrep.jpeg(ImagePrep.scaleDown(it, ImagePrep.MODEL_MAX_SIDE), 85) }
                val id = AttachmentStore.put(Prepared.Document(name, doc.text, pageImages))
                JSObject()
                    .put("id", id).put("kind", "document").put("name", name).put("mime", mime).put("sizeBytes", size)
                    .put("chars", doc.text.length)
                    .put("truncated", doc.truncated)
                    .put("scanned", doc.text.isBlank())
                    .put("text", doc.text)
                    .apply { doc.pages?.let { put("pages", it) } }
            }
            else -> throw IllegalArgumentException("未対応の種類です: $kind")
        }
    }

    private fun imageMeta(bitmap: android.graphics.Bitmap, name: String, size: Long): JSObject {
        val id = AttachmentStore.put(Prepared.Image(ImagePrep.jpeg(bitmap)))
        return JSObject()
            .put("id", id).put("kind", "image").put("name", name).put("mime", "image/jpeg").put("sizeBytes", size)
            .put("width", bitmap.width).put("height", bitmap.height)
            .put("thumb", ImagePrep.thumbDataUrl(bitmap))
    }

    private fun describe(uri: Uri): Pair<String, Long> =
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                (c.getString(0) ?: "file") to (if (c.isNull(1)) -1L else c.getLong(1))
            } else "file" to -1L
        } ?: ("file" to -1L)

    companion object {
        private const val MAX_IMAGES_PER_PICK = 6
        private const val DEFAULT_MAX_CHARS = 6_000
        const val AUDIO_MAX_SECONDS = 120
        const val VIDEO_AUDIO_SECONDS = 60
        const val RECORD_MAX_SECONDS = 120
        private val DOCUMENT_MIME_TYPES = arrayOf(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/*",
            "application/json",
            "application/xml",
            "application/x-subrip",
        )
    }
}
