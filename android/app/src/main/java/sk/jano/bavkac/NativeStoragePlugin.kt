package sk.jano.bavkac

import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

/**
 * NativeStoragePlugin — per prompt section 16.
 *
 * Stores imported games in app-specific storage (filesDir / externalFilesDir).
 * Streams large files from Content URI directly to disk — never loads the
 * entire file into memory or sends it through the JS bridge as ArrayBuffer.
 */
@CapacitorPlugin(name = "NativeStorage")
class NativeStoragePlugin : Plugin() {

    private val tag = "NativeStorage"

    @PluginMethod
    fun getInfo(call: PluginCall) {
        val ctx = getContext()
        val filesDir = ctx.filesDir
        val cacheDir = ctx.cacheDir
        val externalFilesDir = ctx.getExternalFilesDir(null)

        val stat = StatFs(filesDir.path)
        val available = stat.availableBytes
        val total = stat.totalBytes

        val result = JSObject()
        result.put("availableBytes", available)
        result.put("totalBytes", total)
        result.put("filesDir", filesDir.absolutePath)
        result.put("cacheDir", cacheDir.absolutePath)
        result.put("externalFilesDir", externalFilesDir?.absolutePath ?: JSObject.NULL)
        call.resolve(result)
    }

    @PluginMethod
    fun ensureDir(call: PluginCall) {
        val path = call.getString("path") ?: run {
            call.reject("path required")
            return
        }
        val ctx = getContext()
        val target = File(ctx.filesDir, path)
        if (!target.exists() && !target.mkdirs()) {
            call.reject("Failed to create directory: $path")
            return
        }
        val result = JSObject()
        result.put("path", target.absolutePath)
        call.resolve(result)
    }

    /**
     * Streams a Content URI directly to app-specific storage.
     * Uses InputStream + FileOutputStream with 64 KB buffer.
     * Never loads whole file into memory.
     */
    @PluginMethod
    fun copyFromUri(call: PluginCall) {
        val sourceUri = call.getString("sourceUri") ?: run {
            call.reject("sourceUri required")
            return
        }
        val destinationPath = call.getString("destinationPath") ?: run {
            call.reject("destinationPath required")
            return
        }
        val ctx = getContext()
        val destFile = File(ctx.filesDir, destinationPath)
        destFile.parentFile?.mkdirs()

        try {
            val uri = Uri.parse(sourceUri)
            val resolver = ctx.contentResolver
            val input: InputStream = resolver.openInputStream(uri)
                ?: run {
                    call.reject("Failed to open input stream")
                    return
                }
            val output = FileOutputStream(destFile)
            val buffer = ByteArray(64 * 1024)
            var total = 0L
            var read: Int
            while (true) {
                read = input.read(buffer)
                if (read <= 0) break
                output.write(buffer, 0, read)
                total += read
            }
            output.flush()
            output.close()
            input.close()

            val result = JSObject()
            result.put("size", total)
            call.resolve(result)
        } catch (e: Exception) {
            Log.e(tag, "copyFromUri failed", e)
            // Cleanup partial file
            if (destFile.exists()) destFile.delete()
            call.reject("Copy failed: ${e.message}")
        }
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        val path = call.getString("path") ?: run {
            call.reject("path required")
            return
        }
        val ctx = getContext()
        val target = File(ctx.filesDir, path)
        if (target.exists()) {
            target.deleteRecursively()
        }
        call.resolve()
    }

    @PluginMethod
    fun openFile(call: PluginCall) {
        // Capacitor bridge handles File → Blob conversion automatically
        // when returning a file:// URL. We just return the URL.
        val path = call.getString("path") ?: run {
            call.reject("path required")
            return
        }
        val ctx = getContext()
        val file = File(ctx.filesDir, path)
        if (!file.exists()) {
            call.reject("File not found")
            return
        }
        val result = JSObject()
        result.put("path", path)
        result.put("url", "file://${file.absolutePath}")
        result.put("size", file.length())
        call.resolve(result)
    }

    @PluginMethod
    fun getUrl(call: PluginCall) {
        val path = call.getString("path") ?: run {
            call.reject("path required")
            return
        }
        val ctx = getContext()
        val file = File(ctx.filesDir, path)
        val result = JSObject()
        result.put("url", "file://${file.absolutePath}")
        call.resolve(result)
    }
}
