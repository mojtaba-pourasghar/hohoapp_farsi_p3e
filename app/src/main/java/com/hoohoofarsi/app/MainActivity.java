package com.hoohoofarsi.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.PorterDuff;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import android.widget.Toast;
import java.util.Stack;

import com.hoohoofarsi.app.billing.Bazaar;
import com.hoohoofarsi.app.billing.Entitlement;
import com.hoohoofarsi.app.billing.Receipt;

import com.hoohoofarsi.app.data.AppState;
import com.hoohoofarsi.app.tts.NarrationText;
import com.hoohoofarsi.app.tts.SoundManager;
import com.hoohoofarsi.app.data.NoticeWatcher;
import com.hoohoofarsi.app.data.Notices;
import com.hoohoofarsi.app.work.NoticeWork;
import com.hoohoofarsi.app.tts.VoiceStore;
import com.hoohoofarsi.app.ui.Announcements;
import com.hoohoofarsi.app.ui.BaseFragment;
import com.hoohoofarsi.app.ui.NoticeDialog;
import com.hoohoofarsi.app.ui.UpdateDialog;
import com.hoohoofarsi.app.ui.Navigator;
import com.hoohoofarsi.app.ui.Screen;
import com.hoohoofarsi.app.ui.UiKit;
import com.hoohoofarsi.app.ui.mascot.HooHooView;
import com.hoohoofarsi.app.ui.mascot.MascotController;
import com.hoohoofarsi.app.ui.screens.ChaptersFragment;
import com.hoohoofarsi.app.ui.screens.ExamIndexFragment;
import com.hoohoofarsi.app.ui.screens.LessonFragment;
import com.hoohoofarsi.app.ui.screens.MapFragment;
import com.hoohoofarsi.app.ui.screens.OnlineExamFragment;
import com.hoohoofarsi.app.ui.screens.ParentGateFragment;
import com.hoohoofarsi.app.ui.screens.ParentPanelFragment;
import com.hoohoofarsi.app.ui.screens.PaywallFragment;
import com.hoohoofarsi.app.ui.screens.ProfileFragment;
import com.hoohoofarsi.app.ui.screens.QuizFragment;
import com.hoohoofarsi.app.ui.screens.ResultFragment;
import com.hoohoofarsi.app.ui.screens.RewardsFragment;
import com.hoohoofarsi.app.ui.screens.SectionsFragment;
import com.hoohoofarsi.app.ui.screens.SplashFragment;
import com.hoohoofarsi.app.ui.screens.VoiceDownloadFragment;
import com.hoohoofarsi.app.ui.screens.WorksheetDownloadFragment;
import com.hoohoofarsi.app.ui.screens.WorksheetIndexFragment;

import java.util.Locale;

public class MainActivity extends AppCompatActivity implements Navigator {

    private MascotController mascotController;
    private View navBar;
    private View mascotOverlay;
    private Screen currentScreen;

    private View navMap, navSections, navWorksheet, navExam, navParent;
    private long lastBackPressTime = 0;

    /**
     * Where the child has been, so back retraces it.
     *
     * The arguments travel with the screen. Without them, backing out of a lesson landed on
     * «chapter 1 section 1» whatever chapter the child had actually come from, which reads as the
     * app losing their place.
     */
    private static final class Step {
        final Screen screen;
        final Bundle args;
        Step(Screen screen, Bundle args) {
            this.screen = screen;
            this.args = args;
        }
    }

    private final Stack<Step> backStack = new Stack<>();
    private Bundle currentArgs;

    /** Today's notice while it is on screen, or null. One slot: a second one waits its turn. */
    private android.app.Dialog noticeDialog;
    /** A tray tap that points at no screen: the notice to open once the app is up. */
    private String requestedNotice;

