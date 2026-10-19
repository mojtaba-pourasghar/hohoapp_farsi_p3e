package com.hoohoofarsi.app.ui;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Looper;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.hoohoofarsi.app.MainActivity;
import com.hoohoofarsi.app.R;
import com.hoohoofarsi.app.data.Notices;
import com.hoohoofarsi.app.data.OnlineExam;
import com.hoohoofarsi.app.work.ExamReminders;

import java.util.List;

/**
 * Putting a notice in the phone's own notification tray.
 *
 * The app has no push service and no account — nothing knows this phone exists. What it has is a
 * file on the host that it already reads at launch, and that turns out to be enough for what the
 * notices are for: «a new worksheet is up», «the online exam opens on Thursday». The child sees
 * it next time they open the app; the tray entry is the part that brings them back.
 *
 * Which means a notice arrives when the app is next started, not the moment it is written. That
 * is the trade: no SDK, no account, no token, nothing about the phone leaving it — against news
 * that can be a day late. For this app it is the right way round, and anything with a deadline
 * carries an `until` so that news which has gone stale is dropped rather than shown late.
 *
 * Every notice shown here has had its signature checked first (see
 * {@link com.hoohoofarsi.app.data.NoticeSeal}); an unsigned one never reaches this class.
 */
public final class Announcements {

    public static final String CHANNEL = "hoohoo_news";

    /**
     * The exam countdown gets its own channel.
     *
     * «یک ربع تا آزمون» and «کاربرگ تازه آمد» are not the same kind of message, and Android lets
     * a parent silence one without the other only if they arrive on separate channels.
     */
    public static final String CHANNEL_EXAM = "hoohoo_exam";
    public static final int PERMISSION_REQUEST = 7301;

    private Announcements() {}

