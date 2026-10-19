package com.hoohoofarsi.app.work;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.hoohoofarsi.app.data.Notices;

/**
 * Putting the exam reminders back after the phone restarts.
 *
 * AlarmManager forgets everything on a reboot — unlike WorkManager, which keeps its queue in a
 * database and reschedules itself, so the quarter-hourly check needs nothing here. The exam
 * countdown does: without this, a phone restarted the morning of the exam would simply never
 * ring.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        // an app update clears every alarm too, exactly like a reboot does
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
            && !"android.intent.action.QUICKBOOT_POWERON".equals(action)
            && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }
        ExamReminders.refresh(context);
        // gated: a parent who switched news off stays off even across a reboot
        if (Notices.allowed(context)) NoticeWork.schedule(context);
        else NoticeWork.cancel(context);
    }
}
