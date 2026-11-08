package lt.liepa.widget;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Connects the widget: opened from the Liepa app (liepawidget://config?d=…) or manually by pasting the pairing link. */
public class ConfigActivity extends Activity {
    private TextView msg;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL); root.setPadding(pad, pad * 2, pad, pad);
        root.setBackgroundColor(Color.parseColor("#F6F1EA"));

        TextView title = new TextView(this); title.setText("Liepa valdiklis"); title.setTextSize(26); title.setTextColor(Color.parseColor("#2A2622"));
        msg = new TextView(this); msg.setTextSize(16); msg.setTextColor(Color.parseColor("#2A2622")); msg.setPadding(0, pad / 2, 0, pad / 2);
        TextView help = new TextView(this); help.setTextSize(14); help.setTextColor(Color.parseColor("#7C7268"));
        help.setText("Kaip pridėti valdiklį: ilgai paspauskite tuščią vietą pagrindiniame ekrane → Valdikliai → „Liepa valdiklis“ → nutempkite į ekraną.\n\nJei valdiklis dar neprijungtas: Liepos programėlėje atidarykite ⚙︎ Nustatymai → „Prijungti Android valdiklį“, arba įklijuokite Liepos bendrinimo nuorodą žemiau.");
        final EditText in = new EditText(this); in.setHint("Įklijuokite bendrinimo nuorodą");
        Button paste = new Button(this); paste.setText("Įklijuoti iš iškarpinės ir prijungti");
        paste.setOnClickListener(v -> {
            ClipboardManager cm = getSystemService(ClipboardManager.class);
            ClipData cd = cm != null ? cm.getPrimaryClip() : null;
            String t = in.getText().toString();
            if (t.isEmpty() && cd != null && cd.getItemCount() > 0) t = String.valueOf(cd.getItemAt(0).coerceToText(this));
            connect(t);
        });
        root.addView(title); root.addView(msg); root.addView(help); root.addView(in); root.addView(paste);
        setContentView(root);

        if (getIntent() != null && getIntent().getData() != null) connect(getIntent().getData().toString());
        else showState();
    }

    private void connect(String link) {
        if (Store.saveFromLink(this, link)) {
            msg.setText("✓ Prijungta! Valdiklis atsinaujins per kelias sekundes.");
            final android.content.Context app = getApplicationContext();
            new Thread(() -> { Updater.fetch(app); Updater.drawAll(app); RefreshJob.schedule(app, RefreshJob.INTERVAL); }).start();
        } else msg.setText("Nepavyko perskaityti nuorodos. Patikrinkite, ar nukopijavote visą Liepos bendrinimo nuorodą.");
    }
    private void showState() {
        msg.setText(Store.configured(this) ? "✓ Valdiklis prijungtas." : "Valdiklis dar neprijungtas.");
    }
}
