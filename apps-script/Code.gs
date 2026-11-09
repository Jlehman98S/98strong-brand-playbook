/**
 * 98Strong Personal Brand Playbook: live workshop site.
 * Everything lives in this Google Sheet + one Drive folder in Josh's Drive.
 *
 * ONE-TIME SETUP (about 5 minutes)
 * 1. Create a blank Google Sheet ("Personal Brand Playbook Responses").
 * 2. Extensions > Apps Script. Replace Code.gs with this file.
 * 3. Pick "setup" in the function dropdown and click Run. Approve the permissions.
 *    The log prints your athlete link and your private host link.
 * 4. Deploy > New deployment > type: Web app.
 *    Execute as: Me.  Who has access: Anyone.  Click Deploy and copy the Web app URL.
 *    Paste that URL into public/config.js in the GitHub repo (Cloudflare redeploys on commit).
 *    Athletes use the Cloudflare link. You use the Cloudflare link + ?host=YOUR_KEY.
 * After editing code later: Deploy > Manage deployments > edit > Version: New version.
 */

const SESSIONS = ['discover', 'define', 'act'];
const TAB = { athletes: 'Athletes', wall: 'Group Wall', settings: 'Settings', data: '_data',
              discover: '1 Discover', define: '2 Define', act: '3 Act' };
const ATHLETE_COLS = ['ID', 'Name', 'School', 'Sport', 'Email', 'Handle', 'Joined', 'Last active',
                      'Baseline score sheet', 'Visual playbook PDF', 'Roadmap', 'PIN hash'];
const WALL_COLS = ['Post ID', 'Time', 'Athlete ID', 'Name', 'Kind', 'Text', 'Photo ID', 'Hidden'];
const MATERIAL_COL = { baseline: 'Baseline score sheet', playbook: 'Visual playbook PDF', roadmap: 'Roadmap' };

/* ---------------- setup + serving ---------------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureTab_(TAB.athletes, ATHLETE_COLS);
  ensureTab_(TAB.wall, WALL_COLS);
  ensureTab_(TAB.data, ['Athlete ID', 'Session', 'JSON', 'Updated']).hideSheet();
  SESSIONS.forEach(s => ensureTab_(TAB[s], ['Name', 'School', 'Sport', 'Email', 'Updated']));
  const st = ensureTab_(TAB.settings, ['Setting', 'Value']);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('HOST_KEY')) props.setProperty('HOST_KEY', Utilities.getUuid().slice(0, 8));
  if (!props.getProperty('OPEN')) props.setProperty('OPEN', 'discover');
  if (!props.getProperty('FOLDER_ID')) {
    const f = DriveApp.createFolder('Personal Brand Playbook uploads');
    props.setProperty('FOLDER_ID', f.getId());
  }
  st.getRange(2, 1, 3, 2).setValues([
    ['Host key (add ?host=KEY to the site link)', props.getProperty('HOST_KEY')],
    ['Open sessions (change from the host view)', props.getProperty('OPEN')],
    ['Uploads folder', 'https://drive.google.com/drive/folders/' + props.getProperty('FOLDER_ID')]]);
  const sh1 = ss.getSheetByName('Sheet1'); if (sh1 && ss.getSheets().length > 1) ss.deleteSheet(sh1);
  Logger.log('Setup done. Host key: ' + props.getProperty('HOST_KEY') +
             '\nNow Deploy > New deployment > Web app, then open <url>?host=' + props.getProperty('HOST_KEY'));
}

// Called by the Cloudflare-hosted site: POST {fn, args} as text/plain, returns {ok, data | error}.
const PUBLIC_FNS = ['getConfig', 'join', 'login', 'saveAnswers', 'uploadPhoto', 'postToWall', 'removeMyPost', 'getWall',
                    'hostOverview', 'hostSetOpen', 'hostSetHidden', 'hostSetMaterial'];
function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (PUBLIC_FNS.indexOf(req.fn) < 0) throw new Error('Unknown action');
    out = { ok: true, data: globalThis[req.fn].apply(null, req.args || []) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Opening the web app URL in a browser shows whether the backend is running.
function doGet() {
  const ok = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.athletes);
  return ContentService.createTextOutput(JSON.stringify({
    ok: true, status: '98Strong Playbook backend is running', setupDone: ok
  })).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- athlete API ---------------- */

function getConfig() { return { open: openSessions_() }; }

