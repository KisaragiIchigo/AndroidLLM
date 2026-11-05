package app.hisoka.offline.media

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class DecodedAudio(val pcm: ShortArray, val sourceDurationMs: Long, val truncated: Boolean)

/**
 * LiteRT-LM accepts WAV only, and Gemma 4 takes at most 30 s per clip,
 * so every audio source is normalized to 16 kHz mono PCM16 and split into 30 s WAV chunks.
 */
object AudioPcm {
    const val SAMPLE_RATE = 16_000
    const val CHUNK_SECONDS = 30
    private const val TIMEOUT_US = 10_000L

    fun decode(context: Context, uri: Uri, maxSeconds: Int): DecodedAudio? {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, uri, null)
            val track = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return null
            extractor.selectTrack(track)
            val inputFormat = extractor.getTrackFormat(track)
            val durationMs = if (inputFormat.containsKey(MediaFormat.KEY_DURATION)) inputFormat.getLong(MediaFormat.KEY_DURATION) / 1000 else 0L

            val codec = MediaCodec.createDecoderByType(inputFormat.getString(MediaFormat.KEY_MIME)!!)
            codec.configure(inputFormat, null, null, 0)
            codec.start()

            var sampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var floatPcm = false
            val mono = FloatBuffer()
            var maxSamples = maxSeconds.toLong() * sampleRate
            var truncated = false
            var inputDone = false
            var outputDone = false
            val info = MediaCodec.BufferInfo()

            try {
                while (!outputDone) {
                    if (!inputDone) {
                        val inIndex = codec.dequeueInputBuffer(TIMEOUT_US)
                        if (inIndex >= 0) {
                            val buffer = codec.getInputBuffer(inIndex)!!
                            val size = extractor.readSampleData(buffer, 0)
                            if (size < 0) {
                                codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                codec.queueInputBuffer(inIndex, 0, size, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }
                    val outIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)
                    when {
                        outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            val f = codec.outputFormat
                            sampleRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                            channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                            floatPcm = f.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
                                f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
                            maxSamples = maxSeconds.toLong() * sampleRate
                        }
                        outIndex >= 0 -> {
                            val out = codec.getOutputBuffer(outIndex)!!
                            out.position(info.offset)
                            out.limit(info.offset + info.size)
                            appendMono(out.order(ByteOrder.nativeOrder()), channels, floatPcm, mono)
                            codec.releaseOutputBuffer(outIndex, false)
                            if (mono.size >= maxSamples) {
                                truncated = true
                                outputDone = true
                            }
                            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
                        }
                    }
                }
            } finally {
                runCatching { codec.stop() }
                codec.release()
            }

            val clipped = mono.toArray(min(mono.size.toLong(), maxSamples).toInt())
            return DecodedAudio(resample(clipped, sampleRate), durationMs, truncated)
        } finally {
            extractor.release()
        }
    }

    private fun appendMono(buffer: ByteBuffer, channels: Int, floatPcm: Boolean, sink: FloatBuffer) {
        val ch = max(1, channels)
        if (floatPcm) {
            val floats = buffer.asFloatBuffer()
            while (floats.remaining() >= ch) {
                var sum = 0f
                repeat(ch) { sum += floats.get() }
                sink.add(sum / ch)
            }
        } else {
            val shorts = buffer.asShortBuffer()
            while (shorts.remaining() >= ch) {
                var sum = 0f
                repeat(ch) { sum += shorts.get() / 32768f }
                sink.add(sum / ch)
            }
        }
    }

    private fun resample(input: FloatArray, fromRate: Int): ShortArray {
        if (input.isEmpty()) return ShortArray(0)
        val ratio = fromRate.toDouble() / SAMPLE_RATE
        val outLength = (input.size / ratio).toInt()
        return ShortArray(outLength) { i ->
            val pos = i * ratio
            val idx = pos.toInt()
            val frac = (pos - idx).toFloat()
            val a = input[min(idx, input.size - 1)]
            val b = input[min(idx + 1, input.size - 1)]
            toPcm16(a + (b - a) * frac)
        }
    }

    fun toPcm16(sample: Float): Short = (sample.coerceIn(-1f, 1f) * 32767f).toInt().toShort()

    fun chunkToWav(pcm: ShortArray): List<ByteArray> {
        val chunk = CHUNK_SECONDS * SAMPLE_RATE
        return (pcm.indices step chunk).map { start -> wav(pcm, start, min(chunk, pcm.size - start)) }
    }

    private fun wav(pcm: ShortArray, offset: Int, length: Int): ByteArray {
        val dataBytes = length * 2
        val buffer = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN)
        buffer.put("RIFF".toByteArray()).putInt(36 + dataBytes).put("WAVE".toByteArray())
        buffer.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
            .putInt(SAMPLE_RATE).putInt(SAMPLE_RATE * 2).putShort(2).putShort(16)
        buffer.put("data".toByteArray()).putInt(dataBytes)
        for (i in offset until offset + length) buffer.putShort(pcm[i])
        return buffer.array()
    }

    /** Normalized RMS levels for drawing a compact waveform in the UI. */
    fun waveform(pcm: ShortArray, bars: Int = 28): List<Double> {
        if (pcm.isEmpty()) return List(bars) { 0.0 }
        val bucket = max(1, pcm.size / bars)
        val levels = (0 until bars).map { b ->
            val start = b * bucket
            val end = min(pcm.size, start + bucket)
            if (start >= end) 0.0 else {
                var sum = 0.0
                for (i in start until end) {
                    val v = pcm[i] / 32768.0
                    sum += v * v
                }
                sqrt(sum / (end - start))
            }
        }
        val peak = levels.maxOrNull()?.takeIf { it > 0 } ?: 1.0
        return levels.map { (it / peak).coerceIn(0.0, 1.0) }
    }

    fun durationMs(pcm: ShortArray): Long = pcm.size * 1000L / SAMPLE_RATE

    fun peak(pcm: ShortArray, from: Int, to: Int): Double {
        var p = 0
        for (i in from until to) p = max(p, abs(pcm[i].toInt()))
        return p / 32768.0
    }
}

/** Growable float storage without boxing. */
class FloatBuffer {
    private var data = FloatArray(1 shl 16)
    var size = 0
        private set

    fun add(value: Float) {
        if (size == data.size) data = data.copyOf(data.size * 2)
        data[size++] = value
    }

    fun toArray(length: Int = size): FloatArray = data.copyOf(length)
}
