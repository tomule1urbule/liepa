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
  return { ok: true, now: Date.now(), ver: ver_(), items: items };
}

const UAS_ = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
];

function get_(url, ua) {
  return UrlFetchApp.fetch(url, {
    muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: false,
    headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8', 'Accept-Language': 'lt-LT,lt;q=0.9,en;q=0.8', 'Cache-Control': 'no-cache' }
  });
}

/** Remove tracking parameters (utm_*, fbclid, ...) from a shop link. */
function cleanLink_(url) {
  if (!/^https?:\/\//i.test(url || '')) return '';
  const parts = String(url).trim().split('#')[0].split('?');
  if (parts.length < 2) return parts[0].slice(0, 600);
  const keep = parts[1].split('&').filter(kv => kv && !/^(utm_[a-z]+|fbclid|gclid|gbraid|wbraid|srsltid|mc_[a-z]+|igsh|media_type)=/i.test(kv));
  return (parts[0] + (keep.length ? '?' + keep.join('&') : '')).slice(0, 600);
}

function absUrl_(img, page) {
  img = String(img || '').replace(/&amp;/g, '&').replace(/\\\//g, '/').trim();
  if (!img || /^data:/i.test(img)) return '';
  if (img.indexOf('//') === 0) return 'https:' + img;
  if (img.charAt(0) === '/') return page.match(/^https?:\/\/[^\/]+/i)[0] + img;
  if (!/^https?:\/\//i.test(img)) return page.replace(/[^\/]*$/, '') + img;
  return img;
}

/** Find the product photo in page HTML. */
function photoInHtml_(html, url) {
  const meta = (key) => {
    const re1 = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\']' + key + '["\'][^>]*content=["\']([^"\']+)', 'i');
    const re2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name|itemprop)=["\']' + key + '["\']', 'i');
    const m = html.match(re1) || html.match(re2); return m ? m[1] : '';
  };
  let img = meta('og:image:secure_url') || meta('og:image') || meta('twitter:image') || meta('twitter:image:src') || meta('image');
  if (!img) { const m = html.match(/"image"\s*:\s*(?:\[\s*)?(?:\{[^}]*?"(?:url|contentUrl)"\s*:\s*)?"([^"]+\.(?:jpe?g|png|webp|avif)[^"]*)"/i); if (m) img = m[1]; }
  if (!img) { const m = html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)/i); if (m) img = m[1]; }
  if (!img) { const m = html.match(/<img[^>]+itemprop=["']image["'][^>]*src=["']([^"']+)/i) || html.match(/<img[^>]+src=["']([^"']+)["'][^>]*itemprop=["']image["']/i); if (m) img = m[1]; }
  if (!img) {   // first image that looks like a product photo (not a logo / icon)
    const re = /<img[^>]+?(?:data-src|data-original|src)=["']([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)["']/ig; let m;
    while ((m = re.exec(html))) {
      if (/logo|icon|sprite|banner|flag|payment|avatar|placeholder|blank|loader/i.test(m[1])) continue;
      if (/product|catalog|gallery|\/p\/|item|large|zoom|800|1000|1200/i.test(m[1])) { img = m[1]; break; }
    }
  }
  img = absUrl_(img, url);
  return /^https?:\/\//i.test(img) ? img.slice(0, 600) : '';
}

/** Product photo from a shop page. '' if none. */
function photoFrom_(url) {
  if (!/^https?:\/\//i.test(url || '')) return '';
  for (let i = 0; i < UAS_.length; i++) {
    try {
      const res = get_(url, UAS_[i]);
      if (res.getResponseCode() >= 400) continue;
      const ph = photoInHtml_(res.getContentText().slice(0, 3000000), url);
      if (ph) return ph;
    } catch (e) {}
  }
  return '';
}

function bump_() { const p = PropertiesService.getScriptProperties(); p.setProperty('VER', String((+p.getProperty('VER') || 0) + 1)); }
function ver_() { return PropertiesService.getScriptProperties().getProperty('VER') || '0'; }

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n); }

function doGet(e) {
  const v = e && e.parameter && e.parameter.v;
  if (v && v === ver_()) return out_({ ok: true, same: true, ver: v });   // nothing changed – skip the big payload
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
      bump_();
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
      bump_();
      return out_(list_(sh));
    }

    if (!admin) return out_({ ok: false, error: 'unauthorized' });

    if (b.a === 'save') {
      const s = b.item || {};
      const x = s.id ? find(s.id) : null;
      const base = x ? x.it : { id: 'n' + Date.now().toString(36), res: [], order: all.reduce((m, y) => Math.max(m, y.it.order || 0), -1) + 1 };
      const oldImg = base.img || '', oldAuto = base.imgAuto || '';
      const it = Object.assign(base, {
        title: clean_(s.title, 120) || 'Noras',
        desc: clean_(s.desc, 500),
        price: clean_(s.price, 30),
        link: cleanLink_(s.link),
        img: /^https?:\/\//i.test(s.img || '') ? String(s.img).slice(0, 600) : (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(s.img || '') && s.img.length <= 42000 ? s.img : ''),
        emoji: clean_(s.emoji, 8) || '🎁',
        qty: Math.max(1, Math.min(50, parseInt(s.qty, 10) || 1)),
        prio: s.prio ? 1 : 0
      });
      // automatic photo: none given, or the photo came from a link that has since changed
      const keptAuto = oldAuto && it.img === oldImg;
      if (it.link && (!it.img || (keptAuto && oldAuto !== it.link))) {
        const ph = photoFrom_(it.link);
        it.img = ph || (keptAuto ? '' : it.img); it.imgAuto = ph ? it.link : '';
      } else it.imgAuto = keptAuto ? oldAuto : '';
      if (x) sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(it)]);
      else sh.appendRow(rowOf_(it));
      bump_();
      return out_(list_(sh));
    }

    if (b.a === 'probe') {   // diagnostics: what does the shop return to this server?
      const url = cleanLink_(b.url);
      return out_({ ok: true, url: url, tries: UAS_.map(ua => {
        try { const r = get_(url, ua), t = r.getContentText(); return { code: r.getResponseCode(), len: t.length, title: (t.match(/<title[^>]*>([^<]{0,80})/i) || [])[1] || '', photo: photoInHtml_(t.slice(0, 3000000), url) }; }
        catch (e) { return { error: String(e).slice(0, 200) }; }
      }) });
    }

    if (b.a === 'photos') {   // fill in missing photos for all wishes that have a link
      let n = 0;
      all.forEach(x => {
        if (x.it.link && !x.it.img) { const ph = photoFrom_(x.it.link); if (ph) { x.it.img = ph; x.it.imgAuto = x.it.link; n++; sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(x.it)]); } }
      });
      bump_();
      return out_(Object.assign(list_(sh), { found: n }));
    }

    if (b.a === 'delete') {
      const x = find(b.id);
      if (x) sh.deleteRow(x.row);
      bump_();
      return out_(list_(sh));
    }

    if (b.a === 'move') {
      const ids = b.ids || [];
      all.forEach(x => {
        const k = ids.indexOf(x.it.id);
        if (k >= 0 && x.it.order !== k) { x.it.order = k; sh.getRange(x.row, 1, 1, 4).setValues([rowOf_(x.it)]); }
      });
      bump_();
      return out_(list_(sh));
    }

    return out_({ ok: false, error: 'unknown' });
  } finally {
    lock.releaseLock();
  }
}
