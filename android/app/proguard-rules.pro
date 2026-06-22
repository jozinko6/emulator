# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class sk.jano.bavkac.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
}

# Kotlin
-dontwarn kotlin.**
-keep class kotlin.Metadata { *; }
