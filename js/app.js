(function () {
  'use strict';
  var VERSION = '1.6.0'; window.MYTV_VERSION = VERSION;
  var UPDATE_URL = 'https://brolegacy.github.io/mytv/version.json'; // TizenBrew met aussi l'app à jour tout seul
  var DEFAULT_M3U = 'https://iptv-org.github.io/iptv/countries/fr.m3u';
  var THEMES = ['aurora', 'sunset', 'forest', 'mono'];
  // couleurs des aperçus de thème (miroir de css/style.css)
  var TH = { aurora: ['#0b0d17', '#1a1e33', '#262b47', '#7c5cff'], sunset: ['#1a0d12', '#2e1a22', '#3d242d', '#ff6a3d'],
             forest: ['#09140f', '#14281d', '#1d3a29', '#3ddc84'], mono: ['#0d0d0d', '#202020', '#2e2e2e', '#ffffff'] };
  var GLOW_MODES = ['video', 'pulse', 'rainbow', 'off'];
  var GLOW_LABEL = { video: 'Halo : suit la vidéo', pulse: 'Halo : pulsation', rainbow: 'Halo : arc-en-ciel', off: 'Halo : éteint' };
  var QUALITIES = ['auto', 'high', 'mid', 'low'];
  var QLABEL = { auto: 'Auto', high: 'Haute', mid: 'Moyenne', low: 'Basse' };
  var AMBIENTS = [0, 2, 5, 10];
  // re : nom de l'app sur la TV (retrouvée automatiquement, avec son icône) ; id : identifiant de secours
  var GLYPH_URL = 'https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/';
  var FAV_APPS = [
    { name: 'YouTube', ids: ['9Ur5IzDKqV.TizenYouTube', 'com.samsung.tv.cobalt-yt'], color: '#e62117', slug: 'youtube', glyph: true },
    { name: 'Disney+', ids: ['MCmYXNxgcu.DisneyPlus'], color: '#113ccf' },
    { name: 'Netflix', ids: ['org.tizen.netflix-app'], color: '#e50914', slug: 'netflix' },
    { name: 'Prime Video', ids: ['org.tizen.primevideo'], color: '#00a8e1', slug: 'primevideo' },
    { name: 'Jellyfin', ids: ['AprZAARz4r.Jellyfin'], color: '#8f5fc9', slug: 'jellyfin' },
    { name: 'Apple TV', ids: ['com.samsung.tv.aria-video'], color: '#3a3a3c', slug: 'appletv', row2: true },
    { name: 'Canal+', ids: ['guMmq95nKK.CanalPlusLauncher', 'QmpwflxWdt.CanalPlusLauncher'], color: '#202020', row2: true },
    { name: 'Hue Sync', ids: ['kupCeIdDkX.HueSync'], color: '#7a3cff', slug: 'philipshue', row2: true },
    { name: 'Spotify', ids: ['rJeHak5zRg.Spotify'], color: '#1db954', slug: 'spotify', row2: true },
    { name: 'TF1+', ids: ['E0P3lRI4H7.MYTF1'], color: '#1a56db', row2: true },
    { name: 'Twitch', ids: ['Jz7aUrV2Q4.Twitch'], color: '#9146ff', slug: 'twitch', row2: true }
  ];

  var $ = function (s) { return document.querySelector(s); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('mytv.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('mytv.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }
  var S = {
    theme: store.get('theme', 'aurora'), glow: store.get('glow', 'video'), inten: store.get('inten', 2), m3u: store.get('m3u', DEFAULT_M3U), channels: [], view: 'home',
    favs: arr(store.get('favs', [])), recents: arr(store.get('recents', [])), rem: arr(store.get('rem', [])),
    quality: store.get('quality', 'auto'), ambient: store.get('ambient', 5), resume: store.get('resume', 0) ? 1 : 0,
    chFilter: 'all', prev: null, cur: null, pip: false, mute: false, modal: false, chAt: 0, loading: false, pendCb: [], doResume: false, numBuf: ''
  };
  if (QUALITIES.indexOf(S.quality) < 0) S.quality = 'auto';
  if (AMBIENTS.indexOf(S.ambient) < 0) S.ambient = 5;

  /* ---------- horloge ---------- */
  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var ambOn = false, lastAct = Date.now();
  function tick() {
    var d = new Date(), hhmm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), dt = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    $('#clock').textContent = hhmm;
    $('#date').textContent = dt;
    var ac = $('#amClock'), ad = $('#amDate');
    if (ac && ad) {
      ac.textContent = hhmm; ad.textContent = dt;
      var box = ac.parentNode; // léger décalage à chaque minute (évite de marquer l'écran)
      box.style.transform = 'translate(' + ((d.getMinutes() % 5) - 2) * 24 + 'px,' + ((d.getMinutes() % 3) - 1) * 24 + 'px)';
    }
  }
  setInterval(tick, 10000);

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

  /* ---------- état du lecteur (helpers) ---------- */
  function isPlaying() { return !$('#player').hidden; }
  function isFull() { return isPlaying() && !S.pip; }

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
    // en veille d'ambiance, le halo reste allumé et doux (pulsation si il était éteint ou calé sur la vidéo)
    var mode = S.glow;
    if (ambOn && (mode === 'off' || mode === 'video')) mode = 'pulse';
    document.body.classList.toggle('glow-off', mode === 'off');
    if (mode === 'off') return;
    var v = $('#video'), playing = isPlaying();
    if (mode === 'video' && playing && !taint && v.videoWidth) {
      try { ctx.drawImage(v, 0, 0, 16, 9); glowSet(avgEdge(ctx.getImageData(0, 0, 16, 9).data)); $('#glow').style.opacity = 1; return; }
      catch (e) { taint = true; } // flux sans CORS : repli sur l'animation
    }
    if (mode === 'pulse' || mode === 'video') {
      phase += ambOn ? 0.035 : 0.12; var k = 0.5 + 0.5 * Math.sin(phase);
      var st = getComputedStyle(document.body);
      glowSet(k > 0.5 ? st.getPropertyValue('--g1') : st.getPropertyValue('--g2'));
      $('#glow').style.opacity = 0.55 + 0.45 * k;
    } else { hue = (hue + (ambOn ? 1 : 4)) % 360; glowSet('hsl(' + hue + ',100%,55%)'); $('#glow').style.opacity = 1; }
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
  function appBtn(name, id, icon, color, small, slug) {
    var b = document.createElement('button'); b.className = 'f app ' + (small ? 'small w2' : 'big');
    var ic = document.createElement('div'); ic.className = 'ico' + (color ? '' : ' plain'); if (color) ic.style.background = color;
    ic.textContent = name.charAt(0).toUpperCase();
    // 1) icône réelle de l'app sur la TV  2) logo de marque (simple-icons, en blanc)  3) initiale
    function glyph() {
      if (!slug) return;
      var g = new Image(); g.className = 'glyph';
      g.onload = function () { ic.textContent = ''; ic.appendChild(g); };
      g.src = GLYPH_URL + slug + '.svg';
    }
    var u = iconUrl(icon);
    if (u) {
      var im = new Image();
      im.onerror = glyph;
      im.onload = function () { ic.textContent = ''; ic.style.background = 'none'; ic.classList.remove('plain'); ic.appendChild(im); };
      im.src = u;
    } else glyph();
    var lb = document.createElement('span'); lb.textContent = name;
    b.appendChild(ic); b.appendChild(lb); b.onclick = function () { launch(id); };
    return b;
  }
  var appIds = {};
  function drawShelf(list) {
    var shelf = $('#shelf'), more = $('#allapps'); shelf.innerHTML = ''; more.innerHTML = '';
    more.previousElementSibling.textContent = 'Et aussi';
    FAV_APPS.forEach(function (f) {
      var hit = null;
      f.ids.forEach(function (id) { if (!hit) (list || []).forEach(function (a) { if (!hit && a.id === id) hit = a; }); });
      appIds[f.name] = hit ? hit.id : f.ids[0];
      (f.row2 ? more : shelf).appendChild(appBtn(f.name, appIds[f.name], !f.glyph && hit && hit.iconPath, f.color, !!f.row2, f.slug));
    });
  }
  function buildApps() {
    drawShelf(null);
    try { tizen.application.getAppsInfo(function (list) { drawShelf(list); refocusIfLost(); }, function () {}); } catch (e) {}
  }
  function refocusIfLost() {
    if (S.view === 'home' && !document.querySelector('.focus')) { var f = focusables().filter(function (x) { return !x.classList.contains('tab'); })[0]; if (f) setFocus(f); }
  }

  /* ---------- numéros de chaînes (TNT) ---------- */
  var TNT = { tf1: 1, france2: 2, france3: 3, canalplus: 4, france5: 5, m6: 6, arte: 7, c8: 8, w9: 9, tmc: 10, tfx: 11, nrj12: 12, lcp: 13, france4: 14,
              bfmtv: 15, cnews: 16, cstar: 17, gulli: 18, franceinfo: 19, lequipe: 20, lequipe21: 20, '6ter': 21, rmcstory: 22, rmcdecouverte: 23, cherie25: 24, lci: 25 };
  // Écart assumé au cahier des charges : le repli « commence par » n'accepte que ces suffixes (évite d'attribuer un numéro
  // à « TF1 Séries Films » ou « France 3 Bretagne »).
  // suffixes tolérés après le nom (jamais un chiffre : "France 2" != "France 24")
  var TNT_SUFFIX = { fr: 1, france: 1, tnt: 1, direct: 1, live: 1 };
  function normName(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\+/g, 'plus').replace(/\b(hd|fhd|uhd|sd)\b/g, ' ').replace(/[^a-z0-9]/g, '');
  }
  // renvoie { n : numéro ou 0, e : correspondance exacte }
  function numOf(c) {
    if (c._n) return c._n;
    var n = normName(c.name), r = { n: 0, e: false }, k;
    if (TNT.hasOwnProperty(n)) { r.n = TNT[n]; r.e = true; }
    else for (k in TNT) {
      if (TNT.hasOwnProperty(k) && n.indexOf(k) === 0 && TNT_SUFFIX[n.slice(k.length)]) { r.n = TNT[k]; break; }
    }
    c._n = r; return r;
  }
  function findByNum(n) {
    var best = null, i, c, o;
    if (!(n >= 1)) return null; // 0 = chaînes sans numéro : jamais une cible
    for (i = 0; i < S.channels.length; i++) {
      c = S.channels[i]; o = numOf(c);
      if (o.n === n) { if (o.e) return c; if (!best) best = c; }
    }
    return best;
  }
  function chByName(a) {
    var i, c = null;
    for (i = 0; i < S.channels.length; i++) if (S.channels[i].name === a) return S.channels[i];
    if (a.length >= 40) for (i = 0; i < S.channels.length; i++) { c = S.channels[i]; if (c.name.slice(0, 40) === a) return c; }
    return null;
  }

  /* ---------- favoris & récents ---------- */
  function isFav(name) { return S.favs.indexOf(name) >= 0; }
  function toggleFav(name) {
    var i = S.favs.indexOf(name), on = i < 0;
    if (on) S.favs.push(name); else S.favs.splice(i, 1);
    store.set('favs', S.favs); paintFavs();
    if (S.view === 'tv' && S.chFilter === 'favs') renderChannels();
    toast(on ? '★ Ajoutée aux favoris : ' + name : 'Retirée des favoris : ' + name);
    pubSoon();
  }
  function pushRecent(name) {
    S.recents = [name].concat(S.recents.filter(function (n) { return n !== name; })).slice(0, 10);
    store.set('recents', S.recents); pubSoon();
  }
  function paintFav(b) {
    var s = b.querySelector('.st'), on = isFav(b._c.name);
    if (on && !s) { s = document.createElement('i'); s.className = 'st'; s.textContent = '★'; b.appendChild(s); }
    else if (!on && s) b.removeChild(s);
  }
  function paintFavs() { [].forEach.call(document.querySelectorAll('#channels .ch'), paintFav); }
  function favKey() {
    var f = $('.focus');
    if (!isFull() && f && f._c) return toggleFav(f._c.name);
    if (S.cur && !S.cur.adhoc) return toggleFav(S.cur.name);
    toast('Aucune chaîne à mettre en favori');
  }

  /* ---------- IPTV ---------- */
  function parseM3U(txt) {
    var out = [], cur = null;
    txt.split(/\r?\n/).forEach(function (l) {
      if (l.indexOf('#EXTINF') === 0) {
        var nm = l.split(',').slice(1).join(',').trim(), lg = /tvg-logo="([^"]*)"/.exec(l), id = /tvg-id="([^"]*)"/.exec(l);
        cur = { name: nm, logo: lg ? lg[1] : '', id: id ? id[1] : '' };
      } else if (cur && l && l[0] !== '#') { cur.url = l.trim(); out.push(cur); cur = null; }
    });
    return out;
  }
  function fmtDate(t) {
    var d = new Date(t); if (!t) return 'jamais';
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' à ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function cacheSave() {
    store.set('chcache', { at: S.chAt, url: S.m3u, list: S.channels.map(function (c) { return { name: c.name, logo: c.logo, id: c.id, url: c.url }; }) });
  }
  // après un rafraîchissement, S.cur / S.prev doivent pointer vers les nouveaux objets (stepChannel compare par identité)
  function rebind(c) {
    var i, l = S.channels;
    if (!c || c.adhoc) return c;
    for (i = 0; i < l.length; i++) if (l[i].name === c.name && l[i].url === c.url) return l[i];
    for (i = 0; i < l.length; i++) if (l[i].name === c.name) return l[i];
    return c;
  }
  // o.quiet : pas de message ; les rappels en attente sont appelés une fois la liste prête
  function loadM3U(cb, o) {
    o = o || {};
    if (cb) S.pendCb.push(cb);
    if (S.loading) { if (!o.quiet) S.loud = true; return; }
    S.loading = true; S.loud = !o.quiet;
    var box = $('#channels'), url = S.m3u;
    if (!S.channels.length) box.textContent = 'Chargement…';
    function finish(ok) {
      S.loading = false;
      var cbs = S.pendCb; S.pendCb = [];
      if (ok) cbs.forEach(function (f) { try { f(); } catch (e) {} });
      else if (cbs.length) S.loud = true; // commande distante en attente : on prévient
    }
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var list = parseM3U(t); if (!list.length) throw new Error('vide');
      S.channels = list; S.chAt = Date.now(); cacheSave();
      S.cur = rebind(S.cur); S.prev = rebind(S.prev);
      renderChannels(); optLabels();
      var cur = $('.focus'), first = document.querySelector('#channels .ch');
      if (S.view === 'tv' && first && (!cur || cur.id === 'search') && document.activeElement !== $('#search')) setFocus(first);
      finish(true);
      if (S.loud) toast('Chaînes mises à jour : ' + fmtDate(S.chAt));
      pubSoon();
    }).catch(function () {
      finish(false);
      if (!S.channels.length) { box.textContent = 'Playlist inaccessible'; if (S.loud) toast('Playlist inaccessible'); }
      else if (S.loud) toast('Actualisation des chaînes impossible');
    });
  }
  function renderChannels() {
    var q = $('#search').value.toLowerCase(), box = $('#channels'), cf = document.querySelector('.focus'), fi = -1, base;
    if (cf && cf.parentNode === box) fi = [].indexOf.call(box.children, cf);
    box.innerHTML = '';
    if (S.chFilter === 'favs') base = S.channels.filter(function (c) { return isFav(c.name); });
    else if (S.chFilter === 'recents') {
      base = [];
      S.recents.forEach(function (n) { var c = chByName(n); if (c && base.indexOf(c) < 0) base.push(c); });
    } else base = S.channels;
    var list = S.shown = base.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; });
    $('#count').textContent = list.length ? list.length + ' chaîne' + (list.length > 1 ? 's' : '') : 'Aucune chaîne';
    if (!list.length && S.channels.length && !q && S.chFilter === 'favs') box.textContent = 'Aucun favori : touche Jaune sur une chaîne pour en ajouter';
    if (!list.length && S.channels.length && !q && S.chFilter === 'recents') box.textContent = 'Aucune chaîne récente';
    list.slice(0, 200).forEach(function (c) {
      var b = document.createElement('button'); b.className = 'f ch'; b._c = c;
      var lg = document.createElement('div'); lg.className = 'logo'; lg.textContent = c.name.replace(/[^A-Za-z0-9+]/g, '').slice(0, 3).toUpperCase();
      if (c.logo) { var im = new Image(); im.onload = function () { lg.textContent = ''; lg.appendChild(im); }; im.src = c.logo; }
      var tx = document.createElement('div'); tx.className = 'tx';
      var n = document.createElement('span'); n.className = 'n'; n.textContent = c.name;
      var p = document.createElement('span'); p.className = 'p';
      tx.appendChild(n); tx.appendChild(p);
      b.appendChild(lg); b.appendChild(tx);
      var no = numOf(c);
      if (no.n) { var nb = document.createElement('i'); nb.className = 'num'; nb.textContent = no.n; b.appendChild(nb); }
      paintFav(b);
      b.onclick = function () { play(c); }; box.appendChild(b);
    });
    if (fi >= 0) setFocus(box.children[Math.min(fi, box.children.length - 1)] || $('#chFilters .f'));
    if (S.view === 'tv') { epgPaint(); loadEpg(epgPaint); }
  }
  function buildChFilters() {
    var bar = $('#tv .bar'), box = document.createElement('div'); box.id = 'chFilters'; box.className = 'row';
    [['all', 'Tout'], ['favs', '★ Favoris'], ['recents', 'Récents']].forEach(function (a) {
      var b = document.createElement('button'); b.className = 'f pill sm' + (a[0] === S.chFilter ? ' sel' : ''); b.textContent = a[1]; b.dataset.f = a[0];
      b.onclick = function () {
        S.chFilter = a[0];
        [].forEach.call(box.children, function (x) { x.classList.toggle('sel', x === b); });
        renderChannels();
      };
      box.appendChild(b);
    });
    bar.insertBefore(box, $('#count'));
  }
  // chargement au démarrage : cache instantané, puis rafraîchissement en arrière-plan si trop vieux
  function startChannels() {
    var cc = store.get('chcache', null);
    if (cc && arr(cc.list).length && cc.url === S.m3u) {
      S.channels = cc.list; S.chAt = cc.at || 0; renderChannels(); optLabels();
      tryResume();
      if (Date.now() - S.chAt > 24 * 3600000) loadM3U(null, { quiet: true });
    } else loadM3U(tryResume, { quiet: true });
  }
  function tryResume() {
    if (!S.doResume) return;
    S.doResume = false;
    if (!S.resume) return;
    var n = store.get('last', ''), c = n && chByName(n);
    if (c) play(c);
  }

  /* ---------- guide des programmes (XMLTV, TNT) ---------- */
  var EPG_URL = 'https://xmltvfr.fr/xmltv/xmltv_tnt.xml.gz';
  var epg = { by: {}, names: {}, ok: false, loading: false, at: 0 };
  function epgKey(s) { return String(s || '').replace(/@.*$/, '').toLowerCase(); }
  function nameKey(s) { return String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9+]/g, ''); }
  function xmlTime(d, z) {
    var t = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(8, 10), +d.slice(10, 12), +d.slice(12, 14));
    return t - (z.charAt(0) === '-' ? -1 : 1) * ((+z.slice(1, 3)) * 60 + (+z.slice(3, 5))) * 60000;
  }
  function unent(x) { return x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }); }
  function loadEpg(cb) {
    if (epg.loading || (epg.ok && Date.now() - epg.at < 6 * 3600000)) return;
    if (!window.DecompressionStream) return;
    epg.loading = true;
    fetch(EPG_URL).then(function (r) { return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text(); }).then(function (x) {
      var by = {}, names = {}, now = Date.now(), m;
      var re = /<programme start="(\d{14}) ([+-]\d{4})" stop="(\d{14}) ([+-]\d{4})" channel="([^"]+)">([\s\S]*?)<\/programme>/g;
      while ((m = re.exec(x))) {
        var st = xmlTime(m[1], m[2]), en = xmlTime(m[3], m[4]);
        if (en <= now || st > now + 43200000) continue;
        var t = /<title[^>]*>([^<]*)<\/title>/.exec(m[6]), k = epgKey(m[5]);
        (by[k] = by[k] || []).push({ s: st, e: en, t: t ? unent(t[1]) : '' });
      }
      for (var k2 in by) by[k2].sort(function (a, b) { return a.s - b.s; });
      var cre = /<channel id="([^"]+)">\s*<display-name[^>]*>([^<]*)</g;
      while ((m = cre.exec(x))) names[nameKey(unent(m[2]))] = epgKey(m[1]);
      epg.by = by; epg.names = names; epg.ok = true; epg.at = Date.now(); epg.loading = false;
      if (cb) cb();
    }).catch(function () { epg.loading = false; });
  }
  function epgFor(c) {
    var l = epg.by[epgKey(c.id)] || epg.by[epg.names[nameKey(c.name)]], now = Date.now(), i;
    if (!l) return null;
    for (i = 0; i < l.length; i++) if (l[i].e > now) return { now: l[i].s <= now ? l[i] : null, next: l[i].s <= now ? l[i + 1] : l[i] };
    return null;
  }
  function hm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function epgPaint() {
    [].forEach.call(document.querySelectorAll('#channels .ch'), function (b) {
      var g = epgFor(b._c), p = b.querySelector('.p');
      p.textContent = g && g.now ? g.now.t : '';
    });
  }
  setInterval(epgPaint, 60000);
  function showOsd() {
    var c = S.cur, o = $('#osd'); if (!c || S.pip) return;
    var g = epgFor(c), h = '<b></b>';
    if (g && g.now) h += '<span class="pg"></span>';
    if (g && g.next) h += '<span class="pg nx"></span>';
    o.innerHTML = h + '<span class="pg nx ql"></span><small>Haut / Bas : chaîne · ◀ : dernière chaîne · Rouge : PiP · Jaune : ★ · Bleu : qualité · Retour : quitter</small>';
    var no = numOf(c);
    o.firstChild.textContent = (no.n ? no.n + ' · ' : '') + c.name + (!c.adhoc && isFav(c.name) ? '  ★' : '');
    var sp = o.querySelectorAll('.pg:not(.ql)');
    if (g && g.now) sp[0].textContent = 'Maintenant · ' + g.now.t + '  (' + hm(g.now.s) + ' – ' + hm(g.now.e) + ')';
    if (g && g.next) sp[sp.length - 1].textContent = 'Ensuite · ' + g.next.t + '  (' + hm(g.next.s) + ')';
    o.querySelector('.ql').textContent = 'Qualité : ' + QLABEL[S.quality];
    clearTimeout(osdT); osdT = setTimeout(function () { o.innerHTML = ''; }, 6000);
  }
  function stepChannel(d) {
    var l = S.shown && S.shown.indexOf(S.cur) >= 0 ? S.shown : S.channels, i = l.indexOf(S.cur);
    if (i >= 0 && l.length) play(l[(i + d + l.length) % l.length]);
  }
  function goLast() {
    if (!S.prev) return toast('Pas de chaîne précédente');
    play(S.prev);
  }
  // saisie d'un numéro de chaîne (clavier numérique de la télécommande)
  var numT;
  function typeDigit(d) {
    if (S.numBuf.length >= 4) S.numBuf = '';
    S.numBuf += d;
    var o = $('#osd'), c = findByNum(+S.numBuf);
    o.innerHTML = '<b></b><span class="pg"></span>';
    o.firstChild.textContent = 'Chaîne ' + S.numBuf + '_';
    o.lastChild.textContent = c ? c.name : '';
    clearTimeout(osdT); clearTimeout(numT);
    numT = setTimeout(commitNum, 1500);
  }
  function commitNum() {
    clearTimeout(numT);
    if (!S.numBuf) return;
    var n = S.numBuf; S.numBuf = '';
    goNum(n);
    if (S.cur && !S.pip) showOsd();
  }
  function goNum(n) {
    var c = findByNum(+n);
    if (c) play(c); else toast('Chaîne ' + (+n) + ' introuvable');
  }

  var hls = null, osdT, vt;
  function fixVideo() {
    var v = $('#video'); clearTimeout(vt);
    if (S.pip) { v.style.width = ''; v.style.height = ''; return; }
    v.style.width = '1919px'; vt = setTimeout(function () { if (!S.pip) v.style.width = '1920px'; }, 60);
  }
  function applyQuality() {
    if (!hls) return;
    try {
      var lv = hls.levels || [], n = lv.length, ord, i;
      if (S.quality === 'auto' || n < 2) { hls.currentLevel = -1; return; }
      ord = []; for (i = 0; i < n; i++) ord.push(i);
      ord.sort(function (a, b) { return ((lv[a].height || 0) - (lv[b].height || 0)) || ((lv[a].bitrate || 0) - (lv[b].bitrate || 0)); });
      hls.currentLevel = S.quality === 'low' ? ord[0] : S.quality === 'high' ? ord[n - 1] : ord[Math.floor((n - 1) / 2)];
    } catch (e) {}
  }
  function setQuality(q) {
    if (QUALITIES.indexOf(q) < 0) return;
    S.quality = q; store.set('quality', q); applyQuality(); optLabels();
    if (isFull()) showOsd(); else toast('Qualité : ' + QLABEL[q]);
  }
  function cycleQuality() { setQuality(QUALITIES[(QUALITIES.indexOf(S.quality) + 1) % QUALITIES.length]); }
  function play(c) {
    var p = $('#player'), v = $('#video'), was = isPlaying();
    if (S.modal) closeDetail();
    S.doResume = false; S.numBuf = '';
    if (S.cur && S.cur !== c) S.prev = S.cur;
    if (!was) { S.pip = false; document.body.classList.remove('pip'); }
    p.hidden = false; taint = false; S.cur = c;
    document.body.classList.toggle('playing', !S.pip);
    hideAmbient();
    if (!c.adhoc) { store.set('last', c.name); pushRecent(c.name); } else pubSoon();
    showOsd(); loadEpg(function () { if (S.cur === c) showOsd(); });
    if (hls) { hls.destroy(); hls = null; }
    v.crossOrigin = 'anonymous';
    void p.offsetWidth; // la TV doit connaître la taille plein écran avant de brancher le flux
    setTimeout(function () {
      if (S.cur !== c) return;
      if (window.Hls && Hls.isSupported() && /\.m3u8/.test(c.url)) {
        hls = new Hls();
        try { hls.on(Hls.Events.MANIFEST_PARSED, applyQuality); } catch (e) {}
        hls.loadSource(c.url); hls.attachMedia(v);
      }
      else { v.src = c.url; }
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    }, 120);
  }
  function stop() {
    var v = $('#video'); if (S.cur) S.prev = S.cur;
    S.cur = null; S.pip = false; S.numBuf = ''; clearTimeout(numT); v.pause(); v.removeAttribute('src');
    if (hls) { hls.destroy(); hls = null; }
    clearTimeout(vt); v.style.width = ''; v.style.height = '';
    $('#player').hidden = true; document.body.classList.remove('playing'); document.body.classList.remove('pip'); $('#osd').innerHTML = '';
    pubSoon();
  }
  $('#video').addEventListener('playing', function () { if (!S.pip) fixVideo(); });

  /* ---------- image dans l'image ---------- */
  function setPip(on) {
    if (!isPlaying()) return;
    S.pip = !!on;
    var b = document.body.classList; b.toggle('pip', S.pip); b.toggle('playing', !S.pip);
    S.numBuf = ''; fixVideo(); $('#osd').innerHTML = '';
    if (S.pip) {
      var cur = $('.focus');
      if (!cur || !visible(cur)) { var f = focusables().filter(function (x) { return !x.classList.contains('tab'); })[0]; if (f) setFocus(f); }
      toast('Image dans l\'image · Rouge : plein écran');
    } else showOsd();
    pubSoon();
  }
  function togglePip() { if (!isPlaying()) return toast('Rien en lecture'); setPip(!S.pip); }

  /* ---------- volume ---------- */
  function audio() { try { return tizen.tvaudiocontrol || null; } catch (e) { return null; } }
  function readMute() { try { var a = audio(); if (a) S.mute = !!a.isMute(); else S.mute = !!$('#video').muted; } catch (e) {} }
  var volT;
  function showVol(lvl) {
    var o = $('#volosd');
    if (!o) {
      o = document.createElement('div'); o.id = 'volosd';
      o.innerHTML = '<svg viewBox="0 0 24 24" width="44" height="44"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="#fff"/><g id="vWave"><path d="M15 9a4 4 0 010 6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M17.5 6.5a8 8 0 010 11" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g><path id="vX" d="M15 9l6 6M21 9l-6 6" fill="none" stroke="#ff5a5a" stroke-width="2.4" stroke-linecap="round"/></svg><div class="vb"><i></i></div><span></span>';
      document.body.appendChild(o);
    }
    o.querySelector('#vWave').style.display = S.mute ? 'none' : '';
    o.querySelector('#vX').style.display = S.mute ? '' : 'none';
    o.querySelector('.vb i').style.width = (S.mute ? 0 : Math.max(0, Math.min(100, lvl || 0))) + '%';
    o.querySelector('span').textContent = S.mute ? 'Muet' : (lvl === null || lvl === undefined ? '' : Math.round(lvl));
    o.hidden = false; clearTimeout(volT); volT = setTimeout(function () { o.hidden = true; }, 2000);
  }
  function volDo(a) {
    var au = audio(), v = $('#video'), lvl = null;
    try {
      if (au) {
        if (a === 'mute') au.setMute(!au.isMute());
        else {
          if (au.isMute()) au.setMute(false);
          if (a === 'up') au.setVolumeUp(); else au.setVolumeDown();
        }
        S.mute = !!au.isMute(); lvl = au.getVolume();
      } else { // navigateur de bureau : on agit sur la vidéo
        if (a === 'mute') v.muted = !v.muted;
        else { v.muted = false; v.volume = Math.max(0, Math.min(1, v.volume + (a === 'up' ? 0.1 : -0.1))); }
        S.mute = v.muted; lvl = v.volume * 100;
      }
    } catch (e) { return toast('Volume indisponible'); }
    showVol(lvl); pubSoon();
  }

  /* ---------- rappels ---------- */
  var alertQ = [], alertEl = null, alertT = null, alertCur = null;
  function remSave() { S.rem.sort(function (a, b) { return a.t - b.t; }); store.set('rem', S.rem); }
  function remAdd(a) {
    var o; try { o = JSON.parse(a); } catch (e) { return; }
    if (!o || typeof o.id !== 'string' || typeof o.t !== 'number' || !isFinite(o.t)) return;
    var id = o.id.slice(0, 40), m = String(o.m || '').slice(0, 120);
    S.rem = S.rem.filter(function (x) { return x.id !== id; });
    if (S.rem.length >= 10) { toast('Trop de rappels (10 maximum)'); pubSoon(); return; }
    S.rem.push({ id: id, t: Math.round(o.t), m: m });
    remSave();
    toast('Rappel à ' + hm(o.t) + ' : ' + m); pubSoon();
  }
  function remDel(id) {
    var n = S.rem.length;
    S.rem = S.rem.filter(function (x) { return x.id !== id; });
    if (S.rem.length !== n) { remSave(); pubSoon(); }
  }
  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var a = new AC(), t = a.currentTime;
      [660, 880, 660].forEach(function (f, i) {
        var o = a.createOscillator(), g = a.createGain(), s = t + i * 0.28;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.25, s + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25);
        o.connect(g); g.connect(a.destination); o.start(s); o.stop(s + 0.26);
      });
      setTimeout(function () { try { a.close(); } catch (e) {} }, 1500);
    } catch (e) {}
  }
  function showAlert(r) {
    if (!alertEl) {
      alertEl = document.createElement('div'); alertEl.id = 'alert'; alertEl.hidden = true;
      alertEl.innerHTML = '<div class="abox"><div class="at"></div><div class="ah">OK pour fermer</div></div>';
      document.body.appendChild(alertEl);
    }
    touch(); alertCur = r;
    alertEl.querySelector('.at').textContent = '🔔 ' + r.m;
    alertEl.hidden = false; beep();
    clearTimeout(alertT); alertT = setTimeout(dismissAlert, 12000);
    try { fetch(REMOTE_BASE + topic(), { method: 'POST', body: 'alert:' + JSON.stringify({ id: r.id, m: r.m }) }); } catch (e) {}
    try { fetch('https://ntfy.sh/' + topic() + '-push', { method: 'POST', headers: { 'Title': 'MyTV', 'Priority': 'high' }, body: r.m }); } catch (e) {}
  }
  function alertShown() { return !!alertEl && !alertEl.hidden; }
  function dismissAlert() {
    clearTimeout(alertT);
    if (alertEl) alertEl.hidden = true;
    alertCur = null;
    if (alertQ.length) showAlert(alertQ.shift());
  }
  function checkReminders() {
    var now = Date.now(), due = S.rem.filter(function (r) { return r.t <= now; });
    if (due.length) {
      S.rem = S.rem.filter(function (r) { return r.t > now; }); remSave();
      due.forEach(function (r) { if (now - r.t <= 6 * 3600000) alertQ.push(r); }); // plus de 6 h de retard : oublié
      pubSoon();
    }
    if (!alertShown() && alertQ.length) showAlert(alertQ.shift());
  }

  /* ---------- veille d'ambiance ---------- */
  function touch() {
    lastAct = Date.now();
    if (ambOn) { hideAmbient(); return true; }
    return false;
  }
  function showAmbient() {
    var a = $('#ambient');
    if (!a) {
      a = document.createElement('div'); a.id = 'ambient'; a.hidden = true;
      a.innerHTML = '<div class="amb"><div id="amClock"></div><div id="amDate"></div></div>';
      document.body.appendChild(a);
    }
    ambOn = true; a.hidden = false; document.body.classList.add('ambient'); tick();
  }
  function hideAmbient() {
    lastAct = Date.now();
    if (!ambOn) return;
    ambOn = false; var a = $('#ambient'); if (a) a.hidden = true;
    document.body.classList.remove('ambient');
  }
  setInterval(function () {
    if (S.ambient > 0 && !ambOn && !isPlaying() && !alertShown() && !S.modal && Date.now() - lastAct >= S.ambient * 60000) showAmbient();
  }, 10000);

  /* ---------- ouvrir un lien ---------- */
  function openUrl(link) {
    link = String(link || '').trim();
    if (!link) return;
    if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(link)) link = 'https://' + link;
    var sc = /^([a-z][a-z0-9+.\-]*):\/\//i.exec(link)[1].toLowerCase();
    var rest = link.replace(/^[a-z][a-z0-9+.\-]*:\/\//i, ''), host = rest.split(/[\/?#]/)[0].toLowerCase().replace(/^.*@/, '').replace(/:\d+$/, '');
    var path = rest.slice(rest.split(/[\/?#]/)[0].length).split(/[?#]/)[0];
    if (sc !== 'http' && sc !== 'https') return toast('Lien non pris en charge : ' + (host || sc));
    if (/\.(m3u8|mp4|mkv|webm|ts)$/i.test(path)) { play({ name: 'Lien', url: link, logo: '', id: '', adhoc: true }); return; }
    if (/^(www\.|m\.|music\.)?youtube\.com$/.test(host) || host === 'youtu.be') return openYoutube(link, host, path);
    toast('Lien non pris en charge : ' + host);
  }
  function openYoutube(link, host, path) {
    var id = '', m;
    if (host === 'youtu.be') m = /^\/([\w\-]{11})/.exec(path);
    else m = /^\/(?:shorts|embed|live|v)\/([\w\-]{11})/.exec(path) || /[?&]v=([\w\-]{11})/.exec(link);
    if (m) id = m[1];
    var appId = appIds['YouTube'] || FAV_APPS[0].ids[0];
    function fallback() { launch(appId); toast('Lien YouTube : ouvre la vidéo manuellement'); }
    if (!id) return fallback();
    // Lien profond YouTube TV : MEILLEUR EFFORT, NON VÉRIFIÉ sur une vraie TV (le format du PAYLOAD peut varier selon la version de l'app) ;
    // en cas d'échec on lance simplement l'application.
    try {
      var ctl = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view', null, null, null,
        [new tizen.ApplicationControlData('PAYLOAD', ['{"values":{"msgId":"watch","videoId":"' + id + '"}}'])]);
      tizen.application.launchAppControl(ctl, appId, function () { toast('YouTube : ouverture de la vidéo…'); }, function () { fallback(); });
    } catch (e) { fallback(); }
  }

  /* ---------- streaming (TMDB) ---------- */
  var TMDB = 'https://api.themoviedb.org/3', TIMG = 'https://image.tmdb.org/t/p/';
  var PROVS = [['Tous', 0], ['Netflix', 8], ['Prime Video', 119], ['Disney+', 337], ['Apple TV+', 350], ['Canal+', 381], ['Paramount+', 531], ['Max', 1899]];
  // noms de fournisseurs TMDB -> nos applications
  var PROV_APP = { 'netflix': 'Netflix', 'disney plus': 'Disney+', 'disney+': 'Disney+', 'amazon prime video': 'Prime Video', 'prime video': 'Prime Video',
                   'apple tv plus': 'Apple TV', 'apple tv+': 'Apple TV', 'apple tv': 'Apple TV', 'canal+': 'Canal+', 'canal+ séries': 'Canal+', 'canal+ series': 'Canal+',
                   'mytf1': 'TF1+', 'tf1+': 'TF1+' };
  var ST = { type: 'movie', list: 'trending', prov: 0, q: '', page: 0, pages: 1, items: [], cards: [], seen: {}, busy: false, gen: 0, center: 0, tm: 0, dgen: 0, from: null };
  function tmdbKey() { return String(store.get('tmdb', '') || ''); }
  function qs(o) { var a = [], k; for (k in o) if (o.hasOwnProperty(k)) a.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); return a.join('&'); }
  function tmdbGet(path, params, cb) {
    var key = tmdbKey(), p = { language: 'fr-FR' }, h = {}, k;
    for (k in params) if (params.hasOwnProperty(k)) p[k] = params[k];
    if (/^eyJ/.test(key)) h['Authorization'] = 'Bearer ' + key; else p.api_key = key;
    fetch(TMDB + path + '?' + qs(p), { headers: h }).then(function (r) {
      if (!r.ok) { var e = new Error('http'); e.status = r.status; throw e; }
      return r.json();
    }).then(function (j) { cb(null, j); }, function (e) {
      cb(e && e.status === 401 ? 'Clé TMDB invalide' : e && e.status ? 'Erreur TMDB (' + e.status + ')' : 'TMDB inaccessible : vérifie la connexion');
    });
  }
  function sMsg(t) { var m = $('#sMsg'); if (m) m.textContent = t || ''; }
  function streamReq(page) {
    var p = { page: page };
    if (ST.q) { p.query = ST.q; p.include_adult = 'false'; return ['/search/multi', p]; }
    if (ST.list === 'trending' && !ST.prov) return ['/trending/' + ST.type + '/week', p];
    p.sort_by = ST.list === 'top' ? 'vote_average.desc' : 'popularity.desc';
    p['vote_count.gte'] = 300;
    if (ST.prov) { p.with_watch_providers = ST.prov; p.watch_region = 'FR'; p.with_watch_monetization_types = 'flatrate'; }
    return ['/discover/' + ST.type, p];
  }
  function streamLoad(reset) {
    if (!tmdbKey()) return;
    if (reset) { ST.gen++; ST.page = 0; ST.pages = 1; ST.items = []; ST.cards = []; ST.seen = {}; ST.busy = false; ST.center = 0; $('#sgrid').innerHTML = ''; $('#sgrid').scrollTop = 0; }
    if (ST.busy || ST.page >= ST.pages || ST.page >= 25) return;
    ST.busy = true;
    var gen = ST.gen, page = ST.page + 1, rq = streamReq(page);
    if (!ST.items.length) sMsg('Chargement…');
    tmdbGet(rq[0], rq[1], function (err, j) {
      if (gen !== ST.gen) return;
      ST.busy = false;
      if (err) return sMsg(err);
      ST.page = page; ST.pages = Math.min(j.total_pages || 1, 25);
      var grid = $('#sgrid');
      arr(j.results).forEach(function (r) {
        var type = r.media_type || ST.type, key = type + r.id;
        if ((type !== 'movie' && type !== 'tv') || ST.seen[key]) return;
        ST.seen[key] = 1;
        var it = { id: r.id, type: type, title: r.title || r.name || '', year: String(r.release_date || r.first_air_date || '').slice(0, 4),
                   poster: r.poster_path || '', backdrop: r.backdrop_path || '', vote: r.vote_average || 0, overview: r.overview || '' };
        ST.items.push(it);
        var b = posterCard(it, ST.cards.length); ST.cards.push(b); grid.appendChild(b);
      });
      sMsg(ST.items.length ? '' : 'Aucun résultat');
      paintPosters();
      if (ST.cards.length && ST.center >= ST.cards.length - 12) streamLoad(false);
    });
  }
  function okPath(p) { return /^\/[\w.\-]+$/.test(p || '') ? p : ''; }
  function posterCard(it, i) {
    var b = document.createElement('button'); b.className = 'f poster'; b._it = it; b._i = i;
    var pi = document.createElement('div'); pi.className = 'pi';
    var ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = it.title.charAt(0).toUpperCase(); pi.appendChild(ph);
    if (it.vote > 0) { var rt = document.createElement('i'); rt.className = 'rt'; rt.textContent = '★ ' + it.vote.toFixed(1); pi.appendChild(rt); }
    var t = document.createElement('span'); t.className = 'pt'; t.textContent = it.title;
    b.appendChild(pi); b.appendChild(t);
    b.onclick = function () { openDetail(it, b); };
    return b;
  }
  // seules les affiches proches du focus gardent leur image en mémoire (la TV est limitée)
  function paintPosters() {
    var c = ST.center, i, b, want, pi;
    for (i = 0; i < ST.cards.length; i++) {
      b = ST.cards[i]; want = i >= c - 12 && i <= c + 30;
      if (want && !b._img) {
        var p = okPath(b._it.poster); if (!p) { b._img = 0; continue; }
        pi = b.firstChild; b._img = new Image(); b._img.alt = ''; b._img.src = TIMG + 'w342' + p; pi.insertBefore(b._img, pi.firstChild.nextSibling);
      } else if (!want && b._img) { if (b._img.parentNode) b._img.parentNode.removeChild(b._img); b._img = null; }
    }
  }
  function streamFocus(el) {
    ST.center = el._i; paintPosters();
    if (el._i >= ST.cards.length - 12) streamLoad(false);
  }
  function streamSync() {
    var k = !!tmdbKey();
    $('#sNoKey').hidden = k; $('#sTool').hidden = !k; $('#sMsg').hidden = !k; $('#sgrid').hidden = !k;
    if (k && !ST.items.length && !ST.busy) streamLoad(true);
  }
  function streamSel() {
    [].forEach.call(document.querySelectorAll('#sTool .pill[data-k]'), function (b) { b.classList.toggle('sel', String(ST[b.dataset.k]) === b.dataset.v); });
  }
  function applySearch() {
    var q = $('#streamSearch').value.trim();
    if (q === ST.q && ST.gen > 0) return;
    ST.q = q; streamLoad(true);
  }
  function buildStream() {
    var sec = document.createElement('section'); sec.id = 'stream'; sec.className = 'view'; sec.hidden = true; $('main').appendChild(sec);
    var nk = document.createElement('div'); nk.id = 'sNoKey'; nk.className = 'card'; nk.hidden = true;
    nk.innerHTML = '<h3>Streaming</h3><p class="big"></p><p class="mut"></p>';
    nk.querySelector('.big').textContent = 'Ajoute ta clé TMDB depuis ta télécommande : Outils > Streaming';
    nk.querySelector('.mut').textContent = 'Crée un compte gratuit sur themoviedb.org, puis Réglages > API pour obtenir ta clé. Colle-la dans l\'appli sur ton téléphone : le catalogue (films et séries, avec leurs plateformes en France) apparaît ici.';
    var tool = document.createElement('div'); tool.id = 'sTool';
    var r1 = document.createElement('div'); r1.className = 'row'; var r2 = document.createElement('div'); r2.className = 'row';
    function pill(row, label, k, v) {
      var b = document.createElement('button'); b.className = 'f pill sm'; b.textContent = label; b.dataset.k = k; b.dataset.v = String(v);
      b.onclick = function () { ST[k] = v; ST.q = ''; var si = $('#streamSearch'); if (si) si.value = ''; streamSel(); streamLoad(true); };
      row.appendChild(b);
    }
    function sep(row) { var s = document.createElement('div'); s.className = 'sep'; row.appendChild(s); }
    pill(r1, 'Films', 'type', 'movie'); pill(r1, 'Séries', 'type', 'tv'); sep(r1);
    pill(r1, 'Tendances', 'list', 'trending'); pill(r1, 'Populaires', 'list', 'popular'); pill(r1, 'Mieux notés', 'list', 'top'); sep(r1);
    var inp = document.createElement('input'); inp.id = 'streamSearch'; inp.className = 'f'; inp.placeholder = 'Rechercher…'; r1.appendChild(inp);
    PROVS.forEach(function (p) { pill(r2, p[0], 'prov', p[1]); });
    tool.appendChild(r1); tool.appendChild(r2);
    var msg = document.createElement('div'); msg.id = 'sMsg';
    var grid = document.createElement('div'); grid.id = 'sgrid';
    sec.appendChild(nk); sec.appendChild(tool); sec.appendChild(msg); sec.appendChild(grid);
    inp.addEventListener('input', function () { clearTimeout(ST.tm); ST.tm = setTimeout(applySearch, 400); });
    streamSel();
    // onglet de navigation
    var tabs = $('#tabs'), t = document.createElement('button'); t.className = 'f tab'; t.dataset.view = 'stream'; t.innerHTML = 'Streaming<i></i>';
    tabs.insertBefore(t, tabs.querySelector('[data-view="settings"]'));
    // fiche détail
    var d = document.createElement('div'); d.id = 'detail'; d.hidden = true;
    d.innerHTML = '<div class="dbg"></div><div class="dsh"></div><div class="dbox"><div class="dpo"></div><div class="dtx"><h1 id="dTitle"></h1><div id="dMeta"></div><div id="dGen"></div><p id="dSyn"></p><div id="dNote"></div><div id="dBtns" class="row wrap"></div></div></div>';
    document.body.appendChild(d);
  }
  function detailBtns(apps) {
    var box = $('#dBtns'); box.innerHTML = '';
    apps.forEach(function (n) {
      var b = document.createElement('button'); b.className = 'f pill'; b.textContent = 'Ouvrir ' + n;
      var f = FAV_APPS.filter(function (x) { return x.name === n; })[0];
      b.onclick = function () { launch(appIds[n] || (f && f.ids[0])); };
      box.appendChild(b);
    });
    var c = document.createElement('button'); c.className = 'f pill'; c.textContent = 'Fermer'; c.onclick = closeDetail; box.appendChild(c);
    setFocus(box.firstChild);
  }
  function openDetail(it, from) {
    var d = $('#detail'), gen = ++ST.dgen, bd = okPath(it.backdrop), po = okPath(it.poster);
    S.modal = true; ST.from = from; d.hidden = false;
    d.querySelector('.dbg').style.backgroundImage = bd ? 'url(' + TIMG + 'w780' + bd + ')' : 'none';
    d.querySelector('.dpo').style.backgroundImage = po ? 'url(' + TIMG + 'w342' + po + ')' : 'none';
    $('#dTitle').textContent = it.title;
    $('#dMeta').textContent = [it.year, it.vote > 0 ? '★ ' + it.vote.toFixed(1) : ''].filter(Boolean).join(' · ');
    $('#dGen').textContent = ''; $('#dSyn').textContent = it.overview || '';
    $('#dNote').textContent = 'Chargement…';
    detailBtns([]);
    tmdbGet('/' + it.type + '/' + it.id, { append_to_response: 'watch/providers' }, function (err, j) {
      if (gen !== ST.dgen || !S.modal) return;
      if (err) { $('#dNote').textContent = err; return; }
      var meta = [it.year, it.vote > 0 ? '★ ' + it.vote.toFixed(1) : ''];
      if (it.type === 'movie' && j.runtime) meta.push(Math.floor(j.runtime / 60) + ' h ' + ('0' + (j.runtime % 60)).slice(-2));
      if (it.type === 'tv' && j.number_of_seasons) meta.push(j.number_of_seasons + ' saison' + (j.number_of_seasons > 1 ? 's' : ''));
      $('#dMeta').textContent = meta.filter(Boolean).join(' · ');
      $('#dGen').textContent = arr(j.genres).map(function (g) { return g.name; }).join(' · ');
      if (j.overview) $('#dSyn').textContent = j.overview;
      var fr = j['watch/providers'] && j['watch/providers'].results && j['watch/providers'].results.FR, flat = arr(fr && fr.flatrate), apps = [], others = [];
      flat.forEach(function (p) {
        var a = PROV_APP[String(p.provider_name || '').toLowerCase()];
        if (a) { if (apps.indexOf(a) < 0) apps.push(a); } else if (others.length < 4) others.push(p.provider_name);
      });
      $('#dNote').textContent = apps.length ? 'Disponible en France (abonnement)' : 'Pas disponible sur tes apps en France' + (others.length ? ' · aussi sur : ' + others.join(', ') : '');
      detailBtns(apps);
    });
  }
  function closeDetail() {
    if (!S.modal) return;
    S.modal = false; ST.dgen++; $('#detail').hidden = true;
    var f = ST.from; ST.from = null;
    if (f && document.body.contains(f) && visible(f)) setFocus(f); else { var x = focusables().filter(function (e) { return !e.classList.contains('tab'); })[0]; if (x) setFocus(x); }
  }
  function setTmdb(a) {
    a = String(a || '').trim();
    if (a && !(/^[0-9a-f]{32}$/i.test(a) || /^eyJ[\w.\-]+$/.test(a))) return toast('Clé TMDB invalide');
    store.set('tmdb', a); ST.gen++; ST.items = []; ST.cards = []; ST.seen = {}; ST.page = 0; ST.pages = 1; ST.busy = false;
    $('#sgrid').innerHTML = ''; sMsg('');
    toast(a ? 'Clé TMDB enregistrée' : 'Clé TMDB supprimée');
    streamSync(); pubSoon();
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
  function focusables() { return [].filter.call((S.modal ? $('#detail') : document).querySelectorAll('.f'), visible); }
  function setFocus(el) {
    [].forEach.call(document.querySelectorAll('.focus'), function (e) { e.classList.remove('focus'); });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!el) return;
    el.classList.add('focus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (el.classList.contains('poster')) streamFocus(el);
  }
  function move(dir) {
    var cur = $('.focus'), all = focusables(); if (!cur || all.indexOf(cur) < 0) return setFocus(all[0]);
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
  function digitOf(k) { return k >= 48 && k <= 57 ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1; }
  // renvoie true si la touche a été traitée
  function onKey(k) {
    var inp = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (alertShown()) { if (k === 13 || k === 10009 || k === 8) dismissAlert(); return true; }
    if (S.modal && (k === 10009 || k === 8)) { closeDetail(); return true; }
    if (!S.modal) {
      if (k === 403) { togglePip(); return true; }
      if (k === 405) { favKey(); return true; }
      if (k === 406) { cycleQuality(); return true; }
    }
    if (k === 10190) { goLast(); return true; }
    if (isFull()) {
      if (k === 10009 || k === 8) { stop(); return true; }
      if (k === 38) { stepChannel(1); return true; }
      if (k === 40) { stepChannel(-1); return true; }
      if (k === 37) { goLast(); return true; }
      if (digitOf(k) >= 0) { typeDigit(digitOf(k)); return true; }
      if (k === 13) { if (S.numBuf) commitNum(); else showOsd(); return true; }
      return false;
    }
    if (k === 37) { if (!inp) move('l'); } else if (k === 39) { if (!inp) move('r'); }
    else if (k === 38) move('u'); else if (k === 40) move('d');
    else if (k === 13) { var c = $('.focus'); if (c && c.tagName === 'INPUT') c.focus(); else if (c) c.click(); }
    else if (k === 10009) { if (inp) document.activeElement.blur(); else if (S.view !== 'home') show('home'); }
    else return false;
    return true;
  }
  document.addEventListener('keydown', function (e) {
    if (touch()) { if (e.keyCode !== 447 && e.keyCode !== 448 && e.keyCode !== 449) e.preventDefault(); return; } // la touche qui réveille est consommée
    if (onKey(e.keyCode)) e.preventDefault();
  });
  $('#search').addEventListener('input', renderChannels);

  function show(v) {
    if (S.modal) closeDetail();
    S.view = v;
    [].forEach.call(document.querySelectorAll('.view'), function (s) { s.hidden = s.id !== v; });
    [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.dataset.view === v); });
    document.body.classList.toggle('vstream', v === 'stream');
    if (v === 'tv' && !S.channels.length) loadM3U();
    else if (v === 'tv') renderChannels();
    if (v === 'stream') streamSync();
    setFocus(null);
    setTimeout(function () {
      var f = focusables(), ch = v === 'tv' ? document.querySelector('#channels .ch') : v === 'stream' ? document.querySelector('#stream .poster') : null;
      setFocus(ch || f.filter(function (x) { return !x.classList.contains('tab'); })[0] || f[0]);
    }, 50);
  }

  /* ---------- paramètres TV ---------- */
  function optLabels() {
    var a = $('#optAmb'); if (!a) return;
    a.textContent = 'Veille : ' + (S.ambient ? S.ambient + ' min' : 'non');
    $('#optRes').textContent = 'Reprise auto : ' + (S.resume ? 'oui' : 'non');
    $('#optQ').textContent = 'Qualité : ' + QLABEL[S.quality];
    $('#optRefMsg').textContent = 'Dernière mise à jour des chaînes : ' + fmtDate(S.chAt);
  }
  function setAmbient(m) { if (AMBIENTS.indexOf(m) < 0) return; S.ambient = m; store.set('ambient', m); lastAct = Date.now(); optLabels(); pubSoon(); }
  function setResume(r) { S.resume = r ? 1 : 0; store.set('resume', S.resume); optLabels(); pubSoon(); }
  function buildOptions() {
    var card = document.createElement('div'); card.className = 'card c3'; card.id = 'optCard';
    card.innerHTML = '<h3>Options</h3><div class="row wrap"><button class="f pill" id="optAmb"></button><button class="f pill" id="optRes"></button><button class="f pill" id="optQ"></button><button class="f pill" id="optRef">Actualiser les chaînes</button></div><span id="optRefMsg"></span>';
    $('#settings').appendChild(card);
    $('#optAmb').onclick = function () { setAmbient(AMBIENTS[(AMBIENTS.indexOf(S.ambient) + 1) % AMBIENTS.length]); };
    $('#optRes').onclick = function () { setResume(!S.resume); };
    $('#optQ').onclick = cycleQuality;
    $('#optRef').onclick = function () { toast('Actualisation des chaînes…'); loadM3U(null, {}); };
    optLabels();
  }
  function regKeys() {
    var names = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'PreviousChannel'];
    names.forEach(function (n) { try { tizen.tvinputdevice.registerKey(n); } catch (e) {} });
  }

  /* ---------- télécommande téléphone (relais ntfy.sh) ---------- */
  var RELAY = ''; // URL du relais perso (Cloudflare Worker, voir relay/) ; vide = ntfy.sh
  var REMOTE_BASE = RELAY || 'https://ntfy.sh/', REMOTE_PAGE = 'https://brolegacy.github.io/mytv/remote.html';
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
  function cut(s) { return String(s || '').slice(0, 40); }
  function bytes(s) { try { return unescape(encodeURIComponent(s)).length; } catch (e) { return s.length; } }
  function stateJson() {
    readMute();
    var o = { v: VERSION, theme: S.theme, glow: S.glow, inten: S.inten,
      favs: S.favs.slice(0, 24).map(cut), recents: S.recents.slice(0, 8).map(cut), now: S.cur ? cut(S.cur.name) : '', q: S.quality,
      opt: { ambient: S.ambient, resume: S.resume }, rem: S.rem.slice(0, 10).map(function (r) { return { id: r.id, t: r.t, m: r.m }; }),
      tmdb: !!tmdbKey(), pip: !!(isPlaying() && S.pip), mute: !!S.mute, ch: S.chAt || 0 };
    var s = JSON.stringify(o);
    while (bytes(s) > 3400 && (o.recents.length || o.favs.length || o.rem.length)) {
      if (o.recents.length) o.recents.pop(); else if (o.favs.length) o.favs.pop(); else o.rem.pop();
      s = JSON.stringify(o);
    }
    return s;
  }
  function publishState() {
    try { fetch(REMOTE_BASE + topic(), { method: 'POST', body: 'state:' + stateJson() }); } catch (e) {}
  }
  var pubT;
  function pubSoon() { clearTimeout(pubT); pubT = setTimeout(publishState, 250); }
  function remoteCmd(m) {
    if (m.indexOf('state:') === 0 || m.indexOf('alert:') === 0) return;
    if (m === 'ping') return publishState();
    var woke = touch();
    if (!(woke && m.indexOf('key:') === 0)) remoteDo(m); // la commande-touche qui réveille la veille est consommée
    pubSoon();
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
      var go = function () { var ch = chByName(a); if (ch) play(ch); else toast('Chaîne introuvable'); };
      if (S.channels.length) go(); else loadM3U(go);
    } else if (c === 'stop') stop();
    else if (c === 'ch') { if (a === 'last') goLast(); else stepChannel(a === 'prev' ? -1 : 1); }
    else if (c === 'reload') location.reload();
    else if (c === 'home') { closeDetail(); stop(); show('home'); }
    else if (c === 'num') { if (/^\d{1,4}$/.test(a)) { if (S.channels.length) goNum(a); else loadM3U(function () { goNum(a); }); } }
    else if (c === 'vol') { if (a === 'up' || a === 'down' || a === 'mute') volDo(a); }
    else if (c === 'type') typeText(a);
    else if (c === 'typego') typeGo();
    else if (c === 'fav') { var fc = chByName(a); toggleFav(fc ? fc.name : a); }
    else if (c === 'pip') togglePip();
    else if (c === 'quality') setQuality(a);
    else if (c === 'url') openUrl(a);
    else if (c === 'remind') remAdd(a);
    else if (c === 'remind-del') remDel(a);
    else if (c === 'tmdb') setTmdb(a);
    else if (c === 'opt') {
      var j = a.indexOf('='), on = j < 0 ? a : a.slice(0, j), ov = j < 0 ? '' : a.slice(j + 1);
      if (on === 'ambient') setAmbient(+ov); else if (on === 'resume') setResume(ov === '1');
    }
    else if (c === 'refresh') { toast('Actualisation des chaînes…'); loadM3U(null, {}); }
  }
  // champ de texte cible des commandes type: / typego
  function textTarget() {
    if (S.modal) return null;
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT') return a;
    var f = $('.focus');
    if (f && f.tagName === 'INPUT') return f;
    if (S.view === 'tv') return $('#search');
    if (S.view === 'stream' && tmdbKey()) return $('#streamSearch');
    return null;
  }
  function typeText(t) {
    var el = textTarget();
    if (!el) return toast('Aucun champ de texte');
    el.value = String(t).slice(0, 200);
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function typeGo() {
    var el = textTarget();
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (el && el.id === 'streamSearch') { clearTimeout(ST.tm); applySearch(); }
  }
  setInterval(function () { if (remote.es) publishState(); }, 30000);
  // ntfy envoie un keepalive ~toutes les 55 s : sans rien reçu depuis 2 min, la connexion est morte en silence
  setInterval(function () { if (remote.es && Date.now() - (remote.beat || 0) > 120000) remoteConnect(); }, 20000);
  function remoteStatus(t) { if (remote.st) remote.st.textContent = t; }
  function remoteConnect() {
    if (remote.es) { remote.es.close(); remote.es = null; }
    var msgIn = function (j) {
      remote.beat = Date.now();
      try {
        if (j.event && j.event !== 'message') return;
        if (j.id && j.id === remote.lastId) return;
        remote.lastId = j.id; remoteCmd(String(j.message || ''));
      } catch (e) {}
    };
    if (RELAY) { // relais perso : WebSocket (ping texte toutes les 25 s, le relais répond pong)
      if (!window.WebSocket) return remoteStatus('Télécommande indisponible sur cette TV');
      var ws = new WebSocket(RELAY.replace(/^http/, 'ws') + topic() + '/ws?since=0'), pt;
      remote.es = { close: function () { clearInterval(pt); ws.onclose = null; try { ws.close(); } catch (e) {} } };
      remote.beat = Date.now();
      ws.onopen = function () { remote.beat = Date.now(); remoteStatus('Télécommande connectée'); publishState(); pt = setInterval(function () { try { ws.send('ping'); } catch (e) {} }, 25000); };
      ws.onclose = function () { clearInterval(pt); remoteStatus('Télécommande : reconnexion…'); if (remote.es && remote.es.close) setTimeout(remoteConnect, 3000); };
      ws.onmessage = function (ev) { remote.beat = Date.now(); if (ev.data === 'pong') return; try { msgIn(JSON.parse(ev.data)); } catch (e) {} };
      return;
    }
    if (!window.EventSource) return remoteStatus('Télécommande indisponible sur cette TV');
    var es = remote.es = new EventSource(REMOTE_BASE + topic() + '/sse');
    remote.beat = Date.now();
    es.onopen = function () { remote.beat = Date.now(); remoteStatus('Télécommande connectée'); publishState(); };
    es.onerror = function () { remoteStatus('Télécommande : reconnexion…'); if (es.readyState === 2) setTimeout(remoteConnect, 3000); };
    es.addEventListener('keepalive', function () { remote.beat = Date.now(); });
    es.addEventListener('open', function () { remote.beat = Date.now(); });
    es.onmessage = function (ev) {
      remote.beat = Date.now();
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
  try { if (!sessionStorage.getItem('mytv.booted')) { sessionStorage.setItem('mytv.booted', '1'); S.doResume = true; } } catch (e) {}
  buildStream(); buildChFilters(); buildOptions();
  [].forEach.call(document.querySelectorAll('.tab'), function (t) { t.onclick = function () { show(t.dataset.view); }; });
  $('#glowMode').onclick = function () { S.glow = GLOW_MODES[(GLOW_MODES.indexOf(S.glow) + 1) % GLOW_MODES.length]; store.set('glow', S.glow); glowLabels(); };
  $('#glowInt').onclick = function () { S.inten = (S.inten + 1) % 3; store.set('inten', S.inten); glowLabels(); };
  $('#m3u').value = S.m3u;
  $('#m3uSave').onclick = function () { S.m3u = $('#m3u').value; store.set('m3u', S.m3u); S.channels = []; S.chAt = 0; show('tv'); };
  $('#upd').onclick = function () { checkUpdate(true); };
  tick(); regKeys(); readMute();
  applyTheme(); buildThemes(); glowLabels(); buildApps(); buildRemote(); show('home'); checkUpdate(false);
  startChannels();
  setInterval(checkReminders, 5000); setTimeout(checkReminders, 3000);
})();
