package sk.jano.bavkac

import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.InputDevice
import com.getcapacitor.BridgeActivity

/**
 * Base activity for both MainActivity (phones/tablets) and TvActivity (Android TV).
 *
 * Per prompt section 9 — wires native gamepad events into NativeGamepadPlugin:
 *   - dispatchKeyEvent → NativeGamepadPlugin.handleKeyDown / handleKeyUp
 *   - onGenericMotionEvent → NativeGamepadPlugin.handleMotionEvent
 *
 * Filters SOURCE_GAMEPAD and SOURCE_JOYSTICK sources only. Other input
 * (touch, keyboard typing) is delegated to the WebView as usual.
 *
 * When the NativeGamepadPlugin is not in "active" state (i.e., game is not
 * running), events are NOT consumed — they propagate normally so that the
 * D-pad can navigate the library UI on Android TV.
 */
abstract class BaseGameActivity : BridgeActivity() {

    private var gamepadPlugin: NativeGamepadPlugin? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NativeFullscreenPlugin::class.java)
        registerPlugin(NativeGamepadPlugin::class.java)
        registerPlugin(NativeStoragePlugin::class.java)
        registerPlugin(NativeFilePickerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    override fun onStart() {
        super.onStart()
        // Resolve plugin reference after bridge is initialized
        gamepadPlugin = bridge?.getPlugin("NativeGamepad")?.instance as? NativeGamepadPlugin
    }

    override fun onStop() {
        super.onStop()
        // Release all pressed buttons when activity goes to background
        gamepadPlugin?.releaseAll()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val plugin = gamepadPlugin ?: return super.dispatchKeyEvent(event)
        if (!plugin.isActive()) return super.dispatchKeyEvent(event)

        // Only consume events from gamepad / joystick sources
        val device = event.device
        if (device != null) {
            val sources = device.sources
            val isGamepad = (sources and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            val isJoystick = (sources and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
            if (!isGamepad && !isJoystick) {
                return super.dispatchKeyEvent(event)
            }
        }

        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                if (plugin.handleKeyDown(event.keyCode, event)) {
                    return true
                }
            }
            KeyEvent.ACTION_UP -> {
                if (plugin.handleKeyUp(event.keyCode, event)) {
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        val plugin = gamepadPlugin ?: return super.onGenericMotionEvent(event)
        if (!plugin.isActive()) return super.onGenericMotionEvent(event)

        val sources = event.source
        val isGamepad = (sources and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
        val isJoystick = (sources and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
        if (!isGamepad && !isJoystick) {
            return super.onGenericMotionEvent(event)
        }

        if (plugin.handleMotionEvent(event)) {
            return true
        }
        return super.onGenericMotionEvent(event)
    }
}
