package lt.liepa.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/** Fetches status from the Liepa server and draws all widgets. */
final class Updater {
    static final String APP_URL = "https://tomule1urbule.github.io/liepa/";

    /** Network call – run off the main thread. */
    static boolean fetch(Context c) {
        if (!Store.configured(c)) return false;
        HttpURLConnection con = null;
        try {
            String u = Store.url(c) + (Store.url(c).contains("?") ? "&" : "?") + "status=1&key=" + Uri.encode(Store.key(c));
            con = (HttpURLConnection) new URL(u).openConnection();
            con.setConnectTimeout(15000); con.setReadTimeout(20000); con.setInstanceFollowRedirects(true);
            int code = con.getResponseCode();
            // Apps Script answers with a redirect to googleusercontent.com
            for (int i = 0; i < 4 && (code == 301 || code == 302 || code == 303 || code == 307); i++) {
                String loc = con.getHeaderField("Location"); con.disconnect();
                con = (HttpURLConnection) new URL(loc).openConnection();
                con.setConnectTimeout(15000); con.setReadTimeout(20000);
                code = con.getResponseCode();
            }
            if (code != 200) return false;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"))) {
                String line; while ((line = r.readLine()) != null) sb.append(line);
            }
            JSONObject o = new JSONObject(sb.toString());
            if (!o.optBoolean("ok")) return false;
            Store.saveStatus(c, o.toString());
            return true;
        } catch (Exception e) {
            return false;
        } finally { if (con != null) con.disconnect(); }
    }

    static String hm(long ms) { return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ms)); }

    static void drawAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, LiepaWidget.class));
        for (int id : ids) m.updateAppWidget(id, build(c));
        Notifier.update(c);
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        // tap → open the Liepa app, ⟳ → refresh now
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL));
        v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(c, 1, open, flags));
        Intent ref = new Intent(c, LiepaWidget.class).setAction(LiepaWidget.ACTION_REFRESH);
        v.setOnClickPendingIntent(R.id.refresh, PendingIntent.getBroadcast(c, 2, ref, flags));

        if (!Store.configured(c)) {
            v.setTextViewText(R.id.state, "Liepa");
            v.setTextViewText(R.id.sub, "Bakstelėkite, kad prijungtumėte");
            v.setChronometer(R.id.timer, SystemClock.elapsedRealtime(), "—", false);
            v.setChronometer(R.id.feed, SystemClock.elapsedRealtime(), "", false);
            v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(c, 3, new Intent(c, ConfigActivity.class), flags));
            return v;
        }
        JSONObject s = Store.status(c);
        if (s == null) {
            v.setTextViewText(R.id.state, "Liepa");
            v.setTextViewText(R.id.sub, "Įkeliama…");
            v.setChronometer(R.id.timer, SystemClock.elapsedRealtime(), "—", false);
            v.setChronometer(R.id.feed, SystemClock.elapsedRealtime(), "", false);
            return v;
        }
        long now = System.currentTimeMillis(), boot = SystemClock.elapsedRealtime();
        String name = s.optString("name", "Liepa");
        boolean sleeping = "sleep".equals(s.optString("state"));
        long since = s.optLong("since", 0);

        int ink = sleeping ? Color.WHITE : Color.parseColor("#2A2622");
        int muted = sleeping ? Color.parseColor("#DDE2F5") : Color.parseColor("#7C7268");
        v.setInt(R.id.root, "setBackgroundResource", sleeping ? R.drawable.bg_sleep : R.drawable.bg);
        v.setTextColor(R.id.state, ink); v.setTextColor(R.id.timer, ink); v.setTextColor(R.id.sub, muted); v.setTextColor(R.id.refresh, muted);
        v.setTextColor(R.id.feed, sleeping ? Color.parseColor("#FFD9B8") : Color.parseColor("#B8662A"));

        if (sleeping) {
            boolean night = "night".equals(s.optString("kind"));
            v.setTextViewText(R.id.state, "😴 " + name + " miega" + (night ? " (naktis)" : ""));
            v.setChronometer(R.id.timer, boot - (now - since), null, true);
            v.setTextViewText(R.id.sub, "užmigo " + hm(s.optLong("startedAt", since)));
        } else if (since > 0) {
            v.setTextViewText(R.id.state, "☀️ " + name + " budi");
            v.setChronometer(R.id.timer, boot - (now - since), null, true);
            v.setTextViewText(R.id.sub, "pabudo " + hm(since));
        } else {
            v.setTextViewText(R.id.state, "☀️ " + name);
            v.setChronometer(R.id.timer, boot, "—", false);
            v.setTextViewText(R.id.sub, "");
        }
        long lf = s.optLong("lastFeedAt", 0);
        if (lf > 0) {
            String txt = s.optString("lastFeedText", "");
            v.setChronometer(R.id.feed, boot - (now - lf), "🍼 Valgė prieš %s · " + txt, true);
        } else v.setChronometer(R.id.feed, boot, "", false);
        return v;
    }
}
