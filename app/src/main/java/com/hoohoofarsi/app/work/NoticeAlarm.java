package com.hoohoofarsi.app.work;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

import com.hoohoofarsi.app.data.Notices;

/**
 * The second way of looking for news while the app is closed — beside {@link NoticeWork}, not
 * instead of it.
 *
 * WorkManager alone was not enough: on a phone in Doze, or for an app the system has decided is
 * rarely used (App Standby), a periodic job can slip from a quarter of an hour to several hours,
 * and a notice published in the afternoon arrived the next day — «with the app closed nothing
 * comes». An alarm set with `setAndAllowWhileIdle` is let through in Doze about every nine
 * minutes, and while it fires the app is briefly allowed onto the network, which is exactly the
 * window the check needs.
 *
 * It is a chain: each alarm sets the next before it does anything else, so a check that fails
 * half-way never breaks it. The check runs right here, on its own thread under `goAsync`, rather
 * than being handed to WorkManager — a job queued from inside Doze would wait for the very
 * maintenance window this exists to avoid.
 *
 * The same rules hold as everywhere else (one at a time, spaced, signed file only), because they
 * live in {@link Notices}; {@link NoticeWork#check} is the one entry point both paths share.
 */
public class NoticeAlarm extends BroadcastReceiver {

    private static final String ACTION = "com.hoohoofarsi.app.NOTICE_CHECK";
    private static final long EVERY_MS = 15 * 60 * 1000L;
    private static final int REQUEST = 7402;

    private static PendingIntent pending(Context context, boolean make) {
        Intent intent = new Intent(context.getApplicationContext(), NoticeAlarm.class)
            .setAction(ACTION);
        int flags = PendingIntent.FLAG_IMMUTABLE
            | (make ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(context.getApplicationContext(), REQUEST, intent, flags);
    }

    /**
     * Makes sure the chain is running, without pushing back an alarm that is already set — so
     * opening the app ten times an hour does not keep postponing the next background check.
     */
    public static void ensure(Context context) {
        // A PendingIntent outlives the alarm that fired it, so its existence proves nothing; the
        // time the next one is due does. Missing, overdue by more than a period (the chain broke
        // — a force-stop, an update), or from before a reboot (elapsed time restarted): set it.
        long due = prefs(context).getLong(DUE_AT, 0);
        long now = SystemClock.elapsedRealtime();
        if (pending(context, false) == null || due <= 0 || due > now + EVERY_MS
                || now > due + EVERY_MS) {
            schedule(context);
        }
    }

    /** Sets the next check a quarter of an hour from now, replacing any earlier one. */
    public static void schedule(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        long at = SystemClock.elapsedRealtime() + EVERY_MS;
        try {
            alarms.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at,
                pending(context, true));
            prefs(context).edit().putLong(DUE_AT, at).apply();
        } catch (Exception refused) {
            // some makers cap how many alarms an app may hold; WorkManager still looks
        }
    }

    private static final String DUE_AT = "noticeAlarmDueAt";

    private static android.content.SharedPreferences prefs(Context context) {
        return context.getApplicationContext()
            .getSharedPreferences("hoohoo_notice_alarm", Context.MODE_PRIVATE);
    }

    /** Stops the chain — «خبرها خاموش» in the parent panel. */
    public static void cancel(Context context) {
        PendingIntent existing = pending(context, false);
        if (existing == null) return;
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms != null) alarms.cancel(existing);
        existing.cancel();
        prefs(context).edit().remove(DUE_AT).apply();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        Context app = context.getApplicationContext();
        if (!Notices.allowed(app)) {
            cancel(app);
            return;
        }
        // the next link first: whatever happens below, the chain goes on
        schedule(app);

        // A background broadcast has about a minute before the system calls it hung. A slow host
        // (three files and a picture, each allowed its own timeout) could outlast that, so the
        // broadcast is let go at fifty seconds whatever happens; the thread may still finish.
        PendingResult result = goAsync();
        java.util.concurrent.atomic.AtomicBoolean done = new java.util.concurrent.atomic.AtomicBoolean();
        Runnable finish = () -> {
            if (done.compareAndSet(false, true)) result.finish();
        };
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(finish, 50_000L);
        new Thread(() -> {
            try {
                NoticeWork.check(app);
            } catch (Exception ignored) {
                // a bad network moment; the next alarm tries again
            } finally {
                finish.run();
            }
        }, "hoohoo-notice-alarm").start();
    }
}