    @Override
    protected void attachBaseContext(Context newBase) {
        Locale fa = new Locale("fa", "IR");
        Configuration config = new Configuration(newBase.getResources().getConfiguration());
        config.setLocale(fa);
        config.setLayoutDirection(fa);
        Context context = newBase.createConfigurationContext(config);
        super.attachBaseContext(context);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // the words هوهو says live in res/raw/audio_manifest.txt; read them while the splash shows
        NarrationText.preload(this);

        // the clips themselves are on the host, not in the APK. With a connection, the shared
        // ones and the chapter the child is on come down now so the first lesson already has
        // هوهو's own voice; the other chapters trickle in behind that.
        VoiceStore.startOnLaunch(this, AppState.get().taughtChapter);

        // Asks Bazaar what this account owns, once per launch. That is how a subscription bought
        // on another phone — or on this one before a reinstall — comes back without the parent
        // doing anything. A purchase that has gone is cleared, but only when the store actually
        // answered: a phone with no signal must never lock a paid child out.
        restore = new Bazaar(this);
        restore.restore(new Bazaar.Answer() {
            @Override public void onPurchase(Receipt.Purchase purchase) {
                if (purchase == null) Entitlement.revoke(MainActivity.this);
                else Entitlement.grant(MainActivity.this, purchase.sku, purchase.token, purchase.until);
            }

            @Override public void onProblem(String message) {
                // no store, no connection, nothing to conclude — what is stored stays
            }
        });

        navBar = findViewById(R.id.nav_bar);
        mascotOverlay = findViewById(R.id.mascot_overlay);

        HooHooView mascotView = findViewById(R.id.mascot_view);
        View bubbleWrap = findViewById(R.id.mascot_bubble_wrap);
        TextView bubbleText = findViewById(R.id.mascot_bubble);
        mascotController = new MascotController(mascotView, mascotOverlay, bubbleWrap, bubbleText);
        findViewById(R.id.mascot_bubble_close).setOnClickListener(v -> mascotController.dismissBubble());

        enableMascotDragging();

        navMap = findViewById(R.id.nav_map);
        navSections = findViewById(R.id.nav_sections);
        navWorksheet = findViewById(R.id.nav_worksheet);
        navExam = findViewById(R.id.nav_exam);
        navParent = findViewById(R.id.nav_parent);

        bindNavItem(navMap, R.drawable.ic_pin, "نقشه", () -> go(Screen.MAP));
        bindNavItem(navSections, R.drawable.ic_pencil, "تمرین", () -> go(Screen.SECTIONS));
        bindNavItem(navWorksheet, R.drawable.ic_sheet, "کاربرگ", () -> go(Screen.WORKSHEET_INDEX));
        bindNavItem(navExam, R.drawable.ic_target, "آزمون", () -> go(Screen.EXAM_INDEX));
        bindNavItem(navParent, R.drawable.ic_shield, "والدین", this::goParent);

        // The news. There is no push service, so the app looks rather than being told: a few
        // minutes apart while it is open, and through the system's scheduler while it is not.
        // Whatever is already on the device is shown at once.
        Announcements.post(this);
        Announcements.askIfUseful(this);
        if (Notices.allowed(this)) NoticeWork.schedule(this);
        // for phones where notifications were already allowed (Android 12 and below, or a yes
        // given earlier) — asked once, and a no is final
        Announcements.askBackgroundOnce(this);

        if (savedInstanceState == null) {
            Screen opened = screenFromNotice(getIntent());
            go(opened != null ? opened : Screen.SPLASH);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (currentScreen == Screen.SPLASH) {
                    finish();
                    return;
                }
                // the screen itself gets first refusal: inside a lesson or a quiz, back means
                // «the step before this one», not «throw this away»
                Fragment showing = getSupportFragmentManager().findFragmentById(R.id.fragment_container);
                if (showing instanceof BaseFragment && ((BaseFragment) showing).onBackPressed()) {
                    return;
                }
                if (!backStack.isEmpty()) {
                    Step prev = backStack.pop();
                    go(prev.screen, prev.args, false);
                    return;
                }
                // nothing behind this screen: the first press warns, the second one leaves
                long now = System.currentTimeMillis();
                if (now - lastBackPressTime < 2000) {
                    finish();
                } else {
                    lastBackPressTime = now;
                    Toast.makeText(MainActivity.this,
                        "برای خروج از برنامه دوباره دکمه بازگشت را بزنید", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /** Tapped a notice in the tray while the app was already running. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Screen opened = screenFromNotice(intent);
        if (opened != null) go(opened);
        else showNoticeIfDue();         // a tapped notice with nowhere to go shows as its card
    }
    /**
     * The user just answered the notification permission box. A «yes» means the notices that
     * were waiting on that answer go to the tray now instead of at the next check.
     */
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == Announcements.PERMISSION_REQUEST) {
            Announcements.post(this);
            showNoticeIfDue();
            // notifications are on now; the next thing standing between the news and a closed
            // app is battery optimisation
            Announcements.askBackgroundOnce(this);
        }
    }

    /**
     * The screen a notice points at, or null. An unknown name is not an error — an older copy of
     * the app simply opens as usual rather than crashing on news written for a newer one.
     */
    private Screen screenFromNotice(Intent intent) {
        if (intent == null) return null;
        String id = intent.getStringExtra("notice_id");
        if (id != null) {
            Notices.markSeen(this, id);
            String link = intent.getStringExtra("notice_link");
            if (link != null && !link.isEmpty()) NoticeDialog.openLink(this, link);
            if (intent.getBooleanExtra("notice_show", false)) requestedNotice = id;
            intent.removeExtra("notice_id");
            intent.removeExtra("notice_link");
            intent.removeExtra("notice_show");
        }
        String name = intent.getStringExtra("notice_screen");
        if (name == null || name.isEmpty()) return null;
        try {
            return Screen.valueOf(name);
        } catch (IllegalArgumentException unknown) {
            return null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        NoticeWatcher.start(this, () -> {
            Announcements.post(this);
            Announcements.askIfUseful(this);
            showNoticeIfDue();
        }, () -> {
            Announcements.post(this);
            showNoticeIfDue();
        });
        showNoticeIfDue();
        SoundManager sound = SoundManager.get();
        if (sound != null) sound.startMusic();
    }

    @Override
    protected void onPause() {
        if (noticeDialog != null) {
            noticeDialog.dismiss();
            noticeDialog = null;
        }
        NoticeWatcher.stop();
        if (Notices.allowed(this)) NoticeWork.once(this);
        SoundManager sound = SoundManager.get();
        if (sound != null) sound.pauseMusic();
        super.onPause();
    }

    /**
     * Puts today's notice up, if this is a screen it is allowed on.
     *
     * The ordinary notice waits for the map. A notice the teacher marked «هر جای برنامه»
     * does not wait. The splash and the parent gate are still off limits.
     */
    private void showNoticeIfDue() {
        if (noticeDialog != null) return;
        if (currentScreen == null || currentScreen == Screen.SPLASH
            || currentScreen == Screen.PARENT_GATE) return;

        if (requestedNotice != null) {
            Notices.Notice asked = Notices.find(this, requestedNotice);
            requestedNotice = null;
            if (asked != null) {
                Notices.shownToday(this, asked.id);
                putUpNotice(asked);
                return;
            }
        }

        if (currentScreen == Screen.MAP) {
            noticeDialog = UpdateDialog.showIfDue(this);
            if (noticeDialog != null) {
                noticeDialog.setOnDismissListener(d -> {
                    noticeDialog = null;
                    if (navBar != null) navBar.postDelayed(() -> {
                        if (getLifecycle().getCurrentState().isAtLeast(
                                androidx.lifecycle.Lifecycle.State.RESUMED)) {
                            showNoticeIfDue();
                        }
                    }, 350);
                });
                return;
            }
        }

        Notices.Notice due = Notices.dueNow(this, currentScreen == Screen.MAP);
        if (due == null) return;

        Notices.shownToday(this, due.id);
        putUpNotice(due);
    }

    private void putUpNotice(Notices.Notice notice) {
        noticeDialog = NoticeDialog.show(this, notice, () -> {
            noticeDialog = null;
            Notices.markSeen(this, notice.id);
            Notices.shownToday(this, notice.id);
            Fragment showing = getSupportFragmentManager().findFragmentById(R.id.fragment_container);
            if (showing instanceof MapFragment) ((MapFragment) showing).refreshNotices();
            if (navBar != null) navBar.postDelayed(() -> {
                if (getLifecycle().getCurrentState().isAtLeast(
                        androidx.lifecycle.Lifecycle.State.RESUMED)) {
                    showNoticeIfDue();
                }
            }, Notices.GAP_MS + 500);
        });
    }

    /**
     * Lets the child pick هوهو up and put it wherever it isn't in the way. The spot is kept as a
     * fraction of the screen so it survives rotation and comes back next time.
     */
    @SuppressLint("ClickableViewAccessibility")
    private void enableMascotDragging() {
        final float[] down = new float[2];
        final float[] origin = new float[2];
        final boolean[] dragging = {false};

        mascotOverlay.setOnTouchListener((view, event) -> {
            ViewGroup parent = (ViewGroup) view.getParent();
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    down[0] = event.getRawX();
                    down[1] = event.getRawY();
                    origin[0] = view.getTranslationX();
                    origin[1] = view.getTranslationY();
                    dragging[0] = false;
                    return true;
                case MotionEvent.ACTION_MOVE: {
                    float dx = event.getRawX() - down[0];
                    float dy = event.getRawY() - down[1];
                    if (!dragging[0] && Math.hypot(dx, dy) < UiKit.dp(this, 8)) return true;
                    dragging[0] = true;
                    view.setTranslationX(clampX(parent, view, origin[0] + dx));
                    view.setTranslationY(clampY(parent, view, origin[1] + dy));
                    return true;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (dragging[0]) {
                        saveMascotPosition(parent, view);
                    } else {
                        // a tap on هوهو is how the child asks for her tooltip back
                        mascotController.allowBubble();
                        view.performClick();
                    }
                    return true;
                default:
                    return false;
            }
        });

        // wait for a real layout pass before restoring, otherwise the sizes are all zero
        mascotOverlay.getViewTreeObserver().addOnGlobalLayoutListener(
            new android.view.ViewTreeObserver.OnGlobalLayoutListener() {
                @Override
                public void onGlobalLayout() {
                    mascotOverlay.getViewTreeObserver().removeOnGlobalLayoutListener(this);
                    restoreMascotPosition();
                }
            });
    }

    private float clampX(ViewGroup parent, View view, float translation) {
        float min = -view.getLeft();
        float max = parent.getWidth() - view.getLeft() - view.getWidth();
        return Math.max(min, Math.min(translation, max));
    }

    private float clampY(ViewGroup parent, View view, float translation) {
        float min = -view.getTop();
        float max = parent.getHeight() - view.getTop() - view.getHeight();
        return Math.max(min, Math.min(translation, max));
    }

    private void saveMascotPosition(ViewGroup parent, View view) {
        if (parent.getWidth() == 0 || parent.getHeight() == 0) return;
        float x = (view.getLeft() + view.getTranslationX()) / parent.getWidth();
        float y = (view.getTop() + view.getTranslationY()) / parent.getHeight();
        AppState.get().setMascotPosition(x, y);
    }

    /**
     * Puts هوهو back where the child left her. Anything that would land her off-screen — a saved
     * spot from a different screen size, say — is ignored so she can never go missing.
     */
    private void restoreMascotPosition() {
        AppState s = AppState.get();
        if (s.mascotX < 0 || s.mascotY < 0) return;
        ViewGroup parent = (ViewGroup) mascotOverlay.getParent();
        if (parent == null || parent.getWidth() == 0 || mascotOverlay.getWidth() == 0) return;
        if (s.mascotX > 0.97f || s.mascotY > 0.97f) return;

        float targetX = s.mascotX * parent.getWidth();
        float targetY = s.mascotY * parent.getHeight();
        mascotOverlay.setTranslationX(clampX(parent, mascotOverlay, targetX - mascotOverlay.getLeft()));
        mascotOverlay.setTranslationY(clampY(parent, mascotOverlay, targetY - mascotOverlay.getTop()));
    }

    private interface Action { void run(); }

    private void bindNavItem(View item, int iconRes, String label, Action onClick) {
        ImageView icon = item.findViewById(R.id.nav_icon);
        TextView text = item.findViewById(R.id.nav_label);
        icon.setImageResource(iconRes);
        text.setText(label);
        item.setOnClickListener(v -> onClick.run());
        UiKit.tapSound(item);
    }

    /** Kept so the binding to the store can be let go of when the activity goes. */
    private Bazaar restore;

    @Override
    protected void onDestroy() {
        if (restore != null) restore.disconnect();
        super.onDestroy();
    }

    /**
     * The answer from Bazaar's payment screen.
     *
     * It arrives at the activity, not at the fragment that asked, so it is handed on to the
     * paywall if that is still what is on screen — and the purchase is verified and recorded
     * either way, so a parent who hits «back» the moment they have paid still gets what they
     * paid for.
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != Bazaar.PURCHASE_REQUEST) return;

        Receipt.Purchase purchase = Bazaar.fromResult(data);
        if (purchase != null) {
            Entitlement.grant(this, purchase.sku, purchase.token, purchase.until);
        }
        Fragment showing = getSupportFragmentManager().findFragmentById(R.id.fragment_container);
        if (showing instanceof PaywallFragment) {
            ((PaywallFragment) showing).onPurchaseResult(purchase);
        }
    }

    public void go(Screen screen) {
        go(screen, null, true);
    }

    @Override
    public void go(Screen screen, Bundle args) {
        go(screen, args, true);
    }

    public void go(Screen screen, Bundle args, boolean addToHistory) {
        if (addToHistory && currentScreen != null && currentScreen != Screen.SPLASH) {
            // Re-rendering the same screen with new arguments — picking another chapter from the
            // chip row — is not a place the child has been; it replaces the one they are on.
            // Without this, back taps through every chip they tried before leaving.
            if (!backStack.isEmpty() && backStack.peek().screen == currentScreen
                && screen == currentScreen) {
                backStack.pop();
            }
            if (screen != currentScreen) backStack.push(new Step(currentScreen, currentArgs));
        }
        currentArgs = args;
        Fragment fragment = fragmentFor(screen, args);
        getSupportFragmentManager().beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commitAllowingStateLoss();

        boolean chromeVisible = screen != Screen.SPLASH && screen != Screen.PARENT_GATE;
        navBar.setVisibility(chromeVisible ? View.VISIBLE : View.GONE);
        mascotOverlay.setVisibility(screen == Screen.SPLASH ? View.GONE : View.VISIBLE);
        mascotController.allowBubble(); // a new screen starts with هوهو free to talk again
        mascotController.hideBubble();
        mascotController.returnHome(); // don't leave her parked next to the last screen's content

        if (screen != Screen.SPLASH && currentScreen != null) {
            mascotController.onScreenTransition();
            SoundManager sound = SoundManager.get();
            if (sound != null) sound.page();
        }
        currentScreen = screen;
        updateNavHighlight(screen);
        if (navBar != null) navBar.post(this::showNoticeIfDue);
    }

    @Override
    public void goParent() {
        if (AppState.get().parentUnlockedThisSession) {
            go(Screen.PARENT_PANEL);
        } else {
            go(Screen.PARENT_GATE);
        }
    }

    @Override
    public MascotController mascot() {
        return mascotController;
    }

    private void updateNavHighlight(Screen screen) {
        int active = getColor(R.color.orange);
        int inactive = getColor(R.color.text_faint);
        setNavColor(navMap, screen == Screen.MAP ? active : inactive);
        setNavColor(navSections, screen == Screen.SECTIONS ? active : inactive);
        setNavColor(navWorksheet,
            screen == Screen.WORKSHEET_INDEX || screen == Screen.WORKSHEET_DOWNLOAD ? active : inactive);
        setNavColor(navExam, screen == Screen.EXAM_INDEX ? active : inactive);
        setNavColor(navParent, screen == Screen.PARENT_PANEL || screen == Screen.PARENT_GATE ? active : inactive);
    }

    private void setNavColor(View item, int color) {
        ImageView icon = item.findViewById(R.id.nav_icon);
        TextView text = item.findViewById(R.id.nav_label);
        icon.setColorFilter(color, PorterDuff.Mode.SRC_IN);
        text.setTextColor(color);
    }

    @NonNull
    private Fragment fragmentFor(Screen screen, Bundle args) {
        Fragment f;
        switch (screen) {
            case SPLASH: f = new SplashFragment(); break;
            case MAP: f = new MapFragment(); break;
            case CHAPTERS: f = new ChaptersFragment(); break;
            case LESSON: f = new LessonFragment(); break;
            case SECTIONS: f = new SectionsFragment(); break;
            case WORKSHEET_INDEX: f = new WorksheetIndexFragment(); break;
            case WORKSHEET_DOWNLOAD: f = new WorksheetDownloadFragment(); break;
            case VOICE_DOWNLOAD: f = new VoiceDownloadFragment(); break;
            case PAYWALL: f = new PaywallFragment(); break;
            case EXAM_INDEX: f = new ExamIndexFragment(); break;
            case ONLINE_EXAM: f = new OnlineExamFragment(); break;
            case QUIZ: f = new QuizFragment(); break;
            case RESULT: f = new ResultFragment(); break;
            case REWARDS: f = new RewardsFragment(); break;
            case PROFILE: f = new ProfileFragment(); break;
            case PARENT_GATE: f = new ParentGateFragment(); break;
            case PARENT_PANEL: f = new ParentPanelFragment(); break;
            default: throw new IllegalArgumentException("Unknown screen " + screen);
        }
        if (args != null) f.setArguments(args);
        return f;
    }
}
