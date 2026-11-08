/**
 * Liepa – sinchronizacijos serveris (Google Apps Script).
 * 1) script.google.com → Naujas projektas → įklijuokite šį kodą.
 * 2) Pakeiskite KEY į savo slaptą raktą.
 * 3) Diegti → Naujas diegimas → Žiniatinklio programa; Vykdyti kaip: aš; Prieiga: bet kas.
 * 4) Gautą /exec adresą ir raktą įveskite programėlės nustatymuose.
 * Duomenys saugomi Google Sheet faile „Liepa – duomenys“ (sukuriamas automatiškai).
 */
const KEY = 'PAKEISKITE-I-SAVO-RAKTA';

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('SHEET_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Liepa – duomenys');
    props.setProperty('SHEET_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName('irasai');
    sh.getRange(1, 1, 1, 4).setValues([['id', 'json', 'updated', 'deleted']]);
    sh.setFrozenRows(1);
  }
  return ss.getSheetByName('irasai');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.status) {
    if (p.key !== KEY) return out_({ ok: false, error: 'unauthorized' });
    return out_(status_());
  }
  return out_({ ok: true, app: 'liepa' });
}

/** Live status for home-screen widgets: sleeping/awake timer + last feed. */
function status_() {
  const sh = sheet_(), last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 2, last - 1, 1).getValues() : [];
  let run = null, lastEnd = 0, feed = null, name = 'Liepa';
  rows.forEach(r => {
    let it; try { it = JSON.parse(r[0]); } catch (err) { return; }
    if (!it || it.x) return;
    if (it.t === 'cfg' && it.d && it.d.name) name = it.d.name;
    if (it.t === 'sleep') {
      if (it.e == null) { if (!run || it.s > run.s) run = it; }
      else if (it.e > lastEnd) lastEnd = it.e;
    }
    if (it.t === 'feed' && (!feed || it.s > feed.s)) feed = it;
  });
  const now = Date.now(), out = { ok: true, now: now, name: name };
  const d = (run && run.d) || {};
  if (run && !d.p) {
    const paused = (d.pl || []).reduce((t, x) => t + Math.max(0, x[1] - x[0]), 0);
    out.state = 'sleep'; out.since = run.s + paused; out.startedAt = run.s; out.kind = d.k || 'nap';
  } else {
    out.state = 'awake'; out.since = (run && d.p) ? d.p : (lastEnd || null);
  }
  if (feed) {
    const f = feed.d || {};
    out.lastFeedAt = feed.s;
    out.lastFeedText = f.m === 'bottle' ? (f.ml || '?') + ' ml' : f.m === 'breast' ? 'krūtimi' : 'košė';
  }
  return out;
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  if (body.key !== KEY) return out_({ ok: false, error: 'unauthorized' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const now = Date.now();
    const last = sh.getLastRow();
    const rows = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
    const idx = {};
    rows.forEach((r, i) => { idx[r[0]] = i; });
    const appends = [];
    (body.items || []).forEach(it => {
      if (!it || !it.id) return;
      const row = [it.id, JSON.stringify(it), now, it.x ? 1 : 0];
      if (idx[it.id] != null) {
        const i = idx[it.id];
        let cur = {}; try { cur = JSON.parse(rows[i][1]); } catch (err) {}
        if ((it.u || 0) < (cur.u || 0)) return;          // older edit – ignore
        rows[i] = row;
        sh.getRange(i + 2, 1, 1, 4).setValues([row]);
      } else {
        idx[it.id] = rows.length + appends.length;
        appends.push(row);
      }
    });
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, 4).setValues(appends);
    const since = +body.since || 0;
    const items = rows.concat(appends).filter(r => +r[2] > since).map(r => { try { return JSON.parse(r[1]); } catch (err) { return null; } }).filter(Boolean);
    return out_({ ok: true, now: now, items: items });
  } finally {
    lock.releaseLock();
  }
}
