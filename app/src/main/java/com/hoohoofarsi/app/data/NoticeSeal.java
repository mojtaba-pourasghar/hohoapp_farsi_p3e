package com.hoohoofarsi.app.data;

import android.content.Context;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/**
 * مُهرِ خبرها — proof that a notice was written by the teacher and not by whoever got into the host.
 *
 * The notices live on a shared web host over plain http. Anyone who takes that host — or who sits
 * between a phone and it — can replace notices.json, and without this they would be writing
 * straight onto the screen of every child with the app: a link to anywhere, a message in هوهو's
 * voice, saying anything.
 *
 * So the file is signed, and the app checks the signature before it believes a word of it.
 *
 * **The signing key is not in the app and not on the host.** It is made once by the studio and
 * stays on the teacher's own machine; only the public half ships here, in assets/notice-key.pub,
 * and the public half can verify but cannot sign. That is the whole point of using a key pair
 * rather than a shared password: a password in the APK is a password in everyone's hands — any
 * decompiler gets it in a minute — and then forging a notice is as easy as writing one. Taking
 * the host gets an attacker nothing but a file the app throws away.
 *
 * **It fails closed.** No key, no signature, or a signature that does not match, and the file is
 * discarded whole. An unsigned notice is not a notice of unknown provenance to be shown with a
 * warning — it is a notice from nobody, and silence is the right thing to show a seven-year-old.
 */
public final class NoticeSeal {

    /** Written by tools/voice-studio when the signing key is made. */
    private static final String KEY_ASSET = "notice-key.pub";

    private static Boolean keyPresent;
    private static PublicKey cached;

    private NoticeSeal() {}

    /**
     * Whether this build can check a signature at all.
     *
     * False means the key was never generated, and so no notice will ever be shown — worth
     * saying out loud in the parent panel rather than looking like news that never comes.
     */
    public static boolean ready(Context context) {
        if (keyPresent == null) keyPresent = key(context) != null;
        return keyPresent;
    }

    private static PublicKey key(Context context) {
        if (cached != null) return cached;
        try (InputStream in = context.getApplicationContext().getAssets().open(KEY_ASSET)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[2048];
            int read;
            while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
            String text = out.toString("UTF-8")
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
            if (text.isEmpty()) return null;
            byte[] der = Base64.decode(text, Base64.DEFAULT);
            cached = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
            return cached;
        } catch (Exception noKey) {
            return null;        // no key asset, or one that is not a key
        }
    }

    /**
     * Whether `signature` (base64, SHA256withRSA) really is the teacher's signature over `body`.
     *
     * The bytes checked are the exact bytes fetched, not a re-serialisation of them: signing one
     * thing and verifying another is the classic way a signature check ends up checking nothing.
     */
    public static boolean verify(Context context, String body, String signature) {
        if (body == null) return false;
        return verify(context, body.getBytes(StandardCharsets.UTF_8), signature);
    }

    /** The same, over the bytes exactly as they came off the host. Preferred for anything signed. */
    public static boolean verify(Context context, byte[] body, String signature) {
        if (body == null || body.length == 0 || signature == null || signature.trim().isEmpty()) {
            return false;
        }
        PublicKey publicKey = key(context);
        if (publicKey == null) return false;
        try {
            Signature check = Signature.getInstance("SHA256withRSA");
            check.initVerify(publicKey);
            check.update(body);
            return check.verify(Base64.decode(signature.trim(), Base64.DEFAULT));
        } catch (Exception bad) {
            return false;
        }
    }

    /**
     * The SHA-256 of a file, lower-case hex — how a picture is checked.
     *
     * The signature covers the text of a notice, including the name of its picture, but not the
     * picture itself: that is a separate file, fetched separately, and swapping it would put an
     * unsigned image on a child's screen. So the signed text carries the hash of the picture and
     * the picture is weighed against it.
     */
    public static String sha256(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                                     .append(Character.forDigit(b & 0xF, 16));
            return hex.toString();
        } catch (Exception impossible) {
            return "";
        }
    }
}
