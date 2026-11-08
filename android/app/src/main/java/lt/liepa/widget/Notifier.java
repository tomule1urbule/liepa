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

/** Ongoing "Liepa miega" notification with a live timer – shown only while she sleeps. */
final class Notifier {
    static final String CH = "sleep_timer";
    static final int ID = 1;

    static boolean allowed(Context c) {
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    static void update(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        JSONObject s = Store.status(c);
        if (s == null || !"sleep".equals(s.optString("state")) || !Store.notify(c) || !allowed(c)) { nm.cancel(ID); return; }

        NotificationChannel ch = new NotificationChannel(CH, "Miego laikmatis", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Rodomas, kol Liepa miega");
        ch.setShowBadge(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);

        long since = s.optLong("since", System.currentTimeMillis());
        long started = s.optLong("startedAt", since);
        String name = s.optString("name", "Liepa");
        boolean night = "night".equals(s.optString("kind"));
        PendingIntent open = PendingIntent.getActivity(c, 10, new Intent(Intent.ACTION_VIEW, Uri.parse(Updater.APP_URL)),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(c, CH)
                .setSmallIcon(R.drawable.ic_moon)
                .setColor(Color.parseColor("#6476C0"))
                .setContentTitle("😴 " + name + " miega" + (night ? " · naktis" : ""))
                .setContentText("užmigo " + Updater.hm(started))
                .setWhen(since)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_STOPWATCH)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(open)
                .build();
        nm.notify(ID, n);
    }
}