function join(p) {
  return withLock_(() => {
    const email = String(p.email || '').trim().toLowerCase();
    const pin = String(p.pin || '').trim();
    if (!email || !/^\d{4}$/.test(pin) || !p.name) throw new Error('Name, email and a 4-digit PIN are required.');
    const sh = sheet_(TAB.athletes);
    const rows = sh.getDataRange().getValues();
    const c = colIndex_(rows[0]);
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][c['Email']]).toLowerCase() === email) {
        if (rows[i][c['PIN hash']] !== hash_(pin)) throw new Error('That email has already joined. Enter the PIN you chose to get back in.');
        return session_(rows[i], c, pin);
      }
    }
    const id = Utilities.getUuid().slice(0, 8);
    const now = new Date();
    const row = ATHLETE_COLS.map(h => ({ 'ID': id, 'Name': p.name, 'School': p.school || '', 'Sport': p.sport || '',
      'Email': email, 'Handle': p.handle || '', 'Joined': now, 'Last active': now, 'PIN hash': hash_(pin) })[h] || '');
    sh.appendRow(row);
    return session_(row, colIndex_(ATHLETE_COLS), pin);
  });
}

function login(email, pin) {
  const a = auth_(null, pin, email);
  return session_(a.row, a.c, pin);
}

function saveAnswers(id, pin, session, answers, flat) {
  if (SESSIONS.indexOf(session) < 0) throw new Error('Unknown session');
  return withLock_(() => {
    const a = auth_(id, pin);
    const now = new Date();
    // full JSON (used to restore the athlete's answers)
    const d = sheet_(TAB.data), dv = d.getDataRange().getValues();
    let r = dv.findIndex((x, i) => i > 0 && x[0] === id && x[1] === session);
    const json = JSON.stringify(answers || {});
    if (r > 0) d.getRange(r + 1, 3, 1, 2).setValues([[json, now]]); else d.appendRow([id, session, json, now]);
    // readable tab, one row per athlete
    const sh = sheet_(TAB[session]);
    let header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    Object.keys(flat || {}).forEach(k => { if (header.indexOf(k) < 0) { header.push(k); sh.getRange(1, header.length).setValue(k).setFontWeight('bold'); } });
    const base = { 'Name': a.row[a.c['Name']], 'School': a.row[a.c['School']], 'Sport': a.row[a.c['Sport']], 'Email': a.row[a.c['Email']], 'Updated': now };
    const out = header.map(h => (h in base) ? base[h] : String((flat || {})[h] || ''));
    const emails = sh.getLastRow() > 1 ? sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues().map(x => x[0]) : [];
    const er = emails.indexOf(base['Email']);
    if (er >= 0) sh.getRange(er + 2, 1, 1, out.length).setValues([out]); else sh.appendRow(out);
    touch_(a);
    return { savedAt: now.toISOString() };
  });
}

function uploadPhoto(id, pin, dataUrl, filename) {
  const a = auth_(id, pin);
  const file = saveDataUrl_(dataUrl, a.row[a.c['Name']] + ' - ' + (filename || 'photo') + '.jpg', a.row[a.c['Name']]);
  return { id: file.getId() };
}

function postToWall(id, pin, kind, text, photoId) {
  return withLock_(() => {
    const a = auth_(id, pin);
    const sh = sheet_(TAB.wall);
    const postId = Utilities.getUuid().slice(0, 8);
    sh.appendRow([postId, new Date(), id, a.row[a.c['Name']], String(kind || '').slice(0, 40),
                  String(text || '').slice(0, 1200), photoId || '', false]);
    return { postId };
  });
}

function removeMyPost(id, pin, postId) {
  return withLock_(() => {
    auth_(id, pin);
    const sh = sheet_(TAB.wall), v = sh.getDataRange().getValues();
    const r = v.findIndex((x, i) => i > 0 && x[0] === postId && x[2] === id);
    if (r > 0) sh.getRange(r + 1, 8).setValue(true);
    return true;
  });
}

function getWall() { return wall_(false); }

/* ---------------- host API ---------------- */

