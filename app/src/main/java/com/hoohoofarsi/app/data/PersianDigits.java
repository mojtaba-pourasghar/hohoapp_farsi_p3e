package com.hoohoofarsi.app.data;

/** Converts between Latin and Persian (Farsi) digit characters, matching the textbook's numeral style. */
public final class PersianDigits {
    private static final char[] FA = {'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'};

    private PersianDigits() {}

    public static String fa(long n) {
        StringBuilder out = new StringBuilder();
        String s = Long.toString(n);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '0' && c <= '9') out.append(FA[c - '0']);
            else out.append(c);
        }
        return out.toString();
    }

    public static String fa(int n) {
        return fa((long) n);
    }

    /**
     * The Persian digits of any text that already has its own shape — a version like «1.27.0»,
     * where the dots matter and the number is not one number.
     */
    public static String fa(String text) {
        if (text == null) return "";
        StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            out.append(c >= '0' && c <= '9' ? FA[c - '0'] : c);
        }
        return out.toString();
    }

    /** Converts a string containing Persian digits back to Latin digits. */
    public static String en(String s) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int idx = indexOf(c);
            if (idx >= 0) out.append((char) ('0' + idx));
            else out.append(c);
        }
        return out.toString();
    }

    private static int indexOf(char c) {
        for (int i = 0; i < FA.length; i++) if (FA[i] == c) return i;
        return -1;
    }
}
