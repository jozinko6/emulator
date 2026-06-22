package sk.jano.bavkac

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NativeGamepadPlugin — per prompt section 5.
 *
 * Native Android input API (KeyEvent / MotionEvent) provides more reliable
 * gamepad support than WebView's Gamepad API. This plugin forwards
 * SOURCE_GAMEPAD / SOURCE_JOYSTICK events to JavaScript via notifyListeners().
 *
 * Supports:
 *   - KeyEvent for D-pad, Start, Select, L3, R3, face buttons (A/B/X/Y), L1/R1
 *   - MotionEvent for analog sticks (X, Y, Z, RZ), L2/R2 triggers, HAT switch
 *   - Multiple connected controllers
 *   - Vibration via Vibrator API
 */
@CapacitorPlugin(name = "NativeGamepad")
class NativeGamepadPlugin : Plugin() {

    private var running = false
    private val pressedButtons = mutableSetOf<Int>()

    @PluginMethod
    fun start(call: PluginCall) {
        running = true
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        running = false
        // Release all pressed buttons to JS
        for (key in pressedButtons.toList()) {
            emitKeyEvent(key, false)
        }
        pressedButtons.clear()
        call.resolve()
    }

    @PluginMethod
    fun getConnectedControllers(call: PluginCall) {
        val devices = mutableListOf<JSObject>()
        val ids = InputDevice.getDeviceIds()
        for (id in ids) {
            val device = InputDevice.getDevice(id)
            if (device == null) continue
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
        val vibrator = activity.getSystemService(android.content.Context.VIBRATOR_SERVICE)
            as? android.os.Vibrator
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = android.os.VibrationEffect.createOneShot(
                    duration.toLong(),
                    ((intensity * 255).toInt()).coerceIn(1, 255)
                )
                vibrator.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(duration.toLong())
            }
        }
        call.resolve()
    }

    /**
     * Called from MainActivity.onKeyDown / TvActivity.onKeyDown.
     */
    fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (!running) return false
        if (event != null && event.repeatCount > 0) return false  // ignore repeat
        if (pressedButtons.contains(keyCode)) return false  // already pressed
        pressedButtons.add(keyCode)
        emitKeyEvent(keyCode, true)
        return true
    }

    fun handleKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (!running) return false
        if (!pressedButtons.contains(keyCode)) return false
        pressedButtons.remove(keyCode)
        emitKeyEvent(keyCode, false)
        return true
    }

    /**
     * Called from MainActivity.onGenericMotionEvent / TvActivity.onGenericMotionEvent.
     */
    fun handleMotionEvent(event: MotionEvent): Boolean {
        if (!running) return false
        if (event.action != MotionEvent.ACTION_MOVE) return false

        // Left stick: AXIS_X (0), AXIS_Y (1)
        val lx = event.getAxisValue(MotionEvent.AXIS_X)
        val ly = event.getAxisValue(MotionEvent.AXIS_Y)
        emitAxisEvent("lstick-x", lx)
        emitAxisEvent("lstick-y", ly)

        // Right stick: AXIS_Z (11), AXIS_RZ (14)
        val rx = event.getAxisValue(MotionEvent.AXIS_Z)
        val ry = event.getAxisValue(MotionEvent.AXIS_RZ)
        emitAxisEvent("rstick-x", rx)
        emitAxisEvent("rstick-y", ry)

        // D-pad hat
        val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
        val hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
        emitAxisEvent("dpad-x", hatX)
        emitAxisEvent("dpad-y", hatY)

        // Triggers L2 / R2
        val l2 = event.getAxisValue(MotionEvent.AXIS_LTRIGGER)
        val r2 = event.getAxisValue(MotionEvent.AXIS_RTRIGGER)
        emitAxisEvent("l2-axis", l2)
        emitAxisEvent("r2-axis", r2)

        return true
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
