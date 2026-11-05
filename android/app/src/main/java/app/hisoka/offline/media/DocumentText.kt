package app.hisoka.offline.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.util.Xml
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction
import java.util.zip.ZipInputStream
import org.xmlpull.v1.XmlPullParser
import kotlin.math.min
import kotlin.math.roundToInt

class ExtractedDocument(
    val text: String,
    val pages: Int?,
    val truncated: Boolean,
    val pageImages: List<Bitmap>,
)

object DocumentText {
    private const val SCANNED_PAGE_LIMIT = 4
    private const val PAGE_RENDER_WIDTH = 1024
    private const val MAX_DOC_BYTES = 40L * 1024 * 1024

    @Volatile private var pdfBoxReady = false

    fun extract(context: Context, uri: Uri, name: String, mime: String, maxChars: Int): ExtractedDocument {
        val lower = name.lowercase()
        return when {
            mime == "application/pdf" || lower.endsWith(".pdf") -> pdf(context, uri, maxChars)
            lower.endsWith(".docx") || mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ->
                clip(docx(readBytes(context, uri)), maxChars, null)
            else -> clip(plainText(readBytes(context, uri)), maxChars, null)
        }
    }

    private fun readBytes(context: Context, uri: Uri): ByteArray {
        val input = context.contentResolver.openInputStream(uri) ?: throw IllegalStateException("ファイルを開けませんでした。")
        return input.use {
            val bytes = it.readBytes()
            check(bytes.size <= MAX_DOC_BYTES) { "ファイルが大きすぎます（40MB まで）。" }
            bytes
        }
    }

    private fun clip(text: String, maxChars: Int, pages: Int?): ExtractedDocument {
        val normalized = text.replace("\r\n", "\n").replace('\r', '\n').trim()
        val truncated = normalized.length > maxChars
        return ExtractedDocument(if (truncated) normalized.take(maxChars) else normalized, pages, truncated, emptyList())
    }

    private fun pdf(context: Context, uri: Uri, maxChars: Int): ExtractedDocument {
        if (!pdfBoxReady) {
            PDFBoxResourceLoader.init(context.applicationContext)
            pdfBoxReady = true
        }
        val bytes = readBytes(context, uri)
        val (text, pages) = PDDocument.load(bytes).use { doc ->
            PDFTextStripper().getText(doc) to doc.numberOfPages
        }
        if (text.isNotBlank()) return clip(text, maxChars, pages)

        val images = context.contentResolver.openFileDescriptor(uri, "r")?.use { fd ->
            PdfRenderer(fd).use { renderer ->
                (0 until min(renderer.pageCount, SCANNED_PAGE_LIMIT)).map { index ->
                    renderer.openPage(index).use { page ->
                        val height = (PAGE_RENDER_WIDTH.toFloat() * page.height / page.width).roundToInt()
                        val bitmap = Bitmap.createBitmap(PAGE_RENDER_WIDTH, height, Bitmap.Config.ARGB_8888)
                        bitmap.eraseColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        bitmap
                    }
                }
            }
        } ?: emptyList()
        return ExtractedDocument("", pages, pages > SCANNED_PAGE_LIMIT, images)
    }

    private fun docx(bytes: ByteArray): String {
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (entry.name == "word/document.xml") return parseDocumentXml(zip.readBytes())
            }
        }
        throw IllegalStateException("Word 文書の本文が見つかりませんでした。")
    }

    private fun parseDocumentXml(xml: ByteArray): String {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
        parser.setInput(ByteArrayInputStream(xml), "UTF-8")
        val out = StringBuilder()
        var inText = false
        while (true) {
            when (parser.next()) {
                XmlPullParser.END_DOCUMENT -> return out.toString()
                XmlPullParser.START_TAG -> when (parser.name) {
                    "w:t" -> inText = true
                    "w:tab" -> out.append('\t')
                    "w:br", "w:cr" -> out.append('\n')
                }
                XmlPullParser.END_TAG -> when (parser.name) {
                    "w:t" -> inText = false
                    "w:p" -> out.append('\n')
                }
                XmlPullParser.TEXT -> if (inText) out.append(parser.text)
            }
        }
    }

    /** UTF-8 first; Japanese files saved from older Windows tools are frequently Shift_JIS. */
    private fun plainText(bytes: ByteArray): String {
        val body = if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte()) {
            bytes.copyOfRange(3, bytes.size)
        } else bytes
        return try {
            Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(body))
                .toString()
        } catch (_: CharacterCodingException) {
            String(body, Charset.forName("windows-31j"))
        }
    }
}
