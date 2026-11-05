package app.hisoka.offline.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object ImagePrep {
    const val MODEL_MAX_SIDE = 1024
    private const val THUMB_SIDE = 192

    fun decode(context: Context, uri: Uri, maxSide: Int = MODEL_MAX_SIDE): Bitmap =
        decode(ImageDecoder.createSource(context.contentResolver, uri), maxSide)

    fun decode(file: File, maxSide: Int = MODEL_MAX_SIDE): Bitmap =
        decode(ImageDecoder.createSource(file), maxSide)

    private fun decode(source: ImageDecoder.Source, maxSide: Int): Bitmap =
        ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val w = info.size.width
            val h = info.size.height
            val scale = min(1f, maxSide.toFloat() / max(w, h))
            if (scale < 1f) decoder.setTargetSize((w * scale).roundToInt(), (h * scale).roundToInt())
        }

    fun scaleDown(bitmap: Bitmap, maxSide: Int): Bitmap {
        val scale = min(1f, maxSide.toFloat() / max(bitmap.width, bitmap.height))
        if (scale >= 1f) return bitmap
        return Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).roundToInt(), (bitmap.height * scale).roundToInt(), true)
    }

    fun jpeg(bitmap: Bitmap, quality: Int = 88): ByteArray =
        ByteArrayOutputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, out)
            out.toByteArray()
        }

    /** Square, center-cropped preview encoded as a data URL for the WebView. */
    fun thumbDataUrl(bitmap: Bitmap): String {
        val side = min(bitmap.width, bitmap.height)
        val cropped = Bitmap.createBitmap(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side)
        val scaled = Bitmap.createScaledBitmap(cropped, THUMB_SIDE, THUMB_SIDE, true)
        val bytes = jpeg(scaled, 72)
        return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}
