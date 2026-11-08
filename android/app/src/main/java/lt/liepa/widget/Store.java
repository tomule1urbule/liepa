package lt.liepa.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import org.json.JSONObject;

/** Saved connection settings + last known status. */
final class Store {
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("liepa", Context.MODE_PRIVATE); }
    static String url(Context c) { return prefs(c).getString("url", ""); }
    static String key(Context c) { return prefs(c).getString("key", ""); }
    static boolean configured(Context c) { return !url(c).isEmpty(); }

    /** Accepts a Liepa pairing link (https://...#pair=BASE64) or liepawidget://config?d=BASE64 or the raw BASE64. */
    static boolean saveFromLink(Context c, String link) {
        if (link == null) return false;
        String b64 = link.trim();
        int i = b64.indexOf("pair=");
        if (i >= 0) b64 = b64.substring(i + 5);
        else {
            try { String d = Uri.parse(b64).getQueryParameter("d"); if (d != null) b64 = d; } catch (Exception ignored) {}
        }
        int amp = b64.indexOf('&'); if (amp >= 0) b64 = b64.substring(0, amp);
        try {
            String json = new String(Base64.decode(Uri.decode(b64), Base64.DEFAULT), "UTF-8");
            JSONObject o = new JSONObject(json);
            String u = o.optString("u", ""), k = o.optString("k", "");
            if (u.isEmpty()) return false;
            prefs(c).edit().putString("url", u).putString("key", k).apply();
            return true;
        } catch (Exception e) { return false; }
    }
    static boolean notify(Context c) { return prefs(c).getBoolean("notify", true); }
    static void setNotify(Context c, boolean on) { prefs(c).edit().putBoolean("notify", on).apply(); }
    static void saveStatus(Context c, String json) { prefs(c).edit().putString("status", json).putLong("fetched", System.currentTimeMillis()).apply(); }
    static JSONObject status(Context c) {
        try { String s = prefs(c).getString("status", null); return s == null ? null : new JSONObject(s); } catch (Exception e) { return null; }
    }
    static long fetched(Context c) { return prefs(c).getLong("fetched", 0); }
}
