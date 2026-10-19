package com.hoohoofarsi.app.ui;

import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.FragmentActivity;

import com.hoohoofarsi.app.R;
import com.hoohoofarsi.app.data.Notices;

/**
 * خبر — the notice, shown to the child as a card in the middle of the screen.
 *
 * The tray entry brings them back to the app; this is what they see when they are in it. Title,
 * picture if there is one, the words, and at most two things to do: go where the notice points,
 * or put it away.
 *
 * Unlike {@link VoiceGate} this one closes. It is news, not a prerequisite, and a child who taps
 * outside it or presses back has said «not now» — which is an answer, and is taken as one: the
 * notice stays unseen and comes round again tomorrow, not in five minutes.
 *
 * One a day, whatever has piled up behind it — see {@link Notices#dueNow}. Which screen it is
 * allowed to appear over is {@link com.hoohoofarsi.app.MainActivity}'s decision, not this class's.
 */
public final class NoticeDialog {

    private NoticeDialog() {}

    public static Dialog show(FragmentActivity activity, Notices.Notice notice, Runnable afterwards) {
        Context context = activity;
        LinearLayout card = UiKit.column(context);
        int pad = UiKit.dp(context, 18);
        card.setPadding(pad, pad, pad, pad);
        UiKit.applyCardBg(card, context, R.color.bg_card, R.color.orange_border);

        TextView title = UiKit.text(context, "📣 " + notice.title, 16f, R.color.orange_text, true);
        title.setGravity(Gravity.CENTER);
        title.setLineSpacing(UiKit.dp(context, 4), 1f);
        card.addView(title);

        // The picture arrives after the card is already up: it may need fetching, and a child
        // staring at nothing while a photo downloads is worse than a card that grows one.
        final ImageView picture = new ImageView(context);
        if (notice.hasImage()) {
            picture.setAdjustViewBounds(true);
            picture.setScaleType(ImageView.ScaleType.FIT_CENTER);
            picture.setMaxHeight(UiKit.dp(context, 280));   // a tall poster must not push the buttons off
            picture.setVisibility(View.GONE);
            card.addView(picture, UiKit.marginParams(context, 12, 0));
            NoticeArt.load(context, notice, bitmap -> {
                if (bitmap == null) return;         // no picture, or not the one that was signed
                picture.setImageBitmap(bitmap);
                picture.setVisibility(View.VISIBLE);
            });
        }

        if (!notice.body.isEmpty()) {
            TextView body = UiKit.text(context, notice.body, 13.5f, R.color.text_primary, false);
            body.setGravity(Gravity.CENTER);
            body.setLineSpacing(UiKit.dp(context, 5), 1f);
            card.addView(body, UiKit.marginParams(context, 12, 0));
        }

        LinearLayout wrap = UiKit.column(context);
        int side = UiKit.dp(context, 18);
        wrap.setPadding(side, 0, side, 0);
        wrap.addView(card);

        AlertDialog dialog = new AlertDialog.Builder(context).setView(wrap).create();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }

        Runnable close = () -> {
            try {
                dialog.dismiss();
            } catch (Exception gone) {
                // the window went with its activity
            }
            if (afterwards != null) afterwards.run();
        };

        String where = destination(notice);

        // The picture is the biggest thing on the card, and the first thing a child taps. When
        // the notice has somewhere to go, the picture goes there too.
        if (notice.hasImage() && !where.isEmpty()) {
            picture.setClickable(true);
            picture.setOnClickListener(v -> {
                Notices.markSeen(context, notice.id);
                follow(activity, notice);
                close.run();
            });
            UiKit.tapSound(picture);
        }

        if (!where.isEmpty()) {
            TextView go = UiKit.primaryButton(context, where,
                androidx.core.content.ContextCompat.getColor(context, R.color.teal), R.color.white);
            go.setLayoutParams(UiKit.marginParams(context, 16, 0));
            go.setOnClickListener(v -> {
                Notices.markSeen(context, notice.id);   // acting on it is the strongest «seen»
                follow(activity, notice);
                close.run();
            });
            UiKit.tapSound(go);
            card.addView(go);
        }

        TextView later = UiKit.text(context, where.isEmpty() ? "باشه" : "بعداً", 13f,
            R.color.teal_dark, true);
        later.setGravity(Gravity.CENTER);
        int vp = UiKit.dp(context, 12);
        later.setPadding(0, vp, 0, vp);
        UiKit.applyCardBg(later, context, R.color.bg_card, R.color.teal_border);
        later.setOnClickListener(v -> {
            if (where.isEmpty()) Notices.markSeen(context, notice.id);
            close.run();
        });
        UiKit.tapSound(later);
        card.addView(later, UiKit.marginParams(context, 10, 0));

        dialog.setOnCancelListener(d -> {
            if (afterwards != null) afterwards.run();
        });
        dialog.show();
        return dialog;
    }

    /** What the button should say, or nothing when the notice is only words. */
    private static String destination(Notices.Notice notice) {
        if (!notice.destination().isEmpty()) return "بریم ببینیم";
        if (!notice.link.isEmpty()) return "باز کردن لینک";
        return "";
    }

    /**
     * Follows the notice. A screen inside the app wins over a link: it is the one that cannot
     * take a child anywhere unexpected.
     */
    /** Opens a notice's link in whatever the phone uses for links. Quietly does nothing if none. */
    public static void openLink(Context context, String link) {
        if (link == null || link.isEmpty()) return;
        try {
            Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(link));
            if (!(context instanceof android.app.Activity)) view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(view);
        } catch (Exception noBrowser) {
            // nothing on the phone wants to open it; the notice has still been read
        }
    }

    private static void follow(FragmentActivity activity, Notices.Notice notice) {
        if (!notice.destination().isEmpty()) {
            try {
                ((Navigator) activity).go(Screen.valueOf(notice.destination()), null);
                return;
            } catch (IllegalArgumentException unknown) {
                // news written for a newer version of the app; fall through to the link
            }
        }
        openLink(activity, notice.link);
    }
}
