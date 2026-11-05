package app.hisoka.offline.media

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlin.math.max

/** Records straight into 16 kHz mono PCM16, the format the model consumes, so no transcoding is needed. */
class AudioRecorder(private val maxSeconds: Int, private val onLevel: (Double, Long) -> Unit) {

    private var record: AudioRecord? = null
    private var thread: Thread? = null
    @Volatile private var running = false
    private var data = ShortArray(AudioPcm.SAMPLE_RATE * 10)
    private var size = 0

    val isRecording: Boolean get() = running

    @SuppressLint("MissingPermission")
    fun start() {
        val minBuffer = AudioRecord.getMinBufferSize(AudioPcm.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val recorder = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            AudioPcm.SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            max(minBuffer, AudioPcm.SAMPLE_RATE / 5 * 2),
        )
        check(recorder.state == AudioRecord.STATE_INITIALIZED) { "マイクを初期化できませんでした。" }
        record = recorder
        size = 0
        running = true
        recorder.startRecording()
        thread = Thread({ loop(recorder) }, "hisoka-recorder").apply { start() }
    }

    private fun loop(recorder: AudioRecord) {
        val frame = ShortArray(AudioPcm.SAMPLE_RATE / 10)
        val limit = maxSeconds * AudioPcm.SAMPLE_RATE
        while (running) {
            val read = recorder.read(frame, 0, frame.size)
            if (read <= 0) continue
            synchronized(this) {
                if (size + read > data.size) data = data.copyOf(max(data.size * 2, size + read))
                System.arraycopy(frame, 0, data, size, read)
                size += read
            }
            onLevel(AudioPcm.peak(frame, 0, read), size * 1000L / AudioPcm.SAMPLE_RATE)
            if (size >= limit) running = false
        }
    }

    fun stop(): ShortArray {
        running = false
        thread?.join(1_000)
        thread = null
        record?.let {
            runCatching { it.stop() }
            it.release()
        }
        record = null
        return synchronized(this) {
            data.copyOf(size).also {
                data.fill(0)
                size = 0
            }
        }
    }
}
