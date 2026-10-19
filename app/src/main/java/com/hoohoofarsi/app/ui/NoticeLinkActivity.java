package com.hoohoofarsi.app.ui;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.hoohoofarsi.app.data.Notices;

/**
 * A tap on a notice in the tray that carries a link.
 *
 * The link opens and the app does not: no splash, no map behind the browser. Nothing is drawn —
 * the theme is transparent and the activity is gone before the browser is up.
 *
 * It is an activity and not a receiver on purpose. Since Android 12 a notification may not
 * bounce through a BroadcastReceiver to start something; going straight to the browser would
 * work, but then nothing would note that the notice has been read, and the same news would come
 * up again as a dialog the next time the app is opened.
 */
public class NoticeLinkActivity extends Activity {

    public static final String EXTRA_ID = "notice_id";
    public static final String EXTRA_LINK = "notice_link";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String id = getIntent().getStringExtra(EXTRA_ID);
        if (id != null) Notices.markSeen(this, id);
        String link = getIntent().getStringExtra(EXTRA_LINK);
        if (link != null && !link.isEmpty()) {
            try {
                // its own task: the browser must not live inside this one, which ends right here
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(link))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception noBrowser) {
                // nothing on the phone opens it; the notice has still been read
            }
        }
        finish();
        overridePendingTransition(0, 0);
    }
}
