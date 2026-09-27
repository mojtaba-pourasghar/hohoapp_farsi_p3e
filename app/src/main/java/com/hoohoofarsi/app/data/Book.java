package com.hoohoofarsi.app.data;

import java.util.Arrays;
import java.util.List;

/**
 * The 3rd-grade Persian textbook (فارسی سوم دبستان، کد ۳۰۳): 17 lessons (درس) in 7 فصل. Each
 * درس carries the pages that follow it in the book — its «بخوان و حفظ کن»، «بخوان و بیندیش»،
 * «مَثَل» or «حکایت», and the opening page of its فصل — and is split into the sections those
 * pages naturally fall into: a different number for each درس, so always ask
 * `chapter.sections.size()` rather than assuming a count.
 *
 * In the code a درس is still called a "chapter", the name the rest of the app grew up with.
 */
public final class Book {

    public static final class Chapter {
        public final int index;
        public final String numberFa;
        public final String title;
        /** Where this درس starts and ends in the printed book. */
        public final int firstPage;
        public final int lastPage;
        public final List<String> sections;

        Chapter(int index, String numberFa, String title, int firstPage, int lastPage, String... sections) {
            this.index = index;
            this.numberFa = numberFa;
            this.title = title;
            this.firstPage = firstPage;
            this.lastPage = lastPage;
            this.sections = Arrays.asList(sections);
        }
    }

    public static final List<Chapter> CHAPTERS = Arrays.asList(
        new Chapter(0, "۱", "محلّه‌ی ما", 10, 19,
            "ستایش و متنِ درس", "درک مطلب و واژه‌ها", "بخوان و حفظ کن: پدربزرگ"),
        new Chapter(1, "۲", "زنگِ ورزش", 20, 28,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: قصّه‌ی تُنگِ بُلور", "مَثَل"),
        new Chapter(2, "۳", "آسمانِ آبی، طبیعتِ پاک", 29, 35,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و حفظ کن: هم‌بازی"),
        new Chapter(3, "۴", "آوازِ گنجشک", 36, 44,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: مورچه‌ریزه", "مَثَل"),
        new Chapter(4, "۵", "بلدرچین و برزگر", 45, 49,
            "متنِ درس", "درک مطلب و واژه‌ها"),
        new Chapter(5, "۶", "فداکاران", 50, 55,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و حفظ کن: مِثلِ باران"),
        new Chapter(6, "۷", "کارِ نیک", 56, 64,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: پَری کوچولو", "حکایت"),
        new Chapter(7, "۸", "پیراهنِ بهشتی", 65, 71,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و حفظ کن: لحظه‌ی سبزِ دعا"),
        new Chapter(8, "۹", "بوی نرگس", 72, 78,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: حوضِ فیروزه‌ای", "مَثَل"),
        new Chapter(9, "۱۰", "یارِ مهربان", 79, 85,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و حفظ کن: نقّاشِ دنیا"),
        new Chapter(10, "۱۱", "نویسنده‌ی بزرگ", 86, 92,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: خوابِ خلیفه", "حکایت"),
        new Chapter(11, "۱۲", "ایرانِ عزیز", 93, 97,
            "متنِ درس", "درک مطلب و واژه‌ها"),
        new Chapter(12, "۱۳", "درسِ آزاد", 98, 101,
            "درسِ آزاد", "بخوان و حفظ کن: وطن"),
        new Chapter(13, "۱۴", "ایرانِ آباد", 102, 108,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: بوی سیب و یاس", "حکایت"),
        new Chapter(14, "۱۵", "دریا", 109, 113,
            "متنِ درس", "درک مطلب و واژه‌ها"),
        new Chapter(15, "۱۶", "اگر جنگل نباشد", 114, 119,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و حفظ کن: بهاران"),
        new Chapter(16, "۱۷", "چشم‌های آسمان", 120, 128,
            "متنِ درس", "درک مطلب و واژه‌ها", "بخوان و بیندیش: آفرینشِ حلزون", "حکایت و نیایش")
    );

    private Book() {}

    public static Chapter chapter(int index) {
        return CHAPTERS.get(Math.max(0, Math.min(CHAPTERS.size() - 1, index)));
    }

    public static final int CHAPTER_COUNT = 17;
    /** The most sections any درس has; screens that lay sections out size themselves from it. */
    public static final int MAX_SECTIONS = 4;
}
