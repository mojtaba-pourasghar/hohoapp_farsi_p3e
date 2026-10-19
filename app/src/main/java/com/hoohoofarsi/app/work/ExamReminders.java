package com.hoohoofarsi.app.work;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.hoohoofarsi.app.data.AppState;
import com.hoohoofarsi.app.data.Notices;
import com.hoohoofarsi.app.data.OnlineExam;

/**
 * «نیم ساعت مانده» — counting a child down to the online exam.
 *
 * The exam is one evening, at one time, for everybody. A child who signed up a fortnight ago has
 * no reason to remember which evening, and the app cannot rely on being open to tell them: the
 * reminders have to come from the phone itself.
 *
 * So the five moments before it starts are handed to the system's alarm clock, and the app can
 * be closed the whole time. They are set whenever the exam is fetched — the background check
 * does that every quarter of an hour — and again the moment a child signs up, so the first
 * reminder does not wait for the next check.
 *
 * **Only for a child who signed up, and only before they have sat it.** Reminding everyone would
 * be an advertisement; reminding someone who has already handed their paper in is noise.
 *
 * On the alarm's accuracy: these are `setAndAllowWhileIdle`, which wakes a sleeping phone but is
 * inexact — Android grants one such alarm roughly every nine minutes in Doze. «پنج دقیقه مانده»
 * may therefore arrive at six or seven, and the notification says «نزدیکِ…» rather than naming a
 * number it cannot promise. The exact kind needs SCHEDULE_EXACT_ALARM, which is for alarm clocks
 * and calendars, and a farsi app asking for it would deserve the refusal.
 */
public final class ExamReminders {

    /** Minutes before the start, longest first. */
    public static final int[] BEFORE = { 30, 15, 10, 5, 1 };

    /** What the child is told at each of them. */
    public static String wording(int minutes) {
        switch (minutes) {
            case 30: return "نیم ساعت دیگر شروع می‌شود";
            case 15: return "یک ربع دیگر شروع می‌شود";
            case 10: return "ده دقیقه‌ی دیگر شروع می‌شود";
            case 5:  return "پنج دقیقه‌ی دیگر شروع می‌شود";
            default: return "همین حالا شروع می‌شود — بدو!";
        }
    }

    private ExamReminders() {}

    private static PendingIntent slot(Context context, String examKey, int minutes, boolean make) {
        Intent intent = new Intent(context, ExamAlarm.class)
            .setAction("hoohoo.exam." + examKey + "." + minutes)
            .putExtra("minutes", minutes)
            .putExtra("examKey", examKey);
        int flags = PendingIntent.FLAG_IMMUTABLE | (make ? PendingIntent.FLAG_UPDATE_CURRENT
                                                         : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(context, (examKey + minutes).hashCode(), intent, flags);
    }

    /**
     * Sets, moves or clears the five reminders to match what is known right now.
     *
     * Safe to call as often as anything likes: each alarm is replaced rather than added to, so
     * the quarter-hourly check cannot pile up five more every time it runs.
     */
    public static void refresh(Context context) {
        Context app = context.getApplicationContext();
        // every exam on the host gets its own five reminders, keyed by its own id
        for (OnlineExam exam : OnlineExam.cachedAll(app)) refresh(app, exam);
    }

    private static void refresh(Context app, OnlineExam exam) {
        clear(app, exam.key());

        if (!Notices.allowed(app)) return;              // the parent turned announcements off
        if (!exam.announced() || exam.startsAt <= 0) return;
        AppState state = AppState.get();
        if (!state.getBoolean(exam.key() + "_registered", false)) return;
        if (state.getBoolean(exam.key() + "_done", false)) return;

        AlarmManager alarms = app.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        long now = System.currentTimeMillis();

        for (int minutes : BEFORE) {
            long when = exam.startsAt - minutes * 60_000L;
            if (when <= now) continue;                  // that moment has already gone by
            PendingIntent fire = slot(app, exam.key(), minutes, true);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, fire);
                } else {
                    alarms.set(AlarmManager.RTC_WAKEUP, when, fire);
                }
            } catch (Exception refused) {
                // some makers cap how many alarms an app may hold; the rest still stand
            }
        }
    }

    /** Takes back every reminder for one exam — on unregistering, finishing, or a new exam. */
    public static void clear(Context context, String examKey) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        for (int minutes : BEFORE) {
            PendingIntent existing = slot(context.getApplicationContext(), examKey, minutes, false);
            if (existing != null) {
                alarms.cancel(existing);
                existing.cancel();
            }
        }
    }
}
