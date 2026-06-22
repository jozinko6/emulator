package sk.jano.bavkac

import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NativeGamepadPlugin — per prompt section 5 + 9.
 *
 * Native Android input API (KeyEvent / MotionEvent) provides more reliable
 * gamepad support than WebView's Gamepad API. This plugin forwards
 * SOURCE_GAMEPAD / SOURCE_JOYSTICK events to JavaScript via notifyListeners().
 *
 * Lifecycle:
 *   - inactive (default) — events from BaseGameActivity are NOT consumed
 *   - active — start() called by JS when game starts; events are forwarded
 *   - stop() — release all pressed buttons, reset axes, set inactive
 *
 * JS listens on "nativeGamepadEvent" channel.
 */
@CapacitorPlugin(name = "NativeGamepad")
class NativeGamepadPlugin : Plugin() {

    @Volatile
    private var active = false
    private val pressedButtons = mutableSetOf<Int>()
    private val axesState = mutableMapOf<String, Float>()

    /**
     * JS calls this when the game starts. After this, all gamepad KeyEvents
     * and MotionEvents from BaseGameActivity are forwarded to JS.
     */
    @PluginMethod
    fun start(call: PluginCall) {
        active = true
        call.resolve()
    }

    /**
     * JS calls this when the game ends. Releases all pressed buttons and
     * resets axes to 0. Sets state to inactive.
     */
    @PluginMethod
    fun stop(call: PluginCall) {
        releaseAll()
        active = false
        call.resolve()
    }

    @PluginMethod
    fun getConnectedControllers(call: PluginCall) {
        val devices = mutableListOf<JSObject>()
        val ids = InputDevice.getDeviceIds()
        for (id in ids) {
            val device = InputDevice.getDevice(id) ?: continue
            val sources = device.sources
            if (sources and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD ||
                sources and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK
            ) {
                val obj = JSObject()
                obj.put("deviceId", device.id)
                obj.put("name", device.name)
                obj.put("sources", sources)
                devices.add(obj)
            }
        }
        val result = JSObject()
        result.put("controllers", devices)
        call.resolve(result)
    }

    @PluginMethod
    fun vibrate(call: PluginCall) {
        val duration = call.getInt("durationMs", 100) ?: 100
        val intensity = call.getDouble("intensity", 1.0) ?: 1.0
        val activity = getActivity() ?: run {
            call.reject("Activity not available")
            return
        }
        @Suppress("DEPRECATION")
        val vibrator = activity.getSystemService(android.content.Context.VIBRATOR_SERVICE) as? Vibrator
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val amplitude = ((intensity * 255).toInt()).coerceIn(1, 255)
                val effect = VibrationEffect.createOneShot(duration.toLong(), amplitude)
                vibrator.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(duration.toLong())
            }
        }
        call.resolve()
    }

    /** Returns true if game is running and plugin should consume gamepad events. */
    fun isActive(): Boolean = active

    /** Release all pressed buttons + reset axes. Called by BaseGameActivity.onStop. */
    fun releaseAll() {
        for (key in pressedButtons.toList()) {
            emitKeyEvent(key, false)
        }
        pressedButtons.clear()
        for ((axis, _) in axesState) {
            emitAxisEvent(axis, 0f)
        }
        axesState.clear()
    }

    /**
     * Called from BaseGameActivity.dispatchKeyEvent on ACTION_DOWN.
     * Returns true if event was consumed (gamepad source + active state).
     */
    fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (!active) return false
        if (event != null && event.repeatCount > 0) return false
        if (pressedButtons.contains(keyCode)) return false
        pressedButtons.add(keyCode)
        emitKeyEvent(keyCode, true)
        return true
    }

    fun handleKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (!active) return false
        if (!pressedButtons.contains(keyCode)) return false
        pressedButtons.remove(keyCode)
        emitKeyEvent(keyCode, false)
        return true
    }

    /**
     * Called from BaseGameActivity.onGenericMotionEvent on ACTION_MOVE.
     */
    fun handleMotionEvent(event: MotionEvent): Boolean {
        if (!active) return false
        if (event.action != MotionEvent.ACTION_MOVE) return false

        emitAxisIfChanged("lstick-x", event.getAxisValue(MotionEvent.AXIS_X))
        emitAxisIfChanged("lstick-y", event.getAxisValue(MotionEvent.AXIS_Y))
        emitAxisIfChanged("rstick-x", event.getAxisValue(MotionEvent.AXIS_Z))
        emitAxisIfChanged("rstick-y", event.getAxisValue(MotionEvent.AXIS_RZ))
        emitAxisIfChanged("dpad-x", event.getAxisValue(MotionEvent.AXIS_HAT_X))
        emitAxisIfChanged("dpad-y", event.getAxisValue(MotionEvent.AXIS_HAT_Y))
        emitAxisIfChanged("l2-axis", event.getAxisValue(MotionEvent.AXIS_LTRIGGER))
        emitAxisIfChanged("r2-axis", event.getAxisValue(MotionEvent.AXIS_RTRIGGER))
        return true
    }

    private fun emitAxisIfChanged(axis: String, value: Float) {
        val prev = axesState[axis]
        if (prev == null || Math.abs(prev - value) > 0.01f) {
            axesState[axis] = value
            emitAxisEvent(axis, value)
        }
    }

    private fun emitKeyEvent(keyCode: Int, pressed: Boolean) {
        val control = keyCodeToControl(keyCode) ?: return
        val data = JSObject()
        data.put("type", if (pressed) "keydown" else "keyup")
        data.put("button", control)
        data.put("source", "SOURCE_GAMEPAD")
        data.put("timestamp", System.currentTimeMillis())
        notifyListeners("nativeGamepadEvent", data)
    }

    private fun emitAxisEvent(axis: String, value: Float) {
        val data = JSObject()
        data.put("type", "axis")
        data.put("axis", axis)
        data.put("value", value.toDouble())
        data.put("source", "SOURCE_JOYSTICK")
        data.put("timestamp", System.currentTimeMillis())
        notifyListeners("nativeGamepadEvent", data)
    }

    private fun keyCodeToControl(keyCode: Int): String? = when (keyCode) {
        KeyEvent.KEYCODE_BUTTON_A -> "face-a"
        KeyEvent.KEYCODE_BUTTON_B -> "face-b"
        KeyEvent.KEYCODE_BUTTON_X -> "face-x"
        KeyEvent.KEYCODE_BUTTON_Y -> "face-y"
        KeyEvent.KEYCODE_BUTTON_L1 -> "l1"
        KeyEvent.KEYCODE_BUTTON_R1 -> "r1"
        KeyEvent.KEYCODE_BUTTON_L2 -> "l2"
        KeyEvent.KEYCODE_BUTTON_R2 -> "r2"
        KeyEvent.KEYCODE_BUTTON_SELECT -> "select"
        KeyEvent.KEYCODE_BUTTON_START -> "start"
        KeyEvent.KEYCODE_BUTTON_THUMBL -> "l3"
        KeyEvent.KEYCODE_BUTTON_THUMBR -> "r3"
        KeyEvent.KEYCODE_DPAD_UP -> "dpad-up"
        KeyEvent.KEYCODE_DPAD_DOWN -> "dpad-down"
        KeyEvent.KEYCODE_DPAD_LEFT -> "dpad-left"
        KeyEvent.KEYCODE_DPAD_RIGHT -> "dpad-right"
        KeyEvent.KEYCODE_DPAD_CENTER -> "dpad-center"
        KeyEvent.KEYCODE_BACK -> "back"
        KeyEvent.KEYCODE_MENU -> "menu"
        else -> null
    }
}
