package com.hoohoofarsi.app.work;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.hoohoofarsi.app.data.Notices;
import com.hoohoofarsi.app.ui.Announcements;

import java.util.concurrent.TimeUnit;

/**
 * Looking for news while the app is closed.
 *
 * This is what makes a notice arrive on a phone sitting in a bag, which is the whole thing a
 * push service would have been for — and it costs no SDK, no account and no third party: the
 * system wakes the app now and then, it fetches the same small signed file, and anything new
 * goes to the notification tray.
 *
 * **Fifteen minutes is the floor, and it is Android's floor, not a number picked here.**
 * `PeriodicWorkRequest` refuses anything shorter whatever it is asked for, and in Doze — a phone
 * face down on a table overnight — even that is batched into the maintenance windows the system
 * chooses, so the real gap can be longer. There is no setting that changes this: delivering the
 * instant something is published is exactly what a push service does, and what a phone cannot do
 * for itself. This gets as close as the platform allows.
 *
 * It only runs with a connection — there is nothing to do without one — and the same «one a day»
 * and «late news is no news» rules apply, because they live in {@link Notices} rather than in
 * whoever happens to be asking.
 *
 * It survives a reboot without a BOOT_COMPLETED receiver of its own: WorkManager keeps the queue
 * in its own database and reschedules everything in it when the phone comes back up.
 *
 * On its own it was too slow: Doze and App Standby can stretch «every fifteen minutes» to hours.
 * {@link NoticeAlarm} runs beside it and gets through Doze; both call {@link #check}.
 */
public class NoticeWork extends Worker {

    private static final String NAME = "hoohoo-notices";
    private static final long EVERY_MINUTES = 15;        // the shortest Android will accept

    public NoticeWork(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    /** Asks the system to keep checking. Safe to call on every launch; it replaces nothing. */
    public static void schedule(Context context) {
        try {
            PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(
                NoticeWork.class, EVERY_MINUTES, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build())
                .setBackoffCriteria(BackoffPolicy.LINEAR, 5, TimeUnit.MINUTES)
                .build();
            // UPDATE, not KEEP: a copy of the app installed when the period was half an hour
            // would otherwise keep that schedule for as long as it stayed installed.
            WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, work);
        } catch (Exception notAvailable) {
            // WorkManager could not start; the in-app checks still run
        }
        // and the alarm chain beside it — the one that gets through Doze (see NoticeAlarm)
        NoticeAlarm.ensure(context);
    }

    /** Stops looking — what «خبرها خاموش» means once the app is closed. */
    public static void cancel(Context context) {
        NoticeAlarm.cancel(context);
        try {
            WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(NAME);
        } catch (Exception ignored) {
            // nothing was scheduled
        }
    }

    /**
     * Looks once, now.
     *
     * Used when the app is closing: a child who has just put the phone down is the most likely
     * person to still be near it, so one last check costs little and can turn a fifteen-minute
     * wait into none at all.
     */
    public static void once(Context context) {
        try {
            // unique and replacing: onPause fires on every rotation and every time another
            // screen covers the app, and a queue of identical checks helps nobody
            WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
                NAME + "-now", ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(NoticeWork.class)
                    .setConstraints(new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build())
                    .build());
        } catch (Exception notAvailable) {
            // nothing to fall back to; the periodic check still runs
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        if (!Notices.allowed(context)) return Result.success();
        // the alarm chain is the faster of the two; a worker that runs is a good moment to make
        // sure it is still there (an update or a force-stop clears alarms, not this queue)
        NoticeAlarm.ensure(context);
        check(context);
        return Result.success();
    }

    /**
     * One background look: fetch, put the next notice in the tray, refresh the exam.
     *
     * Shared by this worker and {@link NoticeAlarm}, and synchronized because the two can fire
     * in the same minute — without it both could pick the same notice off the queue and the
     * tray would get it twice. Must be called off the main thread.
     */
    public static synchronized void check(Context context) {
        Context app = context.getApplicationContext();
        if (!Notices.allowed(app)) return;
        Notices.refreshNow(app);
        Announcements.post(app);

        // The exam comes down in the same pass. Its date is what the five countdown reminders
        // are set from, so a date the teacher moved reaches the phone without the app being
        // opened — and the alarms move with it.
        com.hoohoofarsi.app.data.OnlineExam.loadNow(app);
        ExamReminders.refresh(app);
    }
}
