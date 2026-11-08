package lt.liepa.widget;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

/** Keeps the widget + notification fresh: checks Liepa's status every minute (foreground service, survives battery saving). */
public class LiveService extends Service {
    static final long PERIOD = 60 * 1000L;
    static volatile boolean running = false;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            final Context app = getApplicationContext();
            new Thread(() -> { Updater.fetch(app); Updater.drawAll(app); }).start();
            h.postDelayed(this, PERIOD);
        }
    };

    static void start(Context c) {
        if (!Store.notify(c) || !Store.configured(c)) return;
        try { c.startForegroundService(new Intent(c, LiveService.class)); } catch (Exception ignored) { /* not allowed from background – job keeps working */ }
    }
    static void stop(Context c) { c.stopService(new Intent(c, LiveService.class)); }

    @Override public int onStartCommand(Intent i, int flags, int id) {
        running = true;
        android.app.Notification n = Notifier.build(this);
        if (Build.VERSION.SDK_INT >= 34) startForeground(Notifier.ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(Notifier.ID, n);
        h.removeCallbacks(tick); h.post(tick);
        return START_STICKY;
    }
    @Override public void onDestroy() { running = false; h.removeCallbacks(tick); super.onDestroy(); }
    @Override public IBinder onBind(Intent i) { return null; }
}
