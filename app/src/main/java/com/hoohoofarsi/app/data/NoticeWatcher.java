package com.hoohoofarsi.app.data;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

/**
 * The clock that asks the host whether anything new has been written.
 *
 * There is no push service, so nothing can reach the app on its own: the app has to look. It
 * looks twice over — here, every few minutes while a child has it open, and in the background
 * through {@link com.hoohoofarsi.app.work.NoticeWork} when they do not.
 *
 * A socket would not help. The notices are a file on shared web hosting; there is nothing at the
 * other end to hold a connection open, and a socket kept alive on a child's phone would cost
 * battery all day to save a few minutes on news that is never that urgent. Asking a static file
 * whether it has changed is both cheaper and the only thing the host can actually answer.
 *
 * Checks are cheap and get cheaper: the file is a few hundred bytes, and when it has not changed
 * {@link Notices#refresh} notices the identical bytes and does nothing at all.
 */
public final class NoticeWatcher {

    /** Often enough that «the exam starts in ten minutes» lands; rare enough to be free. */
    private static final long EVERY_MS = 2 * 60 * 1000L;

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static Runnable beat;
    private static Runnable onNews;

    private NoticeWatcher() {}

    /**
     * Starts looking, and keeps looking until {@link #stop}.
     *
     * `whenSomethingArrived` runs on the main thread each time the file actually changed — not
     * on every check — so a screen can put up what came in without being woken for nothing.
     */
    public static void start(Context context, Runnable whenSomethingArrived) {
        start(context, whenSomethingArrived, null);
    }

    /**
     * As above, plus `everyBeat`, run on every check whether or not anything changed — for news
     * already on the phone whose turn comes round while the app is open (see Notices.GAP_MS).
     */
    public static void start(Context context, Runnable whenSomethingArrived, Runnable everyBeat) {
        Context app = context.getApplicationContext();
        onNews = whenSomethingArrived;
        stop();
        beat = new Runnable() {
            @Override public void run() {
                Notices.refresh(app, () -> {
                    if (onNews != null) onNews.run();
                });
                if (everyBeat != null) everyBeat.run();
                MAIN.postDelayed(this, EVERY_MS);
            }
        };
        MAIN.post(beat);        // and once right now, so opening the app is itself a check
    }

    public static void stop() {
        if (beat != null) MAIN.removeCallbacks(beat);
        beat = null;
    }
}
