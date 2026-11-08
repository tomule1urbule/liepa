package lt.liepa.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

public class LiepaWidget extends AppWidgetProvider {
    static final String ACTION_REFRESH = "lt.liepa.widget.REFRESH";

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Updater.drawAll(c);
        refreshAsync(c);
    }
    @Override public void onEnabled(Context c) { RefreshJob.schedule(c, 1000); }
    @Override public void onDisabled(Context c) { RefreshJob.cancel(c); }

    @Override public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if (ACTION_REFRESH.equals(i.getAction())) refreshAsync(c);
    }

    private void refreshAsync(Context c) {
        final PendingResult pr = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(() -> {
            try { Updater.fetch(app); Updater.drawAll(app); RefreshJob.schedule(app, RefreshJob.INTERVAL); }
            finally { pr.finish(); }
        }).start();
    }
}
