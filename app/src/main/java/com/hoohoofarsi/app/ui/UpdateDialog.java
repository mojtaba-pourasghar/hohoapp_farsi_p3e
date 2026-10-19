package com.hoohoofarsi.app.ui;

import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.hoohoofarsi.app.BuildConfig;
import com.hoohoofarsi.app.R;
import com.hoohoofarsi.app.data.Notices;

import static com.hoohoofarsi.app.data.PersianDigits.fa;

/**
 * «نسخه‌ی تازه‌ای آمده» — told once a day, never more.
 *
 * The version and the link come from the signed notices file, so a host that has been taken over
 * cannot point a child at someone else's APK; see {@link Notices#updateWaiting}.
 *
 * It closes. An update is a suggestion — the app the child has still works, and nagging a
 * seven-year-old about a version number every time they open a lesson would be worse than being
 * a version behind.
 */
public final class UpdateDialog {

    private UpdateDialog() {}

    /** Puts it up if there is a newer version and today has not already asked. Null otherwise. */
    public static Dialog showIfDue(FragmentActivity activity) {
        if (!Notices.updateDue(activity)) return null;
        Notices.Update update = Notices.updateWaiting(activity);
        if (update == null) return null;
        Notices.askedAboutUpdate(activity);

        Context context = activity;
        LinearLayout card = UiKit.column(context);
        int pad = UiKit.dp(context, 18);
        card.setPadding(pad, pad, pad, pad);
        UiKit.applyCardBg(card, context, R.color.bg_card, R.color.teal_border);

        TextView title = UiKit.text(context, "✨ نسخه‌ی تازه‌ی هوهو آمده", 16f,
            R.color.teal_dark, true);
        title.setGravity(Gravity.CENTER);
        card.addView(title);

        TextView which = UiKit.text(context,
            "الان نسخه‌ی " + fa(BuildConfig.VERSION_NAME) + " را داری؛ "
                + "نسخه‌ی " + fa(update.version) + " آماده است.",
            13f, R.color.text_primary, false);
        which.setGravity(Gravity.CENTER);
        which.setLineSpacing(UiKit.dp(context, 4), 1f);
        card.addView(which, UiKit.marginParams(context, 10, 0));

        if (!update.note.isEmpty()) {
            TextView note = UiKit.text(context, update.note, 12.5f, R.color.text_muted, false);
            note.setGravity(Gravity.CENTER);
            note.setLineSpacing(UiKit.dp(context, 4), 1f);
            card.addView(note, UiKit.marginParams(context, 8, 0));
        }

        LinearLayout wrap = UiKit.column(context);
        int side = UiKit.dp(context, 18);
        wrap.setPadding(side, 0, side, 0);
        wrap.addView(card);

        AlertDialog dialog = new AlertDialog.Builder(context).setView(wrap).create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }

        TextView get = UiKit.primaryButton(context, "دانلودِ نسخه‌ی تازه",
            ContextCompat.getColor(context, R.color.teal), R.color.white);
        get.setLayoutParams(UiKit.marginParams(context, 16, 0));
        get.setOnClickListener(v -> {
            try {
                activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(update.url)));
            } catch (Exception noBrowser) {
                // nothing on the phone will open it; the dialog still closes
            }
            close(dialog);
        });
        UiKit.tapSound(get);
        card.addView(get);

        TextView later = UiKit.text(context, "بعداً", 13f, R.color.text_muted, true);
        later.setGravity(Gravity.CENTER);
        int vp = UiKit.dp(context, 12);
        later.setPadding(0, vp, 0, vp);
        later.setOnClickListener(v -> close(dialog));
        UiKit.tapSound(later);
        card.addView(later, UiKit.marginParams(context, 6, 0));

        dialog.show();
        return dialog;
    }

    private static void close(Dialog dialog) {
        try {
            dialog.dismiss();
        } catch (Exception gone) {
            // the window went with its activity
        }
    }
}