    /** Android 13 and up will not show a notification until the person has said yes once. */
    public static boolean permitted(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Asks for it — but only when there is something to say, so a child's first launch is a
     * lesson rather than a permission box.
     */
    public static void askIfUseful(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (permitted(activity) || !Notices.allowed(activity)) return;
        if (Notices.unseen(activity).isEmpty()) return;
        ActivityCompat.requestPermissions(activity,
            new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST);
    }

    /**
     * Asks — once, ever — to be let off battery optimisation, so news reaches a closed app.
     *
     * Without it Doze and App Standby may hold the background check back for hours, and «the
     * app was closed and nothing came» is exactly what that looks like. Only once notifications
     * are allowed (otherwise there is nothing to deliver) and news is switched on; a «no» is
     * respected and never asked again. {@link #askBackgroundAgain} is for the parent panel.
     */
    public static void askBackgroundOnce(Activity activity) {
        if (com.hoohoofarsi.app.data.AppState.get().getBoolean("asked_background", false)) return;
        if (!permitted(activity) || !Notices.allowed(activity)) return;
        if (runsInBackground(activity)) return;
        com.hoohoofarsi.app.data.AppState.get().setBoolean("asked_background", true);
        askBackgroundAgain(activity);
    }

    /** Whether the system already lets the app run its checks while the phone sleeps. */
    public static boolean runsInBackground(Context context) {
        android.os.PowerManager power = context.getSystemService(android.os.PowerManager.class);
        return power == null || power.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    /** The system's own «allow in background» box; falls back to the list if a maker hid it. */
    public static void askBackgroundAgain(Activity activity) {
        try {
            Intent ask = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                android.net.Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(ask);
        } catch (Exception noSuchScreen) {
            try {
                activity.startActivity(new Intent(
                    android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (Exception ignored) {
                // nothing to open on this phone; the checks still run, only slower
            }
        }
    }

    private static void deliver(Context context, Notices.Notice notice,
                                NotificationCompat.Builder built) {
        try {
            NotificationManagerCompat.from(context)
                .notify(Math.abs(notice.id.hashCode()), built.build());
        } catch (SecurityException refused) {
            // permission was taken away between the check and here
            // permission revoked between check and post: keep it due
            Notices.unclaimForTray(context, notice.id);

        }
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "خبرهای هوهو",
            NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("درس‌ها و کاربرگ‌های تازه، و خبرِ آزمون‌های آنلاین");
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private static void ensureExamChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_EXAM, "یادآورِ آزمون آنلاین",
            NotificationManager.IMPORTANCE_HIGH);     // it is about to start; it may interrupt
        channel.setDescription("نیم ساعت، یک ربع، ده، پنج و یک دقیقه مانده به آزمون");
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    /**
     * «آزمون نیم ساعت دیگر شروع می‌شود» — one of the five moments before an exam a child has
     * signed up for. Tapping it opens the exam screen itself, which is where they need to be.
     */
    public static void examCountdown(Context context, OnlineExam exam, int minutes) {
        if (!permitted(context)) return;
        ensureExamChannel(context);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("notice_screen", "ONLINE_EXAM");
        // with several exams on the host, one alarm per exam per moment — keep them apart
        PendingIntent tap = PendingIntent.getActivity(context, (exam.key() + minutes).hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String line = "🏆 " + exam.title;
        String body = "آزمون " + ExamReminders.wording(minutes);

        NotificationCompat.Builder built = new NotificationCompat.Builder(context, CHANNEL_EXAM)
            .setSmallIcon(R.drawable.ic_owl_face)
            .setContentTitle(line)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(tap)
            .setPriority(NotificationCompat.PRIORITY_HIGH);

        try {
            // one id for the whole countdown, so «۵ دقیقه» replaces «۱۵ دقیقه» instead of
            // leaving a column of stale reminders in the tray
            // (one id per exam: two exams on the same evening each keep their own line)
            NotificationManagerCompat.from(context).notify(9100 + (exam.key().hashCode() & 0x3ff),
                built.build());
        } catch (SecurityException refused) {
            // permission went away between the check and here
        }
    }

    /** Shows the picture large when the entry is pulled down, and small beside the title. */
    private static void withPicture(NotificationCompat.Builder built, Notices.Notice notice,
                                    Bitmap bitmap) {
        if (bitmap == null) return;
        built.setLargeIcon(bitmap)
            .setStyle(new NotificationCompat.BigPictureStyle()
                .bigPicture(bitmap)
                .bigLargeIcon((Bitmap) null)
                .setSummaryText(notice.body));
    }

    /**
     * Puts the most pressing notice that has not been to the tray yet into it — one, not all.
     *
     * The rest go out on later checks (every few minutes while the app is open, about every
     * quarter hour from {@link com.hoohoofarsi.app.work.NoticeWork} while it is closed), each no
     * sooner than {@link Notices#GAP_MS} after the last. See {@link Notices#claimNextForTray}.
     */
    public static void post(Context context) {
        if (!Notices.allowed(context) || !permitted(context)) return;
        ensureChannel(context);

        {
            Notices.Notice notice = Notices.claimNextForTray(context);
            if (notice == null) return;

            // What a tap on the tray entry does, in order: a screen inside the app; otherwise the
            // link, straight to the browser without opening the app at all; otherwise the app
            // opens and puts the notice up as its dialog, picture and all.
            Intent open;
            if (notice.destination().isEmpty() && !notice.link.isEmpty()) {
                open = new Intent(context, NoticeLinkActivity.class);
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
                open.putExtra(NoticeLinkActivity.EXTRA_ID, notice.id);
                open.putExtra(NoticeLinkActivity.EXTRA_LINK, notice.link);
            } else {
                open = new Intent(context, MainActivity.class);
                open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                open.putExtra("notice_id", notice.id);
                if (!notice.destination().isEmpty()) {
                    open.putExtra("notice_screen", notice.destination());
                } else {
                    open.putExtra("notice_show", true);
                }
            }

            PendingIntent tap = PendingIntent.getActivity(context, notice.id.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder built = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_owl_face)
                .setContentTitle(notice.title)
                .setContentText(notice.body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(notice.body))
                .setAutoCancel(true)
                .setContentIntent(tap)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);

            // A notice with a picture carries it into the tray: fetched now if it is not on the
            // phone yet, and only shown once it matches the hash in the signed text. If it cannot
            // be had — no connection, wrong bytes — the words still go out on their own.
            if (notice.hasImage()) {
                if (Looper.myLooper() == Looper.getMainLooper()) {
                    // the app is open: the download must not block the screen
                    NoticeArt.load(context, notice, bitmap -> {
                        withPicture(built, notice, bitmap);
                        deliver(context, notice, built);
                    });
                    return;
                }
                // the background worker: its own thread, and gone as soon as it returns
                withPicture(built, notice, NoticeArt.loadNow(context, notice));
            }
            deliver(context, notice, built);
        }
    }
}
