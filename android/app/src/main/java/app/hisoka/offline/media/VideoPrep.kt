package app.hisoka.offline.media

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import kotlin.math.max
import kotlin.math.min

class PreparedVideo(val frames: List<Bitmap>, val durationMs: Long)

/** Samples evenly spaced frames; the model reads video as an ordered series of stills. */
object VideoPrep {
    const val MAX_FRAMES = 8
    private const val FRAME_SIDE = 768

    fun frames(context: Context, uri: Uri): PreparedVideo {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, uri)
            val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            val count = min(MAX_FRAMES, max(1, (durationMs / 1000).toInt()))
            val frames = (0 until count).mapNotNull { i ->
                val atUs = ((i + 0.5) * durationMs / count * 1000).toLong()
                retriever.getScaledFrameAtTime(atUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, FRAME_SIDE, FRAME_SIDE)
            }
            check(frames.isNotEmpty()) { "動画からコマを取り出せませんでした。" }
            return PreparedVideo(frames, durationMs)
        } finally {
            retriever.release()
        }
    }
}
