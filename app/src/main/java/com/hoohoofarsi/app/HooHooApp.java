package com.hoohoofarsi.app;

import android.app.Application;

import com.hoohoofarsi.app.data.AppState;
import com.hoohoofarsi.app.tts.SoundManager;
import com.hoohoofarsi.app.tts.TtsManager;

public class HooHooApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        AppState.init(this);
        TtsManager.init(this);
        SoundManager.init(this);
    }
}