function hostOverview(key) {
  hostAuth_(key);
  const rows = sheet_(TAB.athletes).getDataRange().getValues(), c = colIndex_(rows[0]);
  const data = sheet_(TAB.data).getDataRange().getValues().slice(1);
  const athletes = rows.slice(1).map(r => {
    const prog = {};
    data.filter(d => d[0] === r[c['ID']]).forEach(d => {
      try { prog[d[1]] = Object.values(JSON.parse(d[2])).filter(v => v && (typeof v !== 'object' || Object.keys(v).length)).length; } catch (e) {}
    });
    return { id: r[c['ID']], name: r[c['Name']], school: r[c['School']], sport: r[c['Sport']], email: r[c['Email']],
      handle: r[c['Handle']], lastActive: r[c['Last active']] ? new Date(r[c['Last active']]).toISOString() : '',
      progress: prog, materials: materials_(r, c) };
  });
  return { open: openSessions_(), athletes, wall: wall_(true), sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
}

function hostSetOpen(key, list) {
  hostAuth_(key);
  const v = (list || []).filter(s => SESSIONS.indexOf(s) >= 0).join(',');
  PropertiesService.getScriptProperties().setProperty('OPEN', v);
  try { sheet_(TAB.settings).getRange(3, 2).setValue(v); } catch (e) {}
  return openSessions_();
}

function hostSetHidden(key, postId, hidden) {
  hostAuth_(key);
  return withLock_(() => {
    const sh = sheet_(TAB.wall), v = sh.getDataRange().getValues();
    const r = v.findIndex((x, i) => i > 0 && x[0] === postId);
    if (r > 0) sh.getRange(r + 1, 8).setValue(!!hidden);
    return true;
  });
}

/** type: baseline | playbook | roadmap. Pass a file (dataUrl) or a link. */
function hostSetMaterial(key, athleteId, type, dataUrl, filename, link) {
  hostAuth_(key);
  const col = MATERIAL_COL[type]; if (!col) throw new Error('Unknown material');
  return withLock_(() => {
    const sh = sheet_(TAB.athletes), v = sh.getDataRange().getValues(), c = colIndex_(v[0]);
    const r = v.findIndex((x, i) => i > 0 && x[c['ID']] === athleteId);
    if (r < 1) throw new Error('Athlete not found');
    let url = link || '';
    if (dataUrl) url = saveDataUrl_(dataUrl, v[r][c['Name']] + ' - ' + col + ' - ' + (filename || 'file'), v[r][c['Name']]).getUrl();
    sh.getRange(r + 1, c[col] + 1).setValue(url);
    return url;
  });
}

/* ---------------- helpers ---------------- */

function session_(row, c, pin) {
  const id = row[c['ID']];
  const answers = {};
  sheet_(TAB.data).getDataRange().getValues().slice(1).filter(d => d[0] === id)
    .forEach(d => { try { answers[d[1]] = JSON.parse(d[2]); } catch (e) {} });
  return { athlete: { id, name: row[c['Name']], school: row[c['School']], sport: row[c['Sport']],
                      email: row[c['Email']], handle: row[c['Handle']] },
           pin, answers, materials: materials_(row, c), open: openSessions_() };
}

function materials_(r, c) {
  return { baseline: r[c['Baseline score sheet']] || '', playbook: r[c['Visual playbook PDF']] || '', roadmap: r[c['Roadmap']] || '' };
}

function auth_(id, pin, email) {
  const rows = sheet_(TAB.athletes).getDataRange().getValues(), c = colIndex_(rows[0]);
  const h = hash_(String(pin || '').trim());
  for (let i = 1; i < rows.length; i++) {
    const match = id ? rows[i][c['ID']] === id : String(rows[i][c['Email']]).toLowerCase() === String(email || '').trim().toLowerCase();
    if (match) {
      if (rows[i][c['PIN hash']] !== h) throw new Error('That PIN does not match.');
      return { row: rows[i], c, r: i + 1 };
    }
  }
  throw new Error('We could not find you. Join with your name and email first.');
}

function touch_(a) { sheet_(TAB.athletes).getRange(a.r, a.c['Last active'] + 1).setValue(new Date()); }

function wall_(includeHidden) {
  const v = sheet_(TAB.wall).getDataRange().getValues().slice(1);
  return v.filter(x => x[0] && (includeHidden || x[7] !== true))
    .map(x => ({ id: x[0], time: new Date(x[1]).toISOString(), athleteId: x[2], name: x[3], kind: x[4], text: x[5], photoId: x[6], hidden: x[7] === true }))
    .reverse();
}

function saveDataUrl_(dataUrl, name, athleteName) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Bad file');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name);
  if (blob.getBytes().length > 15 * 1024 * 1024) throw new Error('File is too large (15 MB max).');
  const root = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const it = root.getFoldersByName(athleteName);
  const folder = it.hasNext() ? it.next() : root.createFolder(athleteName);
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return file;
}

function openSessions_() {
  return String(PropertiesService.getScriptProperties().getProperty('OPEN') || 'discover').split(',').filter(String);
}
function hostAuth_(key) {
  if (!key || key !== PropertiesService.getScriptProperties().getProperty('HOST_KEY')) throw new Error('Host key not recognized.');
}
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'pbp:' + s)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Run setup first (missing tab ' + name + ').');
  return sh;
}
function ensureTab_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(header); sh.setFrozenRows(1); sh.getRange(1, 1, 1, header.length).setFontWeight('bold'); }
  return sh;
}
function colIndex_(header) { const o = {}; header.forEach((h, i) => o[h] = i); return o; }
function withLock_(fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}
