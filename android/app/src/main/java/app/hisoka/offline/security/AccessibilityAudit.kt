package app.hisoka.offline.security

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.pm.ApplicationInfo
import android.view.accessibility.AccessibilityManager

/** Accessibility services can read everything on screen; preinstalled ones (e.g. TalkBack) are not reported. */
object AccessibilityAudit {
    fun nonSystemServices(context: Context): List<String> {
        val manager = context.getSystemService(AccessibilityManager::class.java) ?: return emptyList()
        val pm = context.packageManager
        return manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .mapNotNull { it.resolveInfo?.serviceInfo }
            .filter { it.applicationInfo.flags and (ApplicationInfo.FLAG_SYSTEM or ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0 }
            .map { runCatching { it.applicationInfo.loadLabel(pm).toString() }.getOrDefault(it.packageName) }
            .distinct()
    }
}
