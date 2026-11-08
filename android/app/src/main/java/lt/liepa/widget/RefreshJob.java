package lt.liepa.widget;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;

/** Re-fetches the status every few minutes while widgets exist (chained one-off jobs). */
public class RefreshJob extends JobService {
    static final int ID = 4711;
    static final long INTERVAL = 3 * 60 * 1000L;

    static void schedule(Context c, long delay) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        JobInfo job = new JobInfo.Builder(ID, new ComponentName(c, RefreshJob.class))
                .setMinimumLatency(delay)
                .setOverrideDeadline(delay + 5 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(false)
                .build();
        js.schedule(job);
    }
    static void cancel(Context c) { c.getSystemService(JobScheduler.class).cancel(ID); }

    @Override public boolean onStartJob(JobParameters p) {
        final Context app = getApplicationContext();
        new Thread(() -> {
            Updater.fetch(app);
            Updater.drawAll(app);
            if (!LiveService.running) LiveService.start(app);
            schedule(app, INTERVAL);
            jobFinished(p, false);
        }).start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters p) { return true; }
}
