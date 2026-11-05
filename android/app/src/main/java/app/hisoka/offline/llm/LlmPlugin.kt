package app.hisoka.offline.llm

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import app.hisoka.offline.media.AttachmentStore
import app.hisoka.offline.media.Prepared
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray

@CapacitorPlugin(name = "HisokaLlm")
class LlmPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var models: ModelStore
    private lateinit var engine: LlmEngine

    /** Payloads of the latest user turn stay in memory (never on disk) so that turn can be regenerated. */
    @Volatile private var lastTurnAttachments: Set<String> = emptySet()

    override fun load() {
        models = ModelStore(context)
        engine = LlmEngine(context)
    }

    @PluginMethod
    fun getModelStatus(call: PluginCall) {
        val file = models.locate()
        val result = JSObject()
            .put("present", file != null)
            .put("externalDir", models.externalDir.absolutePath)
            .put("loaded", engine.isLoaded)
            .put("backend", engine.backend)
        if (file != null) {
            result.put("fileName", file.name).put("sizeBytes", file.length())
        }
        models.bundledSize()?.let { result.put("bundledSizeBytes", it) }
        call.resolve(result)
    }

    @PluginMethod
    fun extractBundledModel(call: PluginCall) {
        scope.launch {
            try {
                engine.unload()
                val file = models.extractBundled { copied, total ->
                    notifyListeners("importProgress", JSObject().put("copied", copied).put("total", total))
                }
                call.resolve(JSObject().put("imported", true).put("sizeBytes", file.length()))
            } catch (t: Throwable) {
                call.reject(t.message ?: "同梱モデルの展開に失敗しました。")
            }
        }
    }

    @PluginMethod
    fun importModel(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(call, intent, "onModelPicked")
    }

    @ActivityCallback
    fun onModelPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            call.resolve(JSObject().put("imported", false))
            return
        }
        scope.launch {
            try {
                engine.unload()
                val file = models.importFrom(uri) { copied, total ->
                    notifyListeners("importProgress", JSObject().put("copied", copied).put("total", total))
                }
                call.resolve(JSObject().put("imported", true).put("sizeBytes", file.length()))
            } catch (t: Throwable) {
                call.reject(t.message ?: "モデルの取り込みに失敗しました。")
            }
        }
    }

    @PluginMethod
    fun deleteModel(call: PluginCall) {
        scope.launch {
            engine.unload()
            models.deleteAll()
            call.resolve()
        }
    }

    @PluginMethod
    fun loadEngine(call: PluginCall) {
        val preferGpu = call.getString("backend", "gpu") == "gpu"
        val maxTokens = call.getInt("maxTokens") ?: 8192
        val file = models.locate() ?: return call.reject("モデルファイルが見つかりません。")
        scope.launch {
            try {
                val loaded = engine.load(file.absolutePath, preferGpu, maxTokens)
                call.resolve(
                    JSObject()
                        .put("backend", loaded.backend)
                        .put("loadMs", loaded.loadMs)
                        .put("gpuError", loaded.gpuError),
                )
            } catch (t: Throwable) {
                call.reject(t.message ?: "モデルを読み込めませんでした。")
            }
        }
    }

    @PluginMethod
    fun unloadEngine(call: PluginCall) {
        scope.launch {
            engine.unload()
            call.resolve()
        }
    }

    @PluginMethod
    fun resetConversation(call: PluginCall) {
        val systemPrompt = call.getString("systemPrompt").orEmpty()
        val history = parseHistory(call.getArray("history"))
        scope.launch {
            try {
                engine.reset(systemPrompt, history)
                call.resolve()
            } catch (t: Throwable) {
                call.reject(t.message ?: "会話を初期化できませんでした。")
            }
        }
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val requestId = call.getString("requestId") ?: return call.reject("requestId がありません。")
        val text = call.getString("text").orEmpty()
        val attachmentIds = call.getArray("attachmentIds")?.toList<String>().orEmpty()
        val think = call.getBoolean("think", false) == true
        val thinkBudget = call.getInt("thinkBudget") ?: 1024

        val contents = try {
            buildContents(text, attachmentIds)
        } catch (e: AttachmentExpiredException) {
            return call.reject(e.message, ATTACHMENT_EXPIRED)
        } catch (t: Throwable) {
            return call.reject(t.message ?: "メッセージを組み立てられませんでした。")
        }
        (lastTurnAttachments - attachmentIds.toSet()).forEach { AttachmentStore.remove(it) }
        lastTurnAttachments = attachmentIds.toSet()

        engine.send(contents, think, thinkBudget, object : GenerationSink {
            override fun onDelta(text: String, thought: String) {
                emit(JSObject().put("requestId", requestId).put("type", "delta").put("text", text).put("thought", thought))
            }

            override fun onDone(stats: GenerationStats?) {
                val event = JSObject().put("requestId", requestId).put("type", "done")
                if (stats != null) {
                    event.put(
                        "stats",
                        JSObject()
                            .put("decodeTokens", stats.decodeTokens)
                            .put("tokensPerSecond", stats.decodeTokensPerSecond)
                            .put("timeToFirstTokenSec", stats.timeToFirstTokenSec)
                            .put("totalMs", stats.totalMs)
                            .put("backend", engine.backend),
                    )
                }
                emit(event)
            }

            override fun onCancelled() {
                emit(JSObject().put("requestId", requestId).put("type", "cancelled"))
            }

            override fun onError(message: String) {
                emit(JSObject().put("requestId", requestId).put("type", "error").put("message", message))
            }
        })
        call.resolve()
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        engine.cancel()
        call.resolve()
    }

    override fun handleOnDestroy() {
        engine.cancel()
        super.handleOnDestroy()
    }

    private fun emit(event: JSObject) = notifyListeners("llmEvent", event)

    private fun parseHistory(array: JSONArray?): List<Pair<String, String>> {
        if (array == null) return emptyList()
        return (0 until array.length()).map { i ->
            val item = array.getJSONObject(i)
            item.getString("role") to item.getString("text")
        }
    }

    private fun buildContents(text: String, attachmentIds: List<String>): Contents {
        val parts = mutableListOf<Content>()
        attachmentIds.forEach { id ->
            when (val prepared = AttachmentStore.get(id) ?: throw AttachmentExpiredException()) {
                is Prepared.Image -> parts += Content.ImageBytes(prepared.jpeg)
                is Prepared.Audio -> prepared.wavChunks.forEach { parts += Content.AudioBytes(it) }
                is Prepared.Video -> {
                    parts += Content.Text("（以下は動画から時系列順に取り出した ${prepared.frames.size} コマです）")
                    prepared.frames.forEach { parts += Content.ImageBytes(it) }
                    if (prepared.wavChunks.isNotEmpty()) {
                        parts += Content.Text("（以下は同じ動画の音声です）")
                        prepared.wavChunks.forEach { parts += Content.AudioBytes(it) }
                    }
                }
                is Prepared.Document -> {
                    if (prepared.pageImages.isNotEmpty()) {
                        parts += Content.Text("（添付文書「${prepared.name}」はスキャン画像のため、各ページを画像で渡します）")
                        prepared.pageImages.forEach { parts += Content.ImageBytes(it) }
                    } else {
                        parts += Content.Text("【添付文書: ${prepared.name}】\n${prepared.text}\n【添付文書ここまで】")
                    }
                }
            }
        }
        if (text.isNotBlank()) parts += Content.Text(text)
        check(parts.isNotEmpty()) { "送信する内容がありません。" }
        return Contents.of(parts)
    }

    private class AttachmentExpiredException : IllegalStateException("添付ファイルの有効期限が切れました。もう一度添付してください。")

    companion object {
        private const val ATTACHMENT_EXPIRED = "ATTACHMENT_EXPIRED"
    }
}
