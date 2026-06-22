package sk.jano.bavkac

import android.app.Application
import com.getcapacitor.BridgeActivity

/**
 * Application entry point — registers native plugins.
 */
class JanobavkacApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Register native plugins via Capacitor
    }
}

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Register custom plugins
        registerPlugin(NativeFullscreenPlugin::class.java)
        registerPlugin(NativeGamepadPlugin::class.java)
        registerPlugin(NativeStoragePlugin::class.java)
        registerPlugin(NativeFilePickerPlugin::class.java)
    }
}

class TvActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(NativeFullscreenPlugin::class.java)
        registerPlugin(NativeGamepadPlugin::class.java)
        registerPlugin(NativeStoragePlugin::class.java)
        registerPlugin(NativeFilePickerPlugin::class.java)
    }
}
