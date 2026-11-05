@file:OptIn(com.google.ai.edge.litertlm.ExperimentalApi::class)

package app.hisoka.offline.llm

import android.content.Context
import android.os.SystemClock
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.ExperimentalFlags
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class LoadResult(val backend: String, val loadMs: Long, val gpuError: String?)

data class GenerationStats(
    val decodeTokens: Int,
    val decodeTokensPerSecond: Double,
    val timeToFirstTokenSec: Double,
    val totalMs: Long,
)

interface GenerationSink {
    fun onDelta(text: String, thought: String)
    fun onDone(stats: GenerationStats?)
    fun onCancelled()
    fun onError(message: String)
}

/**
 * Owns the LiteRT-LM engine and the single live conversation.
 * Every native call runs on one dedicated thread; only [cancel] crosses threads,
 * which is what Conversation.cancelProcess() is designed for.
 */
class LlmEngine(private val context: Context) {

    private val dispatcher = Executors.newSingleThreadExecutor { r -> Thread(r, "hisoka-llm") }.asCoroutineDispatcher()
    private val scope = CoroutineScope(SupervisorJob() + dispatcher)

    private var engine: Engine? = null
    private var conversation: Conversation? = null
    private var generation: Job? = null
    @Volatile private var cancelRequested = false

    var backend: String? = null
        private set

    val isLoaded: Boolean get() = engine != null

    suspend fun load(modelPath: String, preferGpu: Boolean, maxTokens: Int): LoadResult = withContext(dispatcher) {
        stopGeneration()
        closeAll()
        ExperimentalFlags.enableBenchmark = true
        ExperimentalFlags.visualTokenBudget = VISUAL_TOKEN_BUDGET

        val started = SystemClock.elapsedRealtime()
        var gpuError: String? = null
        if (preferGpu) {
            try {
                engine = create(modelPath, Backend.GPU(), Backend.GPU(), maxTokens)
                backend = "gpu"
                return@withContext LoadResult("gpu", SystemClock.elapsedRealtime() - started, null)
            } catch (t: Throwable) {
                gpuError = t.message ?: t.javaClass.simpleName
            }
        }
        engine = create(modelPath, Backend.CPU(), Backend.CPU(), maxTokens)
        backend = "cpu"
        LoadResult("cpu", SystemClock.elapsedRealtime() - started, gpuError)
    }

    private fun create(modelPath: String, main: Backend, vision: Backend, maxTokens: Int): Engine {
        val config = EngineConfig(
            modelPath = modelPath,
            backend = main,
            visionBackend = vision,
            audioBackend = Backend.CPU(),
            maxNumTokens = maxTokens,
            maxNumImages = MAX_IMAGES,
            cacheDir = context.cacheDir.path,
        )
        val created = Engine(config)
        try {
            created.initialize()
        } catch (t: Throwable) {
            runCatching { created.close() }
            throw t
        }
        return created
    }

    suspend fun unload() = withContext(dispatcher) {
        stopGeneration()
        closeAll()
    }

    suspend fun reset(systemPrompt: String, history: List<Pair<String, String>>) = withContext(dispatcher) {
        stopGeneration()
        val current = engine ?: throw IllegalStateException("モデルが読み込まれていません。")
        conversation?.let { runCatching { it.close() } }
        conversation = null
        val initial = history.map { (role, text) -> if (role == "user") Message.user(text) else Message.model(text) }
        conversation = current.createConversation(
            ConversationConfig(
                systemInstruction = systemPrompt.takeIf { it.isNotBlank() }?.let { Contents.of(it) },
                initialMessages = initial,
                samplerConfig = SamplerConfig(topK = TOP_K, topP = TOP_P, temperature = TEMPERATURE),
            ),
        )
    }

    fun send(contents: Contents, think: Boolean, thinkBudget: Int, sink: GenerationSink) {
        cancelRequested = false
        generation = scope.launch {
            val conv = conversation
            if (conv == null) {
                sink.onError("会話が初期化されていません。")
                return@launch
            }
            val started = SystemClock.elapsedRealtime()
            val text = StringBuilder()
            val thought = StringBuilder()
            var lastFlush = 0L

            fun flush() {
                if (text.isEmpty() && thought.isEmpty()) return
                sink.onDelta(text.toString(), thought.toString())
                text.setLength(0)
                thought.setLength(0)
                lastFlush = SystemClock.elapsedRealtime()
            }

            try {
                // Thinking is toggled through the chat template flag, exactly as Google AI Edge Gallery does;
                // ThinkingConfig is only attached when a budget actually applies.
                conv.sendMessageAsync(
                    contents,
                    extraContext = mapOf("enable_thinking" to think),
                    thinkingConfig = if (think) ThinkingConfig(enableThinking = true, thinkingTokenBudget = thinkBudget) else null,
                ).collect { message ->
                    message.contents.contents.forEach { if (it is Content.Text) text.append(it.text) }
                    message.channels[THOUGHT_CHANNEL]?.let { thought.append(it) }
                    if (SystemClock.elapsedRealtime() - lastFlush >= FLUSH_INTERVAL_MS) flush()
                }
                flush()
                if (cancelRequested) {
                    sink.onCancelled()
                } else {
                    val info = runCatching { conv.getBenchmarkInfo() }.getOrNull()
                    sink.onDone(
                        info?.let {
                            GenerationStats(
                                decodeTokens = it.lastDecodeTokenCount,
                                decodeTokensPerSecond = it.lastDecodeTokensPerSecond,
                                timeToFirstTokenSec = it.timeToFirstTokenInSecond,
                                totalMs = SystemClock.elapsedRealtime() - started,
                            )
                        },
                    )
                }
            } catch (t: Throwable) {
                flush()
                if (cancelRequested || t is kotlinx.coroutines.CancellationException) {
                    sink.onCancelled()
                } else {
                    sink.onError(t.message ?: t.javaClass.simpleName)
                }
            }
        }
    }

    fun cancel() {
        cancelRequested = true
        runCatching { conversation?.cancelProcess() }
    }

    private suspend fun stopGeneration() {
        val job = generation ?: return
        if (job.isActive) {
            cancel()
            job.join()
        }
        generation = null
    }

    private fun closeAll() {
        conversation?.let { runCatching { it.close() } }
        conversation = null
        engine?.let { runCatching { it.close() } }
        engine = null
        backend = null
    }

    companion object {
        private const val THOUGHT_CHANNEL = "thought"
        private const val FLUSH_INTERVAL_MS = 40L
        private const val MAX_IMAGES = 12
        private const val VISUAL_TOKEN_BUDGET = 280

        // Gemma 4's recommended sampling (also Google AI Edge Gallery's defaults). Without an explicit
        // config LiteRT-LM falls back to top-p only, which lets stray tokens from the 262k vocabulary leak in.
        private const val TOP_K = 64
        private const val TOP_P = 0.95
        private const val TEMPERATURE = 1.0
    }
}
