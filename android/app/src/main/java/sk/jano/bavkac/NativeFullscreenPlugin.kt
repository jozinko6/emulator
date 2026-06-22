package sk.jano.bavkac

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NativeFullscreenPlugin — per prompt section 15.
 *
 * Implements:
 *   - FLAG_KEEP_SCREEN_ON (zabranenie zhasnutia displeja)
 *   - WindowInsetsController immersive sticky mode
 *   - Orientation lock (landscape / portrait / auto)
 *   - Cutout mode handling
 *
 * On Android TV: only fullscreen is applied, orientation is not changed.
 */
@CapacitorPlugin(name = "NativeFullscreen")
class NativeFullscreenPlugin : Plugin() {

    @PluginMethod
    fun enterImmersive(call: PluginCall) {
        val activity = getActivity() ?: run {
            call.reject("Activity not available")
            return
        }
        activity.runOnUiThread {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val controller = activity.window.insetsController
                if (controller != null) {
                    controller.hide(
                        android.view.WindowInsets.Type.statusBars() or
                        android.view.WindowInsets.Type.navigationBars()
                    )
                    controller.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                activity.window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun exitImmersive(call: PluginCall) {
        val activity = getActivity() ?: run {
            call.reject("Activity not available")
            return
        }
        activity.runOnUiThread {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val controller = activity.window.insetsController
                controller?.show(
                    android.view.WindowInsets.Type.statusBars() or
                    android.view.WindowInsets.Type.navigationBars()
                )
            } else {
                @Suppress("DEPRECATION")
                activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun setOrientation(call: PluginCall) {
        val orientation = call.getString("orientation", "auto")
        val activity = getActivity() ?: run {
            call.reject("Activity not available")
            return
        }
        activity.runOnUiThread {
            when (orientation) {
                "landscape" -> activity.requestedOrientation =
                    android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                "portrait" -> activity.requestedOrientation =
                    android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                else -> activity.requestedOrientation =
                    android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun setKeepScreenOn(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true)
        val activity = getActivity() ?: run {
            call.reject("Activity not available")
            return
        }
        activity.runOnUiThread {
            if (enabled == true) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun setCutoutMode(call: PluginCall) {
        // On API 28+ use shortEdges mode; on older, no-op
        val activity = getActivity() ?: run {
            call.reject("Activity not available")
            return
        }
        activity.runOnUiThread {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val layoutParams = activity.window.attributes
                layoutParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                activity.window.attributes = layoutParams
            }
        }
        call.resolve()
    }
}
