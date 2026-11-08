package lt.liepa.widget;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import org.json.JSONObject;

/** Sleep timer notification. While she sleeps: visible in the status bar + lock screen with a live timer.
 *  While awake (only when the background service runs) a silent minimised notification keeps the service alive. */
final class Notifier {
    static final String CH_SLEEP = "sleep_timer", CH_QUIET = "liepa_quiet";
    static final int ID = 1;

    static boolean allowed(Context c) {
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }
    private static void channels(NotificationManager nm) {
        NotificationChannel a = new NotificationChannel(CH_SLEEP, "Miego laikmatis", NotificationManager.IMPORTANCE_LOW);
        a.setDescription("Rodomas, kol Liepa miega"); a.setShowBadge(false); a.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationChannel b = new NotificationChannel(CH_QUIET, "Budrumas (tylus)", NotificationManager.IMPORTANCE_MIN);
        b.setDescription("Tylus pranešimas, kad valdiklis atsinaujintų kas minutę"); b.setShowBadge(false);
        nm.createNotificationChannel(a); nm.createNotificationChannel(b);
    }

    static Notification build(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        channels(nm);
        JSONObject s = Store.status(c);
        PendingIntent open = PendingIntent.getActivity(c, 10, new Intent(Intent.ACTION_VIEW, Uri.parse(Updater.APP_URL)),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String name = s != null ? s.optString("name", "Liepa") : "Liepa";
        boolean sleeping = s != null && "sleep".equals(s.optString("state"));
        long since = s != null ? s.optLong("since", 0) : 0;
        Notification.Builder b;
        if (sleeping) {
            long started = s.optLong("startedAt", since);
            boolean night = "night".equals(s.optString("kind"));
            b = new Notification.Builder(c, CH_SLEEP)
                    .setSmallIcon(R.drawable.ic_moon).setColor(Color.parseColor("#6476C0"))
                    .setContentTitle("😴 " + name + " miega" + (night ? " · naktis" : ""))
                    .setContentText("užmigo " + Updater.hm(started))
                    .setWhen(since).setShowWhen(true).setUsesChronometer(true)
                    .setCategory(Notification.CATEGORY_STOPWATCH);
        } else {
            b = new Notification.Builder(c, CH_QUIET)
                    .setSmallIcon(R.drawable.ic_moon)
                    .setContentTitle("☀️ " + name + " budi")
                    .setContentText(since > 0 ? "pabudo " + Updater.hm(since) : "Liepa valdiklis veikia")
                    .setShowWhen(since > 0).setWhen(since > 0 ? since : System.currentTimeMillis()).setUsesChronometer(since > 0)
                    .setCategory(Notification.CATEGORY_STATUS);
        }
        return b.setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PUBLIC).setContentIntent(open).build();
    }

    static void update(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (!Store.notify(c) || !allowed(c)) { nm.cancel(ID); return; }
        JSONObject s = Store.status(c);
        boolean sleeping = s != null && "sleep".equals(s.optString("state"));
        if (LiveService.running || sleeping) nm.notify(ID, build(c));
        else nm.cancel(ID);
    }
}
