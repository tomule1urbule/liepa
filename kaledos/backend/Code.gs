/**
 * Liepos Kalėdų norai – serveris (Google Apps Script).
 *
 * Diegimas:
 * 1) script.google.com → Naujas projektas → įklijuokite šį kodą (pakeiskite visą Code.gs turinį).
 * 2) Jei norite, pakeiskite TEVU_PIN (tėvų slaptažodis norų redagavimui).
 * 3) Diegti → Naujas diegimas → Žiniatinklio programa; Vykdyti kaip: aš; Prieiga: bet kas.
 * 4) Gautą /exec adresą įrašykite į index.html (const API = '...') – jau įrašyta.
 *
 * Duomenys saugomi Google Sheet faile „Liepos Kalėdų norai“ (sukuriamas automatiškai,
 * pirmą kartą užpildomas pavyzdiniais norais – juos galite keisti programėlėje).
 */
const TEVU_PIN = '523407';
const SHEET_NAME = 'norai';

const SEED = [
  { emoji: '🧸', title: 'Lavinamasis kilimėlis su lankeliais', desc: 'Minkštas kilimėlis su kabančiais žaisliukais – gulėti ant pilvuko ir tyrinėti.', price: '40–60 €', qty: 1, prio: 1 },
  { emoji: '📖', title: 'Minkšta medžiaginė knygelė', desc: 'Šiugždanti, kontrastinga, su skirtingomis tekstūromis. Tinka ir graužti 🙂', price: '10–15 €', qty: 2, prio: 0 },
  { emoji: '🦷', title: 'Silikoninis kramtukas dantukams', desc: 'Lengvai suimamas, be BPA, galima šaldyti.', price: '6–10 €', qty: 1, prio: 1 },
  { emoji: '🥣', title: 'Pirmojo maitinimo rinkinys', desc: 'Silikoninis dubenėlis su prisiurbtuku, minkšti šaukšteliai ir seilinukas – košėms ir pirmiesiems skoniams.', price: '15–25 €', qty: 1, prio: 1 },
  { emoji: '🛁', title: 'Vonios žaislai', desc: 'Plūduriuojantys gyvūnėliai ar puodeliai pilstymui – maudynėms smagiau.', price: '8–15 €', qty: 1, prio: 0 },
  { emoji: '🌙', title: 'Žieminis miegmaišis', desc: 'Šiltas miegmaišis (apie 2.5 TOG), dydis 6–18 mėn.', price: '30–45 €', qty: 1, prio: 0 },
  { emoji: '🎵', title: 'Lietuviškų lopšinių ar eilėraščių knygelė', desc: 'Kartoninė knygelė su lietuviškomis lopšinėmis ar eilėraštukais vakarams.', price: '8–12 €', qty: 1, prio: 0 },
  { emoji: '❄️', title: 'Žieminis kombinezonas', desc: 'Šiltas kombinezonas pasivaikščiojimams, 80 dydžio.', price: '35–60 €', qty: 1, prio: 0 },
  { emoji: '🐷', title: 'Indėlis į Liepos taupyklę', desc: 'Ateities svajonėms – pirmam dviračiui ar kelionei. Galima prisidėti keliems.', price: 'bet kiek', qty: 10, prio: 0 }
];

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('SHEET_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Liepos Kalėdų norai');
    props.setProperty('SHEET_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName(SHEET_NAME);
    sh.getRange(1, 1, 1, 4).setValues([['id', 'Noras', 'Kas dovanoja', 'json']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setColumnWidth(2, 320); sh.setColumnWidth(3, 260);
    const now = Date.now();
    const rows = SEED.map((s, i) => {
      const it = Object.assign({ id: 'n' + (now + i).toString(36), link: '', img: '', order: i, res: [] }, s);
      return rowOf_(it);
    });
    sh.getRange(2, 1, rows.length, 4).setValues(rows);
  }
  return ss.getSheetByName(SHEET_NAME);
}

function rowOf_(it) {
  return [it.id, it.title, (it.res || []).map(r => r.name).join(', '), JSON.stringify(it)];
}

function readAll_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues().map((r, i) => {
    let it = null; try { it = JSON.parse(r[3]); } catch (e) {}
    return it ? { row: i + 2, it: it } : null;
  }).filter(Boolean);
}

function publicItem_(it) {
  const c = JSON.parse(JSON.stringify(it));
  c.res = (c.res || []).map(r => ({ rid: r.rid, name: r.name, ts: r.ts }));
  return c;
}

function list_(sh) {
  const items = readAll_(sh).map(x => publicItem_(x.it));
  items.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { ok: true, now: Date.now(), items: items };
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n); }

function doGet() {
  return out_(list_(sheet_()));
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const all = readAll_(sh);
    const find = id => all.find(x => x.it.id === id);
    const admin = String(b.pin || '') === TEVU_PIN;

    if (b.a === 'check') return out_({ ok: admin });

    if (b.a === 'reserve') {
      const x = find(b.id);
      if (!x) return out_({ ok: false, error: 'not_found' });
      const it = x.it; it.res = it.res || [];
      if (it.res.length >= (it.qty || 1)) return out_(Object.assign(list_(sh), { ok: false, error: 'taken' }));
      it.res.push({ rid: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: clean_(b.name, 40) || 'Slaptas Kalėdų senelis', ts: Date.now(), tok: clean_(b.tok, 64) });
      sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(it)]);
      return out_(Object.assign(list_(sh), { rid: it.res[it.res.length - 1].rid }));
    }

    if (b.a === 'unreserve') {
      const x = find(b.id);
      if (!x) return out_({ ok: false, error: 'not_found' });
      const it = x.it;
      const r = (it.res || []).find(r => r.rid === b.rid);
      if (!r) return out_(list_(sh));
      if (!admin && (!b.tok || r.tok !== b.tok)) return out_({ ok: false, error: 'forbidden' });
      it.res = it.res.filter(q => q.rid !== b.rid);
      sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(it)]);
      return out_(list_(sh));
    }

    if (!admin) return out_({ ok: false, error: 'unauthorized' });

    if (b.a === 'save') {
      const s = b.item || {};
      const x = s.id ? find(s.id) : null;
      const base = x ? x.it : { id: 'n' + Date.now().toString(36), res: [], order: all.reduce((m, y) => Math.max(m, y.it.order || 0), -1) + 1 };
      const it = Object.assign(base, {
        title: clean_(s.title, 120) || 'Noras',
        desc: clean_(s.desc, 500),
        price: clean_(s.price, 30),
        link: /^https?:\/\//i.test(s.link || '') ? String(s.link).slice(0, 600) : '',
        img: /^https?:\/\//i.test(s.img || '') ? String(s.img).slice(0, 600) : '',
        emoji: clean_(s.emoji, 8) || '🎁',
        qty: Math.max(1, Math.min(50, parseInt(s.qty, 10) || 1)),
        prio: s.prio ? 1 : 0
      });
      if (x) sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(it)]);
      else sh.appendRow(rowOf_(it));
      return out_(list_(sh));
    }

    if (b.a === 'delete') {
      const x = find(b.id);
      if (x) sh.deleteRow(x.row);
      return out_(list_(sh));
    }

    if (b.a === 'move') {
      const ids = b.ids || [];
      all.forEach(x => {
        const k = ids.indexOf(x.it.id);
        if (k >= 0 && x.it.order !== k) { x.it.order = k; sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(x.it)]); }
      });
      return out_(list_(sh));
    }

    return out_({ ok: false, error: 'unknown' });
  } finally {
    lock.releaseLock();
  }
}
