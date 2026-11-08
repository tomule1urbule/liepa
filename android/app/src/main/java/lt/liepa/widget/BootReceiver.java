package lt.liepa.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { RefreshJob.schedule(c, 5000); LiveService.start(c); }
}
