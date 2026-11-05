package app.hisoka.offline.media

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** Model-ready payloads, held in memory only; byte buffers are overwritten when released. */
sealed class Prepared {
    abstract fun buffers(): List<ByteArray>

    class Image(val jpeg: ByteArray) : Prepared() {
        override fun buffers() = listOf(jpeg)
    }

    class Audio(val wavChunks: List<ByteArray>) : Prepared() {
        override fun buffers() = wavChunks
    }

    class Video(val frames: List<ByteArray>, val wavChunks: List<ByteArray>, val durationMs: Long) : Prepared() {
        override fun buffers() = frames + wavChunks
    }

    class Document(val name: String, val text: String, val pageImages: List<ByteArray>) : Prepared() {
        override fun buffers() = pageImages
    }
}

object AttachmentStore {
    private val items = ConcurrentHashMap<String, Prepared>()

    fun put(prepared: Prepared): String {
        val id = UUID.randomUUID().toString()
        items[id] = prepared
        return id
    }

    fun get(id: String): Prepared? = items[id]

    fun remove(id: String) {
        items.remove(id)?.buffers()?.forEach { it.fill(0) }
    }

    fun clear() {
        items.keys.toList().forEach(::remove)
    }
}
