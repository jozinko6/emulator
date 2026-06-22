package sk.jano.bavkac

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Log
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

/**
 * NativeFilePickerPlugin — per prompt sections 11, 12, 20.
 *
 * Uses Android Storage Access Framework (NO MANAGE_EXTERNAL_STORAGE).
 *
 * Methods:
 *   - pickFiles(options) → ACTION_OPEN_DOCUMENT (multi-select supported)
 *   - pickDirectory()    → ACTION_OPEN_DOCUMENT_TREE
 *   - copyToAppStorage(uri, destinationPath) → stream copy from Content URI
 *
 * Files are copied directly to app-specific storage (filesDir) using
 * InputStream + 64KB buffer. They are NEVER passed through the JS bridge
 * as Base64 or full ArrayBuffer — JS only receives metadata:
 *   { internalPath, name, size, mimeType, sourceUri }
 *
 * Streaming copy runs on a background thread (ExecutorService) so the
 * UI thread is not blocked for large ISO/CHD files.
 */
@CapacitorPlugin(name = "NativeFilePicker")
class NativeFilePickerPlugin : Plugin() {

    private val tag = "NativeFilePicker"
    private val executor = java.util.concurrent.Executors.newSingleThreadExecutor()

    @PluginMethod
    fun pickFiles(call: PluginCall) {
        val multiple = call.getBoolean("multiple", false) ?: false
        val mimeTypes = call.getArray("mimeTypes")
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
            type = "*/*"
            if (mimeTypes != null && mimeTypes.length() > 0) {
                val arr = arrayOfNulls<String>(mimeTypes.length())
                for (i in 0 until mimeTypes.length()) {
                    arr[i] = mimeTypes.getString(i)
                }
                putExtra(Intent.EXTRA_MIME_TYPES, arr)
            }
        }
        startActivityForResult(call, intent, "pickFilesResult")
    }

    @ActivityCallback
    private fun pickFilesResult(call: PluginCall, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("User cancelled or picker failed")
            return
        }
        val data = result.data
        if (data == null) {
            call.reject("No data returned from picker")
            return
        }

        val files = JSArray()
        val uris = mutableListOf<Uri>()

        // Multi-select via ClipData
        val clipData = data.clipData
        if (clipData != null) {
            for (i in 0 until clipData.itemCount) {
                uris.add(clipData.getItemAt(i).uri)
            }
        } else if (data.data != null) {
            uris.add(data.data!!)
        }

        if (uris.isEmpty()) {
            call.reject("No file selected")
            return
        }

        // Copy each URI to app storage on background thread
        executor.execute {
            try {
                for (uri in uris) {
                    val picked = copyUriToAppStorage(uri)
                    if (picked != null) files.put(picked)
                }
                val result = JSObject()
                result.put("files", files)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(tag, "pickFiles copy failed", e)
                call.reject("Copy failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun pickDirectory(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            putExtra("android.content.extra.SHOW_ADVANCED", true)
            putExtra("android.content.extra.FANCY", true)
        }
        startActivityForResult(call, intent, "pickDirectoryResult")
    }

    @ActivityCallback
    private fun pickDirectoryResult(call: PluginCall, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK || result.data == null || result.data!!.data == null) {
            call.reject("User cancelled or picker failed")
            return
        }
        val treeUri = result.data!!.data!!
        val ctx = getContext()

        // Persist permission so we can re-read later if needed
        try {
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            ctx.contentResolver.takePersistableUriPermission(treeUri, flags)
        } catch (e: SecurityException) {
            Log.w(tag, "Cannot take persistable permission: ${e.message}")
        }

        // Walk tree on background thread
        executor.execute {
            try {
                val tree = DocumentFile.fromTreeUri(ctx, treeUri)
                    ?: run {
                        call.reject("Cannot open directory tree")
                        return@execute
                    }
                val files = JSArray()
                walkDocumentFileTree(tree, "", files)
                val result = JSObject()
                result.put("internalPath", "")
                result.put("sourceUri", treeUri.toString())
                result.put("files", files)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(tag, "pickDirectory walk failed", e)
                call.reject("Directory walk failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun copyToAppStorage(call: PluginCall) {
        val uri = call.getString("uri") ?: run {
            call.reject("uri required")
            return
        }
        val destinationPath = call.getString("destinationPath") ?: run {
            call.reject("destinationPath required")
            return
        }
        executor.execute {
            try {
                val picked = copyUriToAppStorage(Uri.parse(uri), destinationPath)
                if (picked != null) {
                    call.resolve(picked)
                } else {
                    call.reject("Copy failed")
                }
            } catch (e: Exception) {
                Log.e(tag, "copyToAppStorage failed", e)
                call.reject("Copy failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun releasePermission(call: PluginCall) {
        val uri = call.getString("uri") ?: run {
            call.reject("uri required")
            return
        }
        try {
            val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            getContext().contentResolver.releasePersistableUriPermission(
                Uri.parse(uri),
                flags
            )
        } catch (e: SecurityException) {
            Log.w(tag, "releasePermission: ${e.message}")
        }
        call.resolve()
    }

    // ===== Helpers =====

    private fun copyUriToAppStorage(
        uri: Uri,
        customDestination: String? = null
    ): JSObject? {
        val ctx = getContext()
        val resolver = ctx.contentResolver

        // Query metadata
        var name: String? = null
        var size: Long = 0
        var mime: String? = null
        resolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                val sizeIdx = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                if (nameIdx >= 0) name = cursor.getString(nameIdx)
                if (sizeIdx >= 0) size = cursor.getLong(sizeIdx)
                mime = resolver.getType(uri)
            }
        }
        if (name == null) name = uri.lastPathSegment ?: "unknown"
        if (mime == null) mime = "application/octet-stream"

        val destRelative = customDestination ?: "imports/${System.currentTimeMillis()}_$name"
        val destFile = File(ctx.filesDir, destRelative)
        destFile.parentFile?.mkdirs()

        // Stream copy with 64KB buffer
        var input: InputStream? = null
        var output: FileOutputStream? = null
        try {
            input = resolver.openInputStream(uri) ?: return null
            output = FileOutputStream(destFile)
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
            val result = JSObject()
            result.put("internalPath", destFile.absolutePath)
            result.put("name", name)
            result.put("size", if (total > 0) total else size)
            result.put("mimeType", mime)
            result.put("sourceUri", uri.toString())
            return result
        } catch (e: Exception) {
            Log.e(tag, "Stream copy failed for $uri", e)
            // Cleanup partial file
            if (destFile.exists()) destFile.delete()
            return null
        } finally {
            try { input?.close() } catch (_: Exception) {}
            try { output?.close() } catch (_: Exception) {}
        }
    }

    private fun walkDocumentFileTree(
        dir: DocumentFile,
        prefix: String,
        out: JSArray
    ) {
        val ctx = getContext()
        for (child in dir.listFiles()) {
            if (child.isDirectory) {
                val childPath = if (prefix.isEmpty()) child.name ?: "?" else "$prefix/${child.name}"
                walkDocumentFileTree(child, childPath, out)
            } else if (child.isFile) {
                val relPath = if (prefix.isEmpty()) child.name ?: "?" else "$prefix/${child.name}"
                // Copy file to app storage preserving relative path
                val destFile = File(ctx.filesDir, "imports/$relPath")
                destFile.parentFile?.mkdirs()
                try {
                    val input = ctx.contentResolver.openInputStream(child.uri)
                    if (input != null) {
                        val output = FileOutputStream(destFile)
                        val buffer = ByteArray(64 * 1024)
                        var read: Int
                        while (true) {
                            read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                        }
                        output.flush()
                        output.close()
                        input.close()
                        val entry = JSObject()
                        entry.put("internalPath", destFile.absolutePath)
                        entry.put("name", child.name)
                        entry.put("size", child.length())
                        entry.put("mimeType", child.type ?: "application/octet-stream")
                        entry.put("sourceUri", child.uri.toString())
                        out.put(entry)
                    }
                } catch (e: Exception) {
                    Log.e(tag, "Failed to copy ${child.uri}", e)
                }
            }
        }
    }
}
