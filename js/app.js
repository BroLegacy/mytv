(function () {
  'use strict';
  var VERSION = '1.3.0'; window.MYTV_VERSION = VERSION;
  var UPDATE_URL = 'https://brolegacy.github.io/mytv/version.json'; // TizenBrew met aussi l'app à jour tout seul
  var DEFAULT_M3U = 'https://iptv-org.github.io/iptv/countries/fr.m3u';
  var THEMES = ['aurora', 'sunset', 'forest', 'mono'];
  // couleurs des aperçus de thème (miroir de css/style.css)
  var TH = { aurora: ['#0b0d17', '#1a1e33', '#262b47', '#7c5cff'], sunset: ['#1a0d12', '#2e1a22', '#3d242d', '#ff6a3d'],
             forest: ['#09140f', '#14281d', '#1d3a29', '#3ddc84'], mono: ['#0d0d0d', '#202020', '#2e2e2e', '#ffffff'] };
  var GLOW_MODES = ['video', 'pulse', 'rainbow', 'off'];
  var GLOW_LABEL = { video: 'Halo : suit la vidéo', pulse: 'Halo : pulsation', rainbow: 'Halo : arc-en-ciel', off: 'Halo : éteint' };
  // re : nom de l'app sur la TV (retrouvée automatiquement, avec son icône) ; id : identifiant de secours
  var FAV_APPS = [
    { name: 'YouTube', re: 'youtube', id: '111299001912', color: '#e62117' },
    { name: 'Disney+', re: 'disney', id: '3201901017640', color: '#113ccf' },
    { name: 'Netflix', re: 'netflix', id: '11101200001', color: '#e50914' },
    { name: 'Prime Video', re: 'prime|amazon', id: '3201512006785', color: '#00a8e1' },
    { name: 'Jellyfin', re: 'jellyfin', id: 'AprZAARz4r.Jellyfin', color: '#8f5fc9' }
  ];

  var $ = function (s) { return document.querySelector(s); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mytv.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mytv.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var S = { theme: store.get('theme', 'aurora'), glow: store.get('glow', 'video'), inten: store.get('inten', 2), m3u: store.get('m3u', DEFAULT_M3U), channels: [], view: 'home' };

  /* ---------- horloge ---------- */
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function tick() {
    var d = new Date();
    $('#clock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    $('#date').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  setInterval(tick, 10000); tick();

  /* ---------- thèmes ---------- */
  function applyTheme() {
    document.body.setAttribute('data-theme', S.theme); store.set('theme', S.theme);
    [].forEach.call(document.querySelectorAll('.theme'), function (b) { b.classList.toggle('sel', b.dataset.t === S.theme); });
  }
  function buildThemes() {
    var box = $('#themes'); box.innerHTML = '';
    THEMES.forEach(function (t) {
      var c = TH[t], b = document.createElement('button'); b.className = 'f theme'; b.dataset.t = t;
      b.innerHTML = '<div class="tp" style="background:' + c[0] + ';border-color:' + c[2] + '"><b style="background:' + c[1] + '"></b><u style="background:' + c[3] + '"></u></div><span></span>';
      b.lastChild.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      b.onclick = function () { S.theme = t; applyTheme(); };
      box.appendChild(b);
    });
  }

  /* ---------- halo lumineux ---------- */
  var INT = [{ s: 60, w: 8 }, { s: 120, w: 18 }, { s: 220, w: 40 }];
  function glowLabels() { $('#glowMode').textContent = GLOW_LABEL[S.glow]; $('#glowInt').textContent = 'Intensité : ' + (S.inten + 1) + '/3'; }
  function glowSet(c) {
    var g = $('#glow').style, i = INT[S.inten];
    g.setProperty('--gc', c); g.setProperty('--gs', i.s + 'px'); g.setProperty('--gw', i.w + 'px');
  }
  var cvs = document.createElement('canvas'); cvs.width = 16; cvs.height = 9;
  var ctx = cvs.getContext('2d'), hue = 0, phase = 0, taint = false;
  function avgEdge(data) {
    var r = 0, g = 0, b = 0, n = 0;
    for (var y = 0; y < 9; y++) for (var x = 0; x < 16; x++) {
      if (x > 1 && x < 14 && y > 1 && y < 7) continue;
      var i = (y * 16 + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return 'rgb(' + ((r / n) | 0) + ',' + ((g / n) | 0) + ',' + ((b / n) | 0) + ')';
  }
  setInterval(function () {
    document.body.classList.toggle('glow-off', S.glow === 'off');
    if (S.glow === 'off') return;
    var v = $('#video'), playing = !$('#player').hidden;
    if (S.glow === 'video' && playing && !taint && v.videoWidth) {
      try { ctx.drawImage(v, 0, 0, 16, 9); glowSet(avgEdge(ctx.getImageData(0, 0, 16, 9).data)); $('#glow').style.opacity = 1; return; }
      catch (e) { taint = true; } // flux sans CORS : repli sur l'animation
    }
    if (S.glow === 'pulse' || S.glow === 'video') {
      phase += 0.12; var k = 0.5 + 0.5 * Math.sin(phase);
      var st = getComputedStyle(document.body);
      glowSet(k > 0.5 ? st.getPropertyValue('--g1') : st.getPropertyValue('--g2'));
      $('#glow').style.opacity = 0.55 + 0.45 * k;
    } else { hue = (hue + 4) % 360; glowSet('hsl(' + hue + ',100%,55%)'); $('#glow').style.opacity = 1; }
  }, 120);

  /* ---------- apps ---------- */
  var toastT;
  function toast(t) {
    var o = $('#toast');
    if (!o) { o = document.createElement('div'); o.id = 'toast'; document.body.appendChild(o); }
    o.textContent = t; o.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { o.hidden = true; }, 3500);
  }
  function launch(id) {
    try { tizen.application.launch(id, function () {}, function (e) { toast('Échec du lancement : ' + e.message); }); }
    catch (e) { toast('Lancement possible seulement sur la TV'); }
  }
  function iconUrl(p) { return !p ? '' : (/^(\/|[a-zA-Z]:)/.test(p) ? 'file://' + p : p); }
  // tuile : icône réelle de l'app sur la TV, sinon pastille colorée avec l'initiale
  function appBtn(name, id, icon, color) {
    var b = document.createElement('button'); b.className = 'f app ' + (color ? 'big' : 'small');
    var ic = document.createElement('div'); ic.className = 'ico' + (color ? '' : ' plain'); if (color) ic.style.background = color;
    ic.textContent = name.charAt(0).toUpperCase();
    var u = iconUrl(icon);
    if (u) {
      var im = new Image();
      im.onload = function () { ic.textContent = ''; ic.style.background = 'none'; ic.classList.remove('plain'); ic.appendChild(im); };
      im.src = u;
    }
    var lb = document.createElement('span'); lb.textContent = name;
    b.appendChild(ic); b.appendChild(lb); b.onclick = function () { launch(id); };
    return b;
  }
  var appIds = {};
  function drawShelf(list) {
    var shelf = $('#shelf'); shelf.innerHTML = '';
    FAV_APPS.forEach(function (f) {
      var re = new RegExp(f.re, 'i'), hit = null;
      (list || []).forEach(function (a) { if (!hit && (a.id === f.id || re.test(a.name))) hit = a; });
      appIds[f.name] = hit ? hit.id : f.id;
      shelf.appendChild(appBtn(f.name, appIds[f.name], hit && hit.iconPath, f.color));
    });
  }
  function buildApps() {
    drawShelf(null);
    try {
      tizen.application.getAppsInfo(function (list) {
        drawShelf(list);
        var box = $('#allapps'); box.innerHTML = '';
        list.sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (a) { box.appendChild(appBtn(a.name, a.id, a.iconPath)); });
        refocusIfLost();
      }, function () { $('#allapps').textContent = '(liste indisponible)'; });
    } catch (e) { $('#allapps').textContent = '(liste disponible sur la TV)'; }
  }
  function refocusIfLost() {
    if (S.view === 'home' && !document.querySelector('.focus')) { var f = focusables().filter(function (x) { return !x.classList.contains('tab'); })[0]; if (f) setFocus(f); }
  }

  /* ---------- IPTV ---------- */
  function parseM3U(txt) {
    var out = [], cur = null;
    txt.split(/\r?\n/).forEach(function (l) {
      if (l.indexOf('#EXTINF') === 0) {
        var nm = l.split(',').slice(1).join(',').trim(), lg = /tvg-logo="([^"]*)"/.exec(l);
        cur = { name: nm, logo: lg ? lg[1] : '' };
      } else if (cur && l && l[0] !== '#') { cur.url = l.trim(); out.push(cur); cur = null; }
    });
    return out;
  }
  function loadM3U(cb) {
    $('#channels').textContent = 'Chargement…';
    fetch(S.m3u).then(function (r) { return r.text(); }).then(function (t) {
      S.channels = parseM3U(t); renderChannels(); if (cb) cb();
      var cur = $('.focus'), first = document.querySelector('#channels .ch');
      if (S.view === 'tv' && first && (!cur || cur.id === 'search') && document.activeElement !== $('#search')) setFocus(first);
    }).catch(function () { $('#channels').textContent = 'Playlist inaccessible'; });
  }
  function renderChannels() {
    var q = $('#search').value.toLowerCase(), box = $('#channels'); box.innerHTML = '';
    var list = S.channels.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; });
    $('#count').textContent = list.length ? list.length + ' chaîne' + (list.length > 1 ? 's' : '') : 'Aucune chaîne';
    list.slice(0, 200).forEach(function (c) {
      var b = document.createElement('button'); b.className = 'f ch';
      var lg = document.createElement('div'); lg.className = 'logo'; lg.textContent = c.name.replace(/[^A-Za-z0-9+]/g, '').slice(0, 3).toUpperCase();
      if (c.logo) { var im = new Image(); im.onload = function () { lg.textContent = ''; lg.appendChild(im); }; im.src = c.logo; }
      var n = document.createElement('span'); n.className = 'n'; n.textContent = c.name;
      b.appendChild(lg); b.appendChild(n); b.onclick = function () { play(c); }; box.appendChild(b);
    });
  }
  var hls = null, osdT;
  function play(c) {
    var p = $('#player'), v = $('#video'); p.hidden = false; taint = false;
    $('#osd').innerHTML = '<b></b><small>Retour pour quitter</small>'; $('#osd').firstChild.textContent = c.name;
    clearTimeout(osdT); osdT = setTimeout(function () { $('#osd').innerHTML = ''; }, 4000);
    if (hls) { hls.destroy(); hls = null; }
    v.crossOrigin = 'anonymous';
    if (window.Hls && Hls.isSupported() && /\.m3u8/.test(c.url)) { hls = new Hls(); hls.loadSource(c.url); hls.attachMedia(v); }
    else { v.src = c.url; }
    v.play();
  }
  function stop() {
    var v = $('#video'); v.pause(); v.removeAttribute('src');
    if (hls) { hls.destroy(); hls = null; }
    $('#player').hidden = true;
  }

  /* ---------- mises à jour ---------- */
  function newer(a, b) {
    a = a.split('.'); b = b.split('.');
    for (var i = 0; i < 3; i++) { var x = +a[i] || 0, y = +b[i] || 0; if (x !== y) return x > y; }
    return false;
  }
  function checkUpdate(manual) {
    var msg = $('#updMsg');
    if (!UPDATE_URL) { if (manual) msg.textContent = 'UPDATE_URL non configurée'; return; }
    fetch(UPDATE_URL + '?t=' + Math.floor(new Date().getTime() / 60000), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (newer(j.version, VERSION) && !j.url) {
        // le chargeur récupère le code en ligne à chaque démarrage : recharger suffit (une seule fois par version, pour éviter une boucle)
        if (store.get('reloaded', '') === j.version) { msg.textContent = 'Version ' + j.version + ' disponible : ferme puis relance MyTV'; }
        else { store.set('reloaded', j.version); msg.textContent = 'Mise à jour ' + j.version + '… rechargement'; toast('Mise à jour ' + j.version + '…'); setTimeout(function () { location.reload(); }, 1200); }
      }
      else if (newer(j.version, VERSION) && j.url) { msg.textContent = 'Mise à jour ' + j.version + '…'; setTimeout(function () { location.href = j.url; }, 800); }
      else if (manual) msg.textContent = 'À jour (v' + VERSION + ')';
    }).catch(function () { if (manual) msg.textContent = 'Vérification impossible'; });
  }

  /* ---------- navigation télécommande ---------- */
  function visible(el) { return el.offsetParent !== null && !el.closest('[hidden]'); }
  function focusables() { return [].filter.call(document.querySelectorAll('.f'), visible); }
  function setFocus(el) {
    [].forEach.call(document.querySelectorAll('.focus'), function (e) { e.classList.remove('focus'); });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!el) return;
    el.classList.add('focus');
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function move(dir) {
    var cur = $('.focus'), all = focusables(); if (!cur) return setFocus(all[0]);
    var r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, best = null, bs = 1e12;
    all.forEach(function (e) {
      if (e === cur) return;
      var q = e.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy, ok;
      ok = dir === 'l' ? x < -5 && Math.abs(y) < Math.abs(x) * 2 : dir === 'r' ? x > 5 && Math.abs(y) < Math.abs(x) * 2 :
           dir === 'u' ? y < -5 && Math.abs(x) < Math.abs(y) * 2 : y > 5 && Math.abs(x) < Math.abs(y) * 2;
      if (!ok) return;
      var s = x * x + y * y; if (s < bs) { bs = s; best = e; }
    });
    if (best) setFocus(best);
  }
  // renvoie true si la touche a été traitée
  function onKey(k) {
    var inp = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (!$('#player').hidden) { if (k === 10009 || k === 8) { stop(); return true; } return false; }
    if (k === 37) { if (!inp) move('l'); } else if (k === 39) { if (!inp) move('r'); }
    else if (k === 38) move('u'); else if (k === 40) move('d');
    else if (k === 13) { var c = $('.focus'); if (c && c.tagName === 'INPUT') c.focus(); else if (c) c.click(); }
    else if (k === 10009) { if (inp) document.activeElement.blur(); else if (S.view !== 'home') show('home'); }
    else return false;
    return true;
  }
  document.addEventListener('keydown', function (e) { if (onKey(e.keyCode)) e.preventDefault(); });
  $('#search').addEventListener('input', renderChannels);

  function show(v) {
    S.view = v;
    [].forEach.call(document.querySelectorAll('.view'), function (s) { s.hidden = s.id !== v; });
    [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.dataset.view === v); });
    if (v === 'tv' && !S.channels.length) loadM3U();
    setFocus(null);
    setTimeout(function () {
      var f = focusables(), ch = v === 'tv' && document.querySelector('#channels .ch');
      setFocus(ch || f.filter(function (x) { return !x.classList.contains('tab'); })[0] || f[0]);
    }, 50);
  }

  /* ---------- télécommande téléphone (relais ntfy.sh) ---------- */
  var REMOTE_BASE = 'https://ntfy.sh/', REMOTE_PAGE = 'https://brolegacy.github.io/mytv/remote.html';
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  var KEYS = { up: 38, down: 40, left: 37, right: 39, ok: 13, back: 10009 };
  var remote = { es: null, lastId: '', box: null };
  function topic(renew) {
    var t = store.get('topic', '');
    if (!t || renew) {
      var a = new Uint8Array(12), i;
      try { crypto.getRandomValues(a); } catch (e) { for (i = 0; i < 12; i++) a[i] = Math.random() * 256; }
      t = 'mytv-'; for (i = 0; i < 12; i++) t += (a[i] % 36).toString(36);
      store.set('topic', t);
    }
    return t;
  }
  function publishState() {
    try { fetch(REMOTE_BASE + topic(), { method: 'POST', body: 'state:' + JSON.stringify({ v: VERSION, theme: S.theme, glow: S.glow, inten: S.inten }) }); } catch (e) {}
  }
  function remoteCmd(m) {
    if (m.indexOf('state:') === 0) return;
    if (m === 'ping') return publishState();
    remoteDo(m); setTimeout(publishState, 300);
  }
  function remoteDo(m) {
    var i = m.indexOf(':'), c = i < 0 ? m : m.slice(0, i), a = i < 0 ? '' : m.slice(i + 1);
    if (c === 'app') {
      var f = FAV_APPS.filter(function (x) { return x.name === a; })[0];
      if (f) { toast('Télécommande : ' + f.name); launch(appIds[f.name] || f.id); }
    } else if (c === 'key') { if (KEYS[a]) onKey(KEYS[a]); }
    else if (c === 'theme') { if (THEMES.indexOf(a) >= 0) { S.theme = a; applyTheme(); } }
    else if (c === 'glow') { if (GLOW_MODES.indexOf(a) >= 0) { S.glow = a; store.set('glow', a); glowLabels(); } }
    else if (c === 'inten') { S.inten = Math.max(0, Math.min(2, +a || 0)); store.set('inten', S.inten); glowLabels(); }
    else if (c === 'tv') {
      var go = function () { var ch = S.channels.filter(function (x) { return x.name === a; })[0]; if (ch) play(ch); };
      if (S.channels.length) go(); else loadM3U(go);
    } else if (c === 'stop') stop();
    else if (c === 'reload') location.reload();
    else if (c === 'home') { stop(); show('home'); }
  }
  setInterval(function () { if (remote.es) publishState(); }, 30000);
  function remoteStatus(t) { if (remote.st) remote.st.textContent = t; }
  function remoteConnect() {
    if (remote.es) { remote.es.close(); remote.es = null; }
    if (!window.EventSource) return remoteStatus('Télécommande indisponible sur cette TV');
    var es = remote.es = new EventSource(REMOTE_BASE + topic() + '/sse');
    es.onopen = function () { remoteStatus('Télécommande connectée'); publishState(); };
    es.onerror = function () { remoteStatus('Télécommande : reconnexion…'); };
    es.onmessage = function (ev) {
      try {
        var j = JSON.parse(ev.data);
        if (j.event && j.event !== 'message') return;
        if (j.id && j.id === remote.lastId) return;
        remote.lastId = j.id; remoteCmd(String(j.message || ''));
      } catch (e) {}
    };
  }
  function drawQr() {
    var url = REMOTE_PAGE + '#' + topic();
    remote.link.textContent = url;
    remote.qr.innerHTML = '';
    var go = function () {
      try { var q = qrcode(0, 'M'); q.addData(url); q.make(); remote.qr.innerHTML = q.createImgTag(5, 12); } catch (e) {}
    };
    if (window.qrcode) return go();
    var s = document.createElement('script'); s.src = QR_LIB; s.onload = go; document.head.appendChild(s);
  }
  function buildRemote() {
    var card = $('#remoteCard'), rm = document.createElement('div'), side = document.createElement('div');
    rm.className = 'rm'; side.id = 'remoteSide';
    var btn = document.createElement('button'); btn.className = 'f pill'; btn.textContent = 'Nouveau code';
    remote.st = document.createElement('span');
    remote.qr = document.createElement('div'); remote.link = document.createElement('div'); remote.link.id = 'remoteLink';
    side.appendChild(remote.st); side.appendChild(btn); side.appendChild(remote.link);
    rm.appendChild(remote.qr); rm.appendChild(side); card.appendChild(rm);
    btn.onclick = function () { topic(true); drawQr(); remoteConnect(); };
    drawQr(); remoteConnect();
  }

  /* ---------- init ---------- */
  [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.onclick = function () { show(t.dataset.view); }; });
  $('#glowMode').onclick = function () { S.glow = GLOW_MODES[(GLOW_MODES.indexOf(S.glow) + 1) % GLOW_MODES.length]; store.set('glow', S.glow); glowLabels(); };
  $('#glowInt').onclick = function () { S.inten = (S.inten + 1) % 3; store.set('inten', S.inten); glowLabels(); };
  $('#m3u').value = S.m3u;
  $('#m3uSave').onclick = function () { S.m3u = $('#m3u').value; store.set('m3u', S.m3u); S.channels = []; show('tv'); };
  $('#upd').onclick = function () { checkUpdate(true); };
  applyTheme(); buildThemes(); glowLabels(); buildApps(); buildRemote(); show('home'); checkUpdate(false);
})();
