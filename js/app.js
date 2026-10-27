(function () {
  'use strict';
  var VERSION = '1.0.0';
  var UPDATE_URL = 'https://brolegacy.github.io/mytv/version.json'; // TizenBrew met aussi l'app à jour tout seul
  var DEFAULT_M3U = 'https://iptv-org.github.io/iptv/countries/fr.m3u';
  var THEMES = ['aurora', 'sunset', 'forest', 'mono'];
  var GLOW_MODES = ['video', 'pulse', 'rainbow', 'off'];
  var GLOW_LABEL = { video: 'Halo : suit la vidéo', pulse: 'Halo : pulsation', rainbow: 'Halo : arc-en-ciel', off: 'Halo : éteint' };
  var FAV_APPS = [
    { name: 'Netflix', id: '11101200001' },
    { name: 'YouTube', id: '111299001912' },
    { name: 'Disney+', id: '3201901017640' },
    { name: 'Prime Video', id: '3201512006785' }
  ];

  var $ = function (s) { return document.querySelector(s); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mytv.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mytv.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var S = { theme: store.get('theme', 'aurora'), glow: store.get('glow', 'video'), inten: store.get('inten', 2), m3u: store.get('m3u', DEFAULT_M3U), channels: [], view: 'home' };

  /* ---------- horloge ---------- */
  function tick() { var d = new Date(); $('#clock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  setInterval(tick, 10000); tick();

  /* ---------- thèmes ---------- */
  function applyTheme() { document.body.setAttribute('data-theme', S.theme); store.set('theme', S.theme); }
  function buildThemes() {
    var box = $('#themes'); box.innerHTML = '';
    THEMES.forEach(function (t) {
      var b = document.createElement('button'); b.className = 'f'; b.textContent = t;
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
  function toast(t) { var o = $('#osd'); o.textContent = t; setTimeout(function () { o.textContent = ''; }, 3000); }
  function launch(id) {
    try { tizen.application.launch(id, function () {}, function (e) { toast('Échec : ' + e.message); }); }
    catch (e) { toast('Lancement possible seulement sur la TV'); }
  }
  function appBtn(name, id) {
    var b = document.createElement('button'); b.className = 'f app'; b.textContent = name; b.onclick = function () { launch(id); }; return b;
  }
  function buildApps() {
    var shelf = $('#shelf'); shelf.innerHTML = '';
    store.get('shelf', FAV_APPS).forEach(function (a) { shelf.appendChild(appBtn(a.name, a.id)); });
    try {
      tizen.application.getAppsInfo(function (list) {
        var box = $('#allapps'); box.innerHTML = '';
        list.sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (a) { box.appendChild(appBtn(a.name, a.id)); });
      });
    } catch (e) { $('#allapps').textContent = '(liste disponible sur la TV)'; }
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
  function loadM3U() {
    $('#channels').textContent = 'Chargement…';
    fetch(S.m3u).then(function (r) { return r.text(); }).then(function (t) {
      S.channels = parseM3U(t); renderChannels();
    }).catch(function () { $('#channels').textContent = 'Playlist inaccessible'; });
  }
  function renderChannels() {
    var q = $('#search').value.toLowerCase(), box = $('#channels'); box.innerHTML = '';
    S.channels.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 40).forEach(function (c) {
      var b = document.createElement('button'); b.className = 'f ch';
      b.innerHTML = (c.logo ? '<img src="' + c.logo.replace(/"/g, '') + '">' : '') + '<span></span>';
      b.lastChild.textContent = c.name; b.onclick = function () { play(c); }; box.appendChild(b);
    });
  }
  var hls = null, osdT;
  function play(c) {
    var p = $('#player'), v = $('#video'); p.hidden = false; taint = false;
    $('#osd').textContent = c.name; clearTimeout(osdT); osdT = setTimeout(function () { $('#osd').textContent = ''; }, 4000);
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
    fetch(UPDATE_URL + '?t=' + Math.floor(new Date().getTime() / 60000)).then(function (r) { return r.json(); }).then(function (j) {
      if (newer(j.version, VERSION) && !j.url) { msg.textContent = 'Version ' + j.version + ' disponible (mise à jour via TizenBrew)'; }
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
    if (el.tagName === 'INPUT') el.focus();
    el.scrollIntoView({ block: 'nearest' });
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
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode, inp = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (!$('#player').hidden) { if (k === 10009 || k === 8) { stop(); e.preventDefault(); } return; }
    if (k === 37) { if (!inp) move('l'); } else if (k === 39) { if (!inp) move('r'); }
    else if (k === 38) move('u'); else if (k === 40) move('d');
    else if (k === 13) { var c = $('.focus'); if (c && c.tagName !== 'INPUT') c.click(); }
    else if (k === 10009) { if (S.view !== 'home') show('home'); }
    else return;
    e.preventDefault();
  });
  $('#search').addEventListener('input', renderChannels);

  function show(v) {
    S.view = v;
    [].forEach.call(document.querySelectorAll('.view'), function (s) { s.hidden = s.id !== v; });
    [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.dataset.view === v); });
    if (v === 'tv' && !S.channels.length) loadM3U();
    setFocus(null);
    setTimeout(function () { var f = focusables(); setFocus(f.filter(function (x) { return !x.classList.contains('tab'); })[0] || f[0]); }, 50);
  }

  /* ---------- init ---------- */
  [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.onclick = function () { show(t.dataset.view); }; });
  $('#glowMode').onclick = function () { S.glow = GLOW_MODES[(GLOW_MODES.indexOf(S.glow) + 1) % GLOW_MODES.length]; store.set('glow', S.glow); glowLabels(); };
  $('#glowInt').onclick = function () { S.inten = (S.inten + 1) % 3; store.set('inten', S.inten); glowLabels(); };
  $('#m3u').value = S.m3u;
  $('#m3uSave').onclick = function () { S.m3u = $('#m3u').value; store.set('m3u', S.m3u); S.channels = []; show('tv'); };
  $('#upd').onclick = function () { checkUpdate(true); };
  applyTheme(); buildThemes(); glowLabels(); buildApps(); show('home'); checkUpdate(false);
})();
