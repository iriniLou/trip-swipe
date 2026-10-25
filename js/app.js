(function () {
  'use strict';

  // ——— Справочники ———
  var CATS = {
    sight:  { n: 'Места', e: '🏛️', c: '#ff7a59' },
    nature: { n: 'Природа и виды', e: '🌿', c: '#22b07d' },
    museum: { n: 'Музеи', e: '🖼️', c: '#7b4dff' },
    fun:    { n: 'Развлечения', e: '🎢', c: '#ff9f1c' },
    street: { n: 'Уличная еда', e: '🥢', c: '#ef476f' },
    food:   { n: 'Рестораны', e: '🍜', c: '#e85d04' },
    coffee: { n: 'Кофе и десерты', e: '☕', c: '#a0522d' },
    bar:    { n: 'Бары', e: '🍸', c: '#c71f66' },
    club:   { n: 'Клубы', e: '🪩', c: '#5b2bd6' },
    shop:   { n: 'Шопинг', e: '🛍️', c: '#0096c7' },
    kpop:   { n: 'K-pop', e: '💜', c: '#9d4edd' },
    beauty: { n: 'Красота и спа', e: '💆', c: '#f72585' }
  };
  var AVATARS = [
    ['🐺', 'Wolf Chan'], ['🐰', 'Leebit'], ['🐷', 'Dwaekki'], ['🦦', 'Jiniret'],
    ['🐹', 'Han Quokka'], ['🐥', 'BbokAri'], ['🐶', 'PuppyM'], ['🦊', 'FoxI.Ny']
  ];
  var PRICE = ['бесплатно', '$', '$$', '$$$', '$$$$'];
  var CITY = {};
  TRIP.cities.forEach(function (c) { CITY[c.id] = c; });
  var DAY = {};
  TRIP.days.forEach(function (d) { DAY[d.id] = d; });

  // ——— Утилиты ———
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function now() { return Date.now(); }
  function uid() { return now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmtTime(ts) { return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, rnd) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var x = arr[i]; arr[i] = arr[j]; arr[j] = x; } return arr; }
  function copy(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text).then(function () { toast('Скопировано'); }, fallback);
    fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Скопировано'); } catch (e) {} ta.remove(); }
  }

  // ——— Код комнаты ———
  var ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function newCode() {
    var a = crypto.getRandomValues(new Uint8Array(8)), s = '';
    for (var i = 0; i < 8; i++) s += ALPH[a[i] % ALPH.length];
    return s.slice(0, 4) + '-' + s.slice(4);
  }
  function normCode(c) {
    c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c;
  }

  // ——— Состояние комнаты ———
  // m: участницы, v: голоса "имя|место" → [голос, время], n: заметки, p: план, c: свои места, f: выбор рейса
  function emptyState() { return { m: {}, v: {}, n: {}, p: {}, c: {}, f: {} }; }
  var S = {
    code: null, me: null, state: emptyState(), room: null,
    view: 'swipe', city: 'sg', cat: 'all', deck: [], deckKey: '', undo: [],
    listCity: 'sg', listMode: 'match', mapCity: 'sg', mapMode: 'all', more: 'notes',
    photos: lsGet('ts_photos2', {}), status: { open: 0, total: 6 }
  };

  function tsOf(x) { return Array.isArray(x) ? x[1] : (x && x.ts) || 0; }
  function mergeInto(dst, src) {
    var changed = false;
    Object.keys(emptyState()).forEach(function (sec) {
      var a = dst[sec] || (dst[sec] = {}), b = (src && src[sec]) || {};
      Object.keys(b).forEach(function (k) {
        var tb = tsOf(b[k]), ta = tsOf(a[k]);
        if (!(k in a) || tb > ta || (tb === ta && JSON.stringify(b[k]) > JSON.stringify(a[k]))) {
          if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { a[k] = b[k]; changed = true; }
        }
      });
    });
    return changed;
  }
  function save() {
    lsSet('ts_state_' + S.code, S.state);
    if (S.room) S.room.publish(function () { return S.state; });
  }
  function change(fn) { fn(S.state); rebuildPlaces(); save(); render(); }

  // ——— Места ———
  var PLACE = {}, ALL = [];
  function cityFor(lat, lng) {
    if (lat < 10) return 'sg';
    if (lat < 32) return 'cn';
    var d = Math.hypot(lat - 37.55, (lng - 126.99) * 0.79);
    return d < 0.25 ? 'seoul' : 'korea';
  }
  function rebuildPlaces() {
    ALL = PLACES.slice();
    Object.keys(S.state.c).forEach(function (id) {
      var c = S.state.c[id];
      if (c.x) return;
      ALL.push({ id: 'c-' + id, cid: id, custom: true, by: c.a, created: c.c || c.ts, city: c.city || cityFor(c.lat, c.lng), cat: c.cat || 'sight', name: c.name,
        area: '💡 предложила ' + memberName(c.a), lat: c.lat, lng: c.lng, price: c.price == null ? 1 : c.price, time: '', desc: c.desc || '', tip: '', wiki: '',
        img: c.img || '', ph: !!c.ph, tags: ['предложение'] });
    });
    PLACE = {};
    ALL.forEach(function (p) { PLACE[p.id] = p; });
  }
  function members() {
    return Object.keys(S.state.m).map(function (k) { var m = S.state.m[k]; return { key: k, name: m.name, av: m.av, ts: m.ts, first: m.first }; })
      .sort(function (a, b) { return (a.first || a.ts) - (b.first || b.ts); });
  }
  function memberName(k) { var m = S.state.m[k]; return m ? m.name : k; }
  function memberAv(k) { var m = S.state.m[k]; return m ? m.av : '🙂'; }
  function others() { return members().filter(function (m) { return m.key !== S.me.key; }); }
  function voteOf(mk, pid) { var v = S.state.v[mk + '|' + pid]; return v ? v[0] : 0; }
  function myVote(pid) { return voteOf(S.me.key, pid); }
  function likers(pid) { return members().filter(function (m) { return voteOf(m.key, pid) > 0; }); }
  function isMatch(pid) { return likers(pid).length >= 2; }
  function inCity(p, city) { return city === 'all' || p.city === city; }
  function matchIds() { return ALL.filter(function (p) { return isMatch(p.id); }).map(function (p) { return p.id; }); }

  // ——— Фото из Википедии ———
  var photoWait = {};
  function photo(p) {
    if (!p.wiki) return Promise.resolve(null);
    if (p.wiki in S.photos) return Promise.resolve(S.photos[p.wiki]);
    if (photoWait[p.wiki]) return photoWait[p.wiki];
    photoWait[p.wiki] = fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(p.wiki.replace(/ /g, '_')))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var src = j && j.thumbnail && j.thumbnail.source;
        // логотипы и схемы вместо фото не нужны
        if (src && /logo|\.svg|\.png/i.test(src)) src = null;
        S.photos[p.wiki] = src || null; lsSet('ts_photos2', S.photos);
        return src || null;
      }).catch(function () { return null; });
    return photoWait[p.wiki];
  }
  function phHTML(p) {
    var c = CATS[p.cat] || CATS.sight;
    return 'style="background:linear-gradient(145deg,' + c.c + ',' + shade(c.c) + ')"';
  }
  function shade(hex) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * 0.45 + 40); g = Math.round(g * 0.35 + 20); b = Math.round(b * 0.55 + 70);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  // ——— Фото предложенных мест: хранятся отдельно, шифруются кодом комнаты ———
  function blobKey(p) { return 'ph:' + p.cid; }
  function cachedBlob(key) { return lsGet('ts_blob_' + S.code + '_' + key, null); }
  function wantPhotos() {
    if (!S.room) return;
    var keys = ALL.filter(function (p) { return p.custom && p.ph && !cachedBlob(blobKey(p)); }).map(blobKey);
    if (keys.length) S.room.wantBlobs(keys);
  }
  function republishPhotos() {
    // каждая копия фото на серверах — ещё одна страховка, поэтому делимся всеми, что есть на устройстве
    ALL.forEach(function (p) {
      if (!p.custom || !p.ph) return;
      var v = cachedBlob(blobKey(p)); if (v) S.room.publishBlob(blobKey(p), v);
    });
  }
  function onBlob(key, value) {
    if (typeof value !== 'string' || value.indexOf('data:image/') !== 0) return;
    lsSet('ts_blob_' + S.code + '_' + key, value);
    S.room.gotBlob(key);
    $$('[data-photo-key="' + key + '"]').forEach(function (el) { fillPhoto(el, PLACE['c-' + key.slice(3)]); });
  }
  function photoSrc(p) {
    if (p.custom) return Promise.resolve(p.img || (p.ph ? cachedBlob(blobKey(p)) : null));
    return photo(p);
  }
  function fillPhoto(el, p) {
    if (!p) return;
    if (p.custom && p.ph) el.dataset.photoKey = blobKey(p);
    if (el.querySelector('img')) return;
    photoSrc(p).then(function (src) {
      if (!src || !el.isConnected) return;
      var img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer';
      img.onload = function () { if (el.querySelector('img')) return; el.prepend(img); var e = el.querySelector('.emo'); if (e) e.style.opacity = 0; };
      // Википедия отдаёт только стандартные ширины: пробуем 960px, иначе исходную миниатюру
      img.onerror = function () { if (img.src !== src) img.src = src; };
      img.src = /\/\d+px-/.test(src) ? src.replace(/\/\d+px-/, '/960px-') : src;
    });
  }

  // ——— Вход ———
  function showGate() {
    $('#app').hidden = true; $('#gate').hidden = false;
    $('#gate-start').hidden = false; $('#gate-who').hidden = true;
    var hash = location.hash.match(/join=([A-Za-z0-9-]+)/);
    if (hash) $('#join-code').value = normCode(hash[1]);
    var rooms = lsGet('ts_rooms', []);
    $('#recent-rooms').innerHTML = rooms.length ? '<div class="recent"><div class="muted small">Ваши комнаты на этом устройстве</div>' +
      rooms.map(function (r) { return '<button class="btn" data-room="' + esc(r.code) + '"><span>' + esc(r.code) + '</span><span>' + esc(r.av || '') + ' ' + esc(r.name || '') + '</span></button>'; }).join('') + '</div>' : '';
  }
  var gateRoom = null;
  function startWho(code, isNew) {
    S.code = code;
    S.state = lsGet('ts_state_' + code, emptyState());
    $('#gate-start').hidden = true; $('#gate-who').hidden = false;
    $('#gate-code').textContent = code;
    var picked = AVATARS[isNew ? 1 : 0][0];
    var grid = $('#avatar-grid');
    grid.innerHTML = AVATARS.map(function (a) { return '<button data-av="' + a[0] + '"><span>' + a[0] + '</span>' + a[1] + '</button>'; }).join('');
    function pick(av) { picked = av; $$('button', grid).forEach(function (b) { b.classList.toggle('on', b.dataset.av === av); }); }
    pick(picked);
    grid.onclick = function (e) { var b = e.target.closest('button'); if (b) pick(b.dataset.av); };
    $('#me-name').value = isNew ? 'Ира' : '';
    function showMembers() {
      var ms = members();
      $('#member-picks').innerHTML = ms.length ? '<div class="muted small" style="width:100%">Уже в комнате — нажми, если это ты:</div>' +
        ms.map(function (m) { return '<button class="btn" data-key="' + esc(m.key) + '">' + esc(m.av) + ' ' + esc(m.name) + '</button>'; }).join('') : '';
      if (!isNew && ms.length && !$('#me-name').value) {
        var used = ms.map(function (m) { return m.key; });
        if (used.indexOf('лиза') < 0) { $('#me-name').value = 'Лиза'; pick(AVATARS.filter(function (a) { return ms.every(function (m) { return m.av !== a[0]; }); })[0][0]); }
      }
    }
    showMembers();
    $('#member-picks').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var m = S.state.m[b.dataset.key]; $('#me-name').value = m.name; pick(m.av);
    };
    if (gateRoom) gateRoom.close();
    gateRoom = new TripSync.Room(code, { onState: function (st) { if (mergeInto(S.state, st)) { lsSet('ts_state_' + code, S.state); showMembers(); } } });
    gateRoom.connect();
    $('#btn-enter').onclick = function () {
      var name = $('#me-name').value.trim();
      if (!name) { toast('Напиши своё имя'); return; }
      var key = name.toLowerCase();
      if (gateRoom) { gateRoom.close(); gateRoom = null; }
      S.me = { key: key, name: name, av: picked };
      var prev = S.state.m[key];
      S.state.m[key] = { name: name, av: picked, ts: now(), first: prev && prev.first || now() };
      lsSet('ts_me_' + code, S.me);
      lsSet('ts_current', code);
      var rooms = lsGet('ts_rooms', []).filter(function (r) { return r.code !== code; });
      rooms.unshift({ code: code, name: name, av: picked }); lsSet('ts_rooms', rooms.slice(0, 6));
      enterApp();
      save();
    };
  }
  function openRoom(code) {
    code = normCode(code);
    var me = lsGet('ts_me_' + code, null);
    if (me) { S.code = code; S.me = me; S.state = lsGet('ts_state_' + code, emptyState()); lsSet('ts_current', code); enterApp(); }
    else startWho(code, false);
  }

  function enterApp() {
    $('#gate').hidden = true; $('#app').hidden = false;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    rebuildPlaces();
    if (S.room) S.room.close();
    var firstSync = true;
    S.room = new TripSync.Room(S.code, {
      onState: function (st) {
        var before = matchIds();
        var suggBefore = pendingSuggestions().map(function (p) { return p.id; });
        var supBefore = superKeys();
        if (mergeInto(S.state, st)) {
          rebuildPlaces();
          lsSet('ts_state_' + S.code, S.state);
          wantPhotos();
          var after = matchIds().filter(function (id) { return before.indexOf(id) < 0 && myVote(id) > 0; });
          var newSugg = pendingSuggestions().filter(function (p) { return suggBefore.indexOf(p.id) < 0; });
          if (after.length && !firstSync) showMatch(PLACE[after[0]], after.length);
          var newSup = superKeys().filter(function (k) { return supBefore.indexOf(k) < 0; });
          if (newSup.length && !firstSync && !newSugg.length) {
            var ks = newSup[0].split('|'), sp = PLACE[ks[1]];
            if (sp) toast('⭐ ' + memberName(ks[0]) + ' отметила «обязательно»: ' + sp.name + (newSup.length > 1 ? ' и ещё ' + (newSup.length - 1) : ''));
          }
          if (newSugg.length) {
            var p = newSugg[0];
            toast('💡 ' + memberName(p.by) + ' предлагает: ' + p.name + (newSugg.length > 1 ? ' и ещё ' + (newSugg.length - 1) : '') + ' — уже первая в колоде');
          }
          if (!dragging) render();
        }
      },
      onBlob: onBlob,
      onSynced: function () {
        if (firstSync) { firstSync = false; S.room.publish(function () { return S.state; }); republishPhotos(); }
      },
      onStatus: function (st) { S.status = st; renderTop(); }
    });
    S.room.connect();
    wantPhotos();
    setTimeout(function () { if (firstSync) { firstSync = false; S.room.publish(function () { return S.state; }); republishPhotos(); } }, 4000);
    setView(S.view);
  }

  // ——— Навигация ———
  function setView(v) {
    S.view = v;
    $$('.view').forEach(function (el) { el.hidden = el.id !== 'view-' + v; });
    $$('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    render();
    if (v === 'map' && map) setTimeout(function () { map.invalidateSize(); }, 50);
  }
  function render() {
    renderTop();
    var mc = matchIds().length, badge = $('#match-badge');
    badge.hidden = !mc; badge.textContent = mc;
    if (S.view === 'swipe') renderSwipe();
    else if (S.view === 'lists') renderLists();
    else if (S.view === 'map') renderMap();
    else if (S.view === 'plan') renderPlan();
    else if (S.view === 'more') renderMore();
    if (openPid && !$('#sheet').hidden && sheetKind === 'place') renderPlaceSheet(openPid, true);
  }
  function renderTop() {
    if (!S.me) return;
    $('#room-code-top').textContent = S.code;
    var dot = $('#sync-dot');
    dot.className = 'dot' + (S.status.open >= 2 ? ' on' : S.status.open ? ' part' : '');
    dot.title = 'Подключено к ' + S.status.open + ' из ' + S.status.total + ' серверов синхронизации';
    $('#who-top').innerHTML = members().map(function (m) { return '<div class="av"><span>' + esc(m.av) + '</span>' + esc(m.name) + '</div>'; }).join('');
  }
  function citySeg(el, cur, onPick, withAll) {
    var items = TRIP.cities.map(function (c) { return [c.id, c.flag + ' ' + c.name]; });
    if (withAll) items.push(['all', '🌏 Все']);
    el.innerHTML = items.map(function (i) { return '<button data-v="' + i[0] + '" class="' + (i[0] === cur ? 'on' : '') + '">' + i[1] + '</button>'; }).join('');
    el.onclick = function (e) { var b = e.target.closest('button'); if (b) onPick(b.dataset.v); };
  }
  function seg(el, items, cur, onPick) {
    el.innerHTML = items.map(function (i) { return '<button data-v="' + i[0] + '" class="' + (i[0] === cur ? 'on' : '') + '">' + i[1] + '</button>'; }).join('');
    el.onclick = function (e) { var b = e.target.closest('button'); if (b) onPick(b.dataset.v); };
  }

  // ——— Свайпы ———
  var dragging = false;
  function deckFor(city, cat) {
    var key = city + '|' + cat + '|' + S.me.key;
    var pool = ALL.filter(function (p) { return p.city === city && (cat === 'all' || p.cat === cat) && myVote(p.id) === 0; });
    if (S.deckKey !== key) {
      var rnd = seeded(hashStr(key));
      var liked = [], must = [], rest = [];
      pool.forEach(function (p) {
        if (likers(p.id).length) liked.push(p.id);
        else if (p.tags.indexOf('must') >= 0) must.push(p.id);
        else rest.push(p.id);
      });
      S.deck = shuffle(liked, rnd).concat(shuffle(must, rnd), shuffle(rest, rnd));
      S.deckKey = key;
    } else {
      var ids = {}; pool.forEach(function (p) { ids[p.id] = 1; });
      S.deck = S.deck.filter(function (id) { return ids[id]; });
      pool.forEach(function (p) { if (S.deck.indexOf(p.id) < 0) S.deck.push(p.id); });
    }
    // Порядок: предложения подруги → её «обязательно» → её «хочу» → остальное.
    // Карточку, которая уже лежит сверху, не трогаем, чтобы она не «уехала» из-под пальца.
    var top = S.shownTop && pool.some(function (p) { return p.id === S.shownTop; }) ? S.shownTop : null;
    var rank = function (id) {
      var p = PLACE[id];
      if (isSuggestionForMe(p)) return 0;
      if (othersVote(id) === 2) return 1;
      if (othersVote(id) === 1) return 2;
      return 3;
    };
    var sugg = pool.filter(isSuggestionForMe).sort(function (a, b) { return b.created - a.created; }).map(function (p) { return p.id; });
    var rest = S.deck.filter(function (id) { return sugg.indexOf(id) < 0 && id !== top; });
    rest = rest.map(function (id, i) { return { id: id, i: i, r: rank(id) }; })
      .sort(function (a, b) { return a.r - b.r || a.i - b.i; }).map(function (x) { return x.id; });
    S.deck = (top ? [top] : []).concat(sugg.filter(function (id) { return id !== top; }), rest);
    return S.deck;
  }
  // самый сильный голос подруги (или подруг) за место: 2 — обязательно, 1 — хочу
  function othersVote(pid) {
    return others().reduce(function (m, o) { return Math.max(m, voteOf(o.key, pid)); }, 0);
  }
  // «имя|место» для всех «обязательно» подруг
  function superKeys() {
    var me = S.me.key;
    return Object.keys(S.state.v).filter(function (k) { return S.state.v[k][0] === 2 && k.split('|')[0] !== me; });
  }
  function superBy(pid) { return members().filter(function (m) { return voteOf(m.key, pid) === 2; }); }
  function isSuggestionForMe(p) { return p.custom && p.by !== S.me.key && myVote(p.id) === 0; }
  function pendingSuggestions(city) { return ALL.filter(function (p) { return (!city || p.city === city) && isSuggestionForMe(p); }); }
  function renderSwipe() {
    citySeg($('#city-seg'), S.city, function (v) { S.city = v; S.cat = 'all'; render(); });
    // значок с числом новых предложений у каждого города
    $$('#city-seg button').forEach(function (b) {
      var n = pendingSuggestions(b.dataset.v).length;
      if (n) b.insertAdjacentHTML('beforeend', ' <b class="sugg-dot">💡' + n + '</b>');
    });
    var cats = {}; ALL.forEach(function (p) { if (p.city === S.city) cats[p.cat] = (cats[p.cat] || 0) + 1; });
    var chips = [['all', '✨ Все']].concat(Object.keys(CATS).filter(function (k) { return cats[k]; }).map(function (k) { return [k, CATS[k].e + ' ' + CATS[k].n]; }));
    var ch = $('#cat-chips');
    ch.innerHTML = chips.map(function (c) { return '<button data-v="' + c[0] + '" class="' + (c[0] === S.cat ? 'on' : '') + '">' + c[1] + '</button>'; }).join('');
    ch.onclick = function (e) { var b = e.target.closest('button'); if (b) { S.cat = b.dataset.v; render(); } };

    var deck = deckFor(S.city, S.cat);
    var el = $('#deck');
    var cityTotal = ALL.filter(function (p) { return p.city === S.city && (S.cat === 'all' || p.cat === S.cat); }).length;
    $('#deck-meta').textContent = deck.length ? 'Осталось ' + deck.length + ' из ' + cityTotal + ' · свайп вправо — хочу, влево — нет, вверх — обязательно' : '';
    var top = deck.slice(0, 3);
    S.shownTop = top[0] || null;
    var curTop = el.querySelector('.card:not(.under)');
    if (curTop && curTop.dataset.id === top[0] && el.children.length === top.length) {
      // та же карта сверху — обновим только бейджи
      updateBadges(curTop, PLACE[top[0]]);
    } else {
      el.innerHTML = '';
      top.slice().reverse().forEach(function (id, i) {
        var idx = top.length - 1 - i;
        var c = cardEl(PLACE[id]);
        if (idx > 0) { c.classList.add('under'); c.style.transform = 'translateY(' + (idx * 10) + 'px) scale(' + (1 - idx * 0.04) + ')'; }
        el.appendChild(c);
      });
      var t = el.lastElementChild;
      if (t) bindDrag(t);
    }
    var empty = $('#deck-empty');
    empty.hidden = !!deck.length;
    if (!deck.length) {
      var liked = ALL.filter(function (p) { return p.city === S.city && myVote(p.id) > 0; }).length;
      empty.innerHTML = '<div class="big-emo">🎉</div><h3>Всё просмотрено!</h3><p class="muted">В этой подборке ты лайкнула ' + liked + ' мест.</p>' +
        '<button class="btn" id="btn-review">Пересмотреть отклонённые</button><button class="btn primary" id="btn-go-matches">Смотреть мэтчи 💞</button>';
      $('#btn-review').onclick = function () {
        change(function (st) {
          ALL.forEach(function (p) { if (p.city === S.city && (S.cat === 'all' || p.cat === S.cat) && myVote(p.id) < 0) st.v[S.me.key + '|' + p.id] = [0, now()]; });
        });
        S.deckKey = '';
        render();
      };
      $('#btn-go-matches').onclick = function () { S.listCity = S.city; setView('lists'); };
    }
  }
  function cardEl(p) {
    var c = document.createElement('div');
    c.className = 'card'; c.dataset.id = p.id;
    var cat = CATS[p.cat] || CATS.sight;
    c.innerHTML = '<div class="stamp like">ХОЧУ</div><div class="stamp nope">НЕТ</div><div class="stamp super">ОБЯЗАТЕЛЬНО</div>' +
      '<div class="ph" ' + phHTML(p) + '><div class="emo">' + cat.e + '</div><div class="badges"></div></div>' +
      '<div class="body"><h3>' + esc(p.name) + '</h3><div class="meta"><span>📍 ' + esc(p.area) + '</span><span>' + cat.e + ' ' + cat.n + '</span><span>' + PRICE[p.price] + '</span>' + (p.time ? '<span>⏱ ' + esc(p.time) + '</span>' : '') + '</div>' +
      '<p class="desc">' + esc(p.desc) + '</p><div class="more">Нажми, чтобы открыть подробности и карту →</div></div>';
    updateBadges(c, p);
    fillPhoto(c.querySelector('.ph'), p);
    return c;
  }
  function updateBadges(c, p) {
    var b = [];
    if (p.custom) b.push('<span class="badge sugg">💡 ' + esc(memberAv(p.by)) + ' ' + esc(memberName(p.by)) + (p.by === S.me.key ? ' (ты)' : '') + ' предлагает</span>');
    likers(p.id).forEach(function (m) {
      if (p.custom && m.key === p.by) return;
      if (m.key === S.me.key) return;
      if (voteOf(m.key, p.id) === 2) b.unshift('<span class="badge super-b">⭐ ' + esc(m.av) + ' ' + esc(m.name) + ': ОБЯЗАТЕЛЬНО!</span>');
      else b.push('<span class="badge hot">' + esc(m.av) + ' ' + esc(m.name) + ' хочет ♥</span>');
    });
    if (p.tags.indexOf('must') >= 0) b.push('<span class="badge must">must see</span>');
    if (p.tags.indexOf('вечер') >= 0 || p.tags.indexOf('ночь') >= 0) b.push('<span class="badge">🌙 вечером</span>');
    if (p.tags.indexOf('дождь') >= 0) b.push('<span class="badge">☔ под крышей</span>');
    var notes = notesFor(p.id).length;
    if (notes) b.push('<span class="badge">📝 ' + notes + '</span>');
    var el = c.querySelector('.badges'); if (el) el.innerHTML = b.join('');
    c.classList.toggle('card-super', others().some(function (m) { return voteOf(m.key, p.id) === 2; }));
  }
  function bindDrag(card) {
    var sx = 0, sy = 0, dx = 0, dy = 0, active = false;
    var sL = card.querySelector('.stamp.like'), sN = card.querySelector('.stamp.nope'), sS = card.querySelector('.stamp.super');
    card.onpointerdown = function (e) {
      if (e.button > 0) return;
      active = true; dragging = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      card.classList.add('dragging'); card.setPointerCapture(e.pointerId);
    };
    card.onpointermove = function (e) {
      if (!active) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx / 16) + 'deg)';
      sL.style.opacity = Math.max(0, Math.min(1, dx / 90));
      sN.style.opacity = Math.max(0, Math.min(1, -dx / 90));
      sS.style.opacity = Math.max(0, Math.min(1, (-dy - Math.abs(dx)) / 90));
    };
    function end() {
      if (!active) return;
      active = false; dragging = false; card.classList.remove('dragging');
      if (Math.abs(dx) + Math.abs(dy) < 8) { card.style.transform = ''; openPlace(card.dataset.id); return; }
      if (-dy > 110 && Math.abs(dx) < 120) return fly(card, 2);
      if (dx > 100) return fly(card, 1);
      if (dx < -100) return fly(card, -1);
      card.style.transform = ''; sL.style.opacity = sN.style.opacity = sS.style.opacity = 0;
    }
    card.onpointerup = end; card.onpointercancel = end;
  }
  function fly(card, val) {
    var w = window.innerWidth;
    card.style.transition = 'transform .32s ease';
    card.style.transform = val === 2 ? 'translate(0,-' + (window.innerHeight) + 'px)' : 'translate(' + (val > 0 ? w * 1.3 : -w * 1.3) + 'px, 40px) rotate(' + (val * 30) + 'deg)';
    var stamp = card.querySelector(val === 2 ? '.stamp.super' : val > 0 ? '.stamp.like' : '.stamp.nope'); if (stamp) stamp.style.opacity = 1;
    var pid = card.dataset.id;
    setTimeout(function () { castVote(pid, val, true); }, 260);
  }
  function castVote(pid, val, fromDeck) {
    var prev = myVote(pid);
    if (fromDeck) S.undo.push({ pid: pid, prev: prev });
    var wasMatch = isMatch(pid);
    change(function (st) { st.v[S.me.key + '|' + pid] = [val, now()]; });
    if (val > 0 && !wasMatch && isMatch(pid)) showMatch(PLACE[pid], 1);
  }
  function swipeTop(val) {
    var top = $('#deck .card:not(.under)');
    if (top) fly(top, val);
  }
  function undoSwipe() {
    var u = S.undo.pop();
    if (!u) { toast('Нечего возвращать'); return; }
    change(function (st) { st.v[S.me.key + '|' + u.pid] = [u.prev, now()]; });
    var p = PLACE[u.pid];
    if (p) { S.city = p.city; S.deck.unshift(u.pid); S.shownTop = u.pid; S.deckKey = p.city + '|' + S.cat + '|' + S.me.key; }
    $('#deck').innerHTML = '';
    render();
  }
  function showMatch(p, count) {
    if (!p) return;
    var ls = likers(p.id);
    var pop = $('#match-pop');
    pop.innerHTML = '<h2>Это мэтч! 💞</h2><div class="avs">' + ls.map(function (m) { return esc(m.av); }).join(' 💜 ') + '</div>' +
      '<p>' + ls.map(function (m) { return esc(m.name); }).join(' и ') + (ls.length > 1 ? ' хотят в «' : ' хочет в «') + esc(p.name) + '»' + (count > 1 ? ' (и ещё ' + (count - 1) + ')' : '') + '</p>' +
      '<button class="btn big primary" id="mp-plan">Добавить в план</button><button class="btn big" id="mp-close">Свайпать дальше</button>';
    pop.hidden = false;
    $('#mp-close').onclick = function () { pop.hidden = true; };
    $('#mp-plan').onclick = function () { pop.hidden = true; openPlace(p.id); };
  }

  // ——— Списки ———
  function renderLists() {
    citySeg($('#list-city-seg'), S.listCity, function (v) { S.listCity = v; render(); }, true);
    var os = others();
    var modes = [['match', '💞 Мэтчи'], ['mine', S.me.av + ' Мои ♥']];
    os.forEach(function (m) { modes.push(['m:' + m.key, m.av + ' ' + m.name + ' ♥']); });
    modes.push(['diff', '🤔 Спорные'], ['nope', '✕ Отклонённые'], ['all', '📚 Все места']);
    seg($('#list-mode-seg'), modes, S.listMode, function (v) { S.listMode = v; render(); });
    var q = ($('#list-search').value || '').toLowerCase();
    var items = ALL.filter(function (p) {
      if (!inCity(p, S.listCity)) return false;
      if (q && (p.name + ' ' + p.area + ' ' + p.desc).toLowerCase().indexOf(q) < 0) return false;
      var mv = myVote(p.id), n = likers(p.id).length;
      switch (S.listMode) {
        case 'match': return n >= 2;
        case 'mine': return mv > 0;
        case 'diff': return n === 1 && members().some(function (m) { return voteOf(m.key, p.id) < 0; });
        case 'nope': return mv < 0;
        case 'all': return true;
        default: return voteOf(S.listMode.slice(2), p.id) > 0;
      }
    });
    items.sort(function (a, b) { return score(b) - score(a); });
    function score(p) { return members().reduce(function (s, m) { var v = voteOf(m.key, p.id); return s + (v > 0 ? v : 0); }, 0); }
    var el = $('#list');
    if (!items.length) {
      var msg = S.listMode === 'match' ? (os.length ? 'Пока нет общих мест — свайпайте дальше!' : 'Отправь подруге код комнаты ' + S.code + ', чтобы появились мэтчи') : 'Здесь пока пусто';
      el.innerHTML = '<div class="empty"><span class="big-emo">' + (S.listMode === 'match' ? '💞' : '🫧') + '</span>' + esc(msg) + '</div>';
      return;
    }
    var html = [], lastCat = null;
    var byCat = S.listMode !== 'all' ? null : true;
    if (byCat) items.sort(function (a, b) { return a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : 0; });
    items.forEach(function (p) {
      if (byCat && p.cat !== lastCat) { lastCat = p.cat; html.push('<div class="group-h">' + CATS[p.cat].e + ' ' + CATS[p.cat].n + '</div>'); }
      html.push(rowHTML(p));
    });
    el.innerHTML = html.join('');
    $$('.row', el).forEach(function (r) { var p = PLACE[r.dataset.id]; fillPhoto(r.querySelector('.th'), p); });
    el.onclick = function (e) { var r = e.target.closest('.row'); if (r) openPlace(r.dataset.id); };
  }
  function rowHTML(p) {
    var cat = CATS[p.cat] || CATS.sight;
    var vs = members().map(function (m) { var v = voteOf(m.key, p.id); return v > 0 ? '<span title="' + esc(m.name) + '">' + esc(m.av) + (v === 2 ? '★' : '') + '</span>' : ''; }).join('');
    var inPlan = planFor(p.id);
    return '<div class="row" data-id="' + esc(p.id) + '"><div class="th" ' + phHTML(p) + '><span class="emo">' + cat.e + '</span></div>' +
      '<div class="tx"><b>' + esc(p.name) + '</b><div class="meta"><span>' + CITY[p.city].flag + ' ' + esc(p.area) + '</span><span>' + PRICE[p.price] + '</span>' +
      (superBy(p.id).length ? '<span class="must-chip">⭐ обязательно: ' + superBy(p.id).map(function (m) { return esc(m.av) + ' ' + esc(m.name); }).join(', ') + '</span>' : '') +
      (inPlan.length ? '<span>📅 ' + inPlan.map(function (x) { return DAY[x.day] ? DAY[x.day].title : x.day; }).join(', ') + '</span>' : '') +
      (notesFor(p.id).length ? '<span>📝 ' + notesFor(p.id).length + '</span>' : '') + '</div></div><div class="votes">' + vs + '</div></div>';
  }

  // ——— Подробности места ———
  var openPid = null, sheetKind = null, miniMap = null;
  function openSheet(kind) {
    sheetKind = kind;
    $('#sheet').hidden = false; $('#sheet-back').hidden = false;
  }
  function closeSheet() {
    $('#sheet').hidden = true; $('#sheet-back').hidden = true; openPid = null; sheetKind = null;
    if (miniMap) { miniMap.remove(); miniMap = null; }
  }
  function openPlace(pid) {
    if (!PLACE[pid]) return;
    openPid = pid; openSheet('place');
    renderPlaceSheet(pid, false);
    $('#sheet').scrollTop = 0;
  }
  function renderPlaceSheet(pid, refresh) {
    var p = PLACE[pid]; if (!p) { closeSheet(); return; }
    var body = $('#sheet-body');
    var cat = CATS[p.cat] || CATS.sight;
    var mv = myVote(pid);
    var L = TripExport.links;
    var korea = p.city === 'seoul' || p.city === 'korea';
    var scroll = $('#sheet').scrollTop;
    var draft = refresh && $('#note-text') ? $('#note-text').value : '';
    var dayOpts = TRIP.days.map(function (d) { return '<option value="' + d.id + '">' + d.title + ' · ' + CITY[d.city].flag + '</option>'; }).join('');
    var plans = planFor(pid);
    body.innerHTML =
      '<div class="sh-ph" ' + phHTML(p) + '><div class="emo">' + cat.e + '</div></div>' +
      '<div class="sh-pad"><h2>' + esc(p.name) + '</h2>' +
      '<div class="meta"><span>' + CITY[p.city].flag + ' ' + esc(p.area) + '</span><span>' + cat.e + ' ' + cat.n + '</span><span>' + PRICE[p.price] + '</span>' + (p.time ? '<span>⏱ ' + esc(p.time) + '</span>' : '') + '</div>' +
      '<p>' + esc(p.desc) + '</p>' + (p.tip ? '<div class="tip">💡 ' + esc(p.tip) + '</div>' : '') +
      (p.tags.length ? '<div class="tags">' + p.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="who-votes">' + members().map(function (m) { var v = voteOf(m.key, pid); return '<span' + (v === 2 ? ' class="sv"' : '') + '>' + esc(m.av) + ' ' + esc(m.name) + ': ' + (v === 2 ? '★ обязательно' : v === 1 ? '♥ хочу' : v < 0 ? '✕ нет' : '— ещё не решила') + '</span>'; }).join('') + '</div>' +
      '<div class="vote-row"><button class="n ' + (mv < 0 ? 'on' : '') + '" data-vote="-1">✕ Нет</button><button class="l ' + (mv === 1 ? 'on' : '') + '" data-vote="1">♥ Хочу</button><button class="s ' + (mv === 2 ? 'on' : '') + '" data-vote="2">★ Обязательно</button></div>' +
      '<div class="btn-row"><a class="btn sm" target="_blank" rel="noopener" href="' + L.google(p) + '">Google Maps</a><a class="btn sm" target="_blank" rel="noopener" href="' + L.apple(p) + '">Apple Карты</a>' +
      (korea ? '<a class="btn sm" target="_blank" rel="noopener" href="' + L.naver(p) + '">Naver Map</a><a class="btn sm" target="_blank" rel="noopener" href="' + L.kakao(p) + '">KakaoMap</a>' : '') + '</div>' +
      '<div class="mini-map" id="mini-map"></div>' +
      '<div class="sec-h">📅 В план</div>' +
      (plans.length ? '<div class="muted small">Уже в плане: ' + plans.map(function (x) { return DAY[x.day] ? DAY[x.day].title : x.day; }).join(', ') + '</div>' : '') +
      '<div class="day-add"><select id="sh-day">' + dayOpts + '</select><button class="btn" id="sh-add-plan">Добавить</button></div>' +
      '<div class="sec-h">📝 Заметки</div><div class="notes" id="sh-notes">' + notesHTML(notesFor(pid)) + '</div>' +
      '<div class="note-form"><textarea id="note-text" placeholder="Например: «идём после концерта», «бронь на 19:00», «там дорого»"></textarea><button class="btn primary" id="sh-note">→</button></div>' +
      (p.custom ? '<div class="btn-row"><button class="btn sm" id="sh-del-custom">Удалить это место</button></div>' : '') +
      '</div>';
    fillPhoto($('.sh-ph', body), p);
    var sd = $('#sh-day');
    var guess = TRIP.days.filter(function (d) { return d.city === p.city || (p.city === 'korea' && d.city === 'seoul'); })[0];
    if (guess) sd.value = guess.id;
    if (draft) $('#note-text').value = draft;
    $$('.vote-row button', body).forEach(function (b) {
      b.onclick = function () { var v = +b.dataset.vote; castVote(pid, myVote(pid) === v ? 0 : v, false); };
    });
    $('#sh-add-plan').onclick = function () { addPlan(sd.value, pid, null); toast('Добавлено в ' + DAY[sd.value].title); };
    $('#sh-note').onclick = function () { var t = $('#note-text').value.trim(); if (!t) return; $('#note-text').value = ''; addNote({ p: pid, t: t }); };
    bindNotes($('#sh-notes'));
    if (p.custom) $('#sh-del-custom').onclick = function () { if (confirm('Удалить место «' + p.name + '»?')) { change(function (st) { st.c[p.cid] = Object.assign({}, st.c[p.cid], { x: 1, ts: now() }); }); closeSheet(); } };
    if (miniMap) { miniMap.remove(); miniMap = null; }
    miniMap = L_map('mini-map', [p.lat, p.lng], 15, { zoomControl: false, attributionControl: false });
    window.L.marker([p.lat, p.lng], { icon: pinIcon(p, 'match') }).addTo(miniMap);
    if (refresh) $('#sheet').scrollTop = scroll;
  }

  // ——— Заметки ———
  function notesFor(pid) { return Object.keys(S.state.n).map(function (id) { return Object.assign({ id: id }, S.state.n[id]); }).filter(function (n) { return !n.x && n.p === pid && n.k !== 'check'; }).sort(function (a, b) { return a.c - b.c; }); }
  function notesOfDay(day) { return Object.keys(S.state.n).map(function (id) { return Object.assign({ id: id }, S.state.n[id]); }).filter(function (n) { return !n.x && n.d === day && n.k !== 'check'; }).sort(function (a, b) { return a.c - b.c; }); }
  function addNote(o) {
    var id = uid();
    change(function (st) { st.n[id] = Object.assign({ a: S.me.key, c: now(), ts: now() }, o); });
  }
  function notesHTML(list, showRef) {
    if (!list.length) return '<div class="muted small">Пока нет заметок</div>';
    return list.map(function (n) {
      var ref = '';
      if (showRef && n.p && PLACE[n.p]) ref = '<div class="ref" data-open="' + esc(n.p) + '">📍 ' + esc(PLACE[n.p].name) + '</div>';
      if (showRef && n.d && DAY[n.d]) ref = '<div class="ref" data-day="' + esc(n.d) + '">📅 ' + DAY[n.d].title + '</div>';
      return '<div class="note"><div class="nh"><span>' + esc(memberAv(n.a)) + ' ' + esc(memberName(n.a)) + ' · ' + fmtTime(n.c || n.ts) + '</span>' +
        (n.a === S.me.key ? '<button class="del" data-del="' + esc(n.id) + '" title="Удалить">✕</button>' : '') + '</div>' + ref + '<div class="nt">' + esc(n.t) + '</div></div>';
    }).join('');
  }
  function bindNotes(el) {
    el.onclick = function (e) {
      var d = e.target.closest('[data-del]');
      if (d) { if (confirm('Удалить заметку?')) change(function (st) { st.n[d.dataset.del] = Object.assign({}, st.n[d.dataset.del], { x: 1, ts: now() }); }); return; }
      var o = e.target.closest('[data-open]'); if (o) { openPlace(o.dataset.open); return; }
      var dy = e.target.closest('[data-day]'); if (dy) { setView('plan'); }
    };
  }

  // ——— План ———
  function planItems(day) {
    return Object.keys(S.state.p).map(function (id) { return Object.assign({ id: id }, S.state.p[id]); })
      .filter(function (x) { return !x.x && (!day || x.day === day); })
      .sort(function (a, b) { var ta = a.time || '99', tb = b.time || '99'; return ta < tb ? -1 : ta > tb ? 1 : a.ord - b.ord; });
  }
  function planFor(pid) { return planItems().filter(function (x) { return x.pid === pid; }); }
  function addPlan(day, pid, title) {
    var id = uid(), last = planItems(day).reduce(function (m, x) { return Math.max(m, x.ord || 0); }, 0);
    change(function (st) { st.p[id] = { day: day, pid: pid || null, title: title || '', time: '', ord: last + 1, a: S.me.key, ts: now() }; });
  }
  function concertPid() {
    var p = ALL.filter(function (x) { return x.tags.indexOf('концерт') >= 0; })[0];
    return p ? p.id : null;
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 0; }
  function fmtDur(mins) { var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + ' ч' : '') + (h && m ? ' ' : '') + (m ? m + ' мин' : ''); }
  // Фиксированные события дня; 8 марта — из рейса, за который больше голосов
  function fixedFor(d, flight) {
    var list = (d.fixed || []).slice();
    if (d.id === '03-08' && flight) {
      var dep = /(\d\d:\d\d)/.exec(flight.dep), arr = /(\d\d:\d\d)/.exec(flight.arr);
      if (dep) list.push({ time: dep[1], title: '🛫 ' + flight.title + ' — вылет из Changi T1' });
      if (arr) list.push({ time: arr[1], title: '🛬 Прилёт в Инчхон T1' });
    }
    return list;
  }
  function patchPlan(id, o) { change(function (st) { st.p[id] = Object.assign({}, st.p[id], o, { ts: now() }); }); }
  function renderPlan() {
    // Выбор рейса
    var fv = S.state.f, ms = members();
    var counts = {}; ms.forEach(function (m) { var v = fv[m.key]; if (v && v[0]) counts[v[0]] = (counts[v[0]] || 0) + 1; });
    var lead = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    $('#flight-box').innerHTML = '<div class="flight-box"><h3>✈️ Сингапур → Сеул, 8 марта</h3><div class="muted small">Билеты ещё не куплены — голосуйте! Безвиз в Сингапуре заканчивается ~19:50 8 марта, все варианты подходят.</div>' +
      TRIP.flights.map(function (f) {
        var voters = ms.filter(function (m) { return fv[m.key] && fv[m.key][0] === f.id; });
        var mine = fv[S.me.key] && fv[S.me.key][0] === f.id;
        return '<div class="fl ' + (f.id === lead ? 'lead' : '') + '"><div class="fl-h"><b>' + esc(f.title) + '</b><span>' + voters.map(function (m) { return esc(m.av); }).join('') + '</span></div>' +
          '<div class="times">🛫 ' + esc(f.dep) + '<br>🛬 ' + esc(f.arr) + '<br>' + esc(f.dur) + '<br>🇰🇷 В Сеуле: ' + esc(f.hoursInSeoul) + '</div>' +
          '<ul>' + f.pros.map(function (x) { return '<li class="pro">' + esc(x) + '</li>'; }).join('') + f.cons.map(function (x) { return '<li class="con">' + esc(x) + '</li>'; }).join('') + '</ul>' +
          '<div class="vt"><button class="btn sm ' + (mine ? 'primary' : '') + '" data-fl="' + f.id + '">' + (mine ? '✓ Мой выбор' : 'Голосую за этот') + '</button></div></div>';
      }).join('') + '</div>';
    $$('[data-fl]', $('#flight-box')).forEach(function (b) {
      b.onclick = function () { var id = b.dataset.fl; change(function (st) { st.f[S.me.key] = [st.f[S.me.key] && st.f[S.me.key][0] === id ? '' : id, now()]; }); };
    });

    // Дни: фиксированные события (рейсы, концерты) и пункты плана в одной ленте по времени
    var leadFlight = TRIP.flights.filter(function (f) { return f.id === lead; })[0];
    var html = TRIP.days.map(function (d) {
      var items = planItems(d.id);
      var cities = d.id === '03-08' ? ['sg', 'seoul', 'korea'] : d.city === 'seoul' ? ['seoul', 'korea'] : d.city === 'cn' ? ['cn', 'seoul', 'korea'] : [d.city];
      var cand = ALL.filter(function (p) { return cities.indexOf(p.city) >= 0 && (isMatch(p.id) || myVote(p.id) > 0 || likers(p.id).length); });
      cand.sort(function (a, b) { return (isMatch(b.id) ? 2 : 0) + (myVote(b.id) > 0 ? 1 : 0) - (isMatch(a.id) ? 2 : 0) - (myVote(a.id) > 0 ? 1 : 0); });
      var dn = notesOfDay(d.id);
      var rows = fixedFor(d, leadFlight).map(function (f) { return Object.assign({ fixed: true, pid: f.place === 'concert' ? concertPid() : null }, f); })
        .concat(items);
      // по времени; пункты без времени — в конце, в своём порядке
      rows = rows.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
        var ta = a.r.time || '99:99', tb = b.r.time || '99:99';
        return ta < tb ? -1 : ta > tb ? 1 : a.i - b.i;
      }).map(function (x) { return x.r; });
      var placesInDay = [];
      rows.forEach(function (r) { var p = PLACE[r.pid]; if (p && placesInDay.indexOf(p) < 0) placesInDay.push(p); });
      // промежуток показываем, только если рядом есть ваш пункт плана (между рейсом и рейсом или внутри концерта — не нужно)
      var prev = null;
      var timeline = rows.map(function (x) {
        var gap = '';
        if (x.time && prev && !(x.fixed && prev.fixed)) {
          var mins = toMin(x.time) - toMin(prev.time);
          if (mins >= 30) gap = '<div class="gap">⏳ ' + fmtDur(mins) + ' до следующего пункта (вместе с дорогой)</div>';
        }
        if (x.time) prev = x;
        var p = PLACE[x.pid];
        if (x.fixed) {
          return gap + '<div class="pi fx' + (x.concert ? ' concert' : '') + '"><span class="t fx-t">' + esc(x.time) + '</span><div class="nm" ' + (p ? 'data-open="' + esc(p.id) + '"' : '') + '>' + esc(x.title) +
            (p ? '<small>📍 ' + esc(p.name.split(' — ')[0]) + '</small>' : '') + '</div></div>';
        }
        var nm = p ? esc(p.name) + '<small>' + (CATS[p.cat] || CATS.sight).e + ' ' + esc(p.area) + '</small>' : esc(x.title) + '<small>' + esc(memberAv(x.a)) + ' своё</small>';
        return gap + '<div class="pi" data-id="' + x.id + '"><input type="time" class="t" value="' + esc(x.time || '') + '"><div class="nm" ' + (p ? 'data-open="' + esc(p.id) + '"' : '') + '>' + nm + '</div>' +
          '<div class="ops"><button data-op="up" title="Выше">↑</button><button data-op="down" title="Ниже">↓</button><button data-op="del" title="Убрать">✕</button></div></div>';
      }).join('');
      return '<div class="day" data-day="' + d.id + '"><div class="day-h"><h3>' + CITY[d.city].flag + ' ' + d.title + '</h3>' +
        (placesInDay.length ? '<a class="btn sm" target="_blank" rel="noopener" href="' + TripExport.links.route(placesInDay) + '">🗺 Маршрут</a>' : '') + '</div>' +
        (d.events.length ? '<ul class="day-ev">' + d.events.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '') +
        (d.hint ? '<div class="day-hint">' + esc(d.hint) + '</div>' : '') +
        timeline +
        '<div class="day-add"><select class="add-sel"><option value="">＋ Добавить место…</option>' +
        cand.map(function (p) { return '<option value="' + esc(p.id) + '">' + (isMatch(p.id) ? '💞 ' : myVote(p.id) > 0 ? '♥ ' : '· ') + esc(p.name) + '</option>'; }).join('') +
        '<option value="__custom">✏️ Своё (текстом)…</option></select></div>' +
        '<details class="day-notes"' + (dn.length ? ' open' : '') + '><summary class="muted small" style="cursor:pointer;margin-top:10px">📝 Заметки дня (' + dn.length + ')</summary><div class="notes" style="margin-top:8px">' + notesHTML(dn) + '</div>' +
        '<div class="note-form"><textarea placeholder="Заметка к дню"></textarea><button class="btn primary">→</button></div></details></div>';
    }).join('');
    var days = $('#days');
    var openState = {};
    $$('.day', days).forEach(function (el) { var dt = el.querySelector('details'); if (dt) openState[el.dataset.day] = dt.open; });
    days.innerHTML = html;
    $$('.day', days).forEach(function (el) {
      var day = el.dataset.day;
      var dt = el.querySelector('details'); if (day in openState) dt.open = openState[day];
      el.querySelector('.add-sel').onchange = function (e) {
        var v = e.target.value; if (!v) return;
        if (v === '__custom') { var t = prompt('Что делаем? Например: «заселение в отель», «ужин с другом»'); if (t && t.trim()) addPlan(day, null, t.trim()); else e.target.value = ''; }
        else addPlan(day, v, null);
      };
      var nf = el.querySelector('.note-form');
      nf.querySelector('button').onclick = function () { var ta = nf.querySelector('textarea'); var t = ta.value.trim(); if (t) addNote({ d: day, t: t }); };
      bindNotes(el.querySelector('.notes'));
      $$('.pi.fx [data-open]', el).forEach(function (n) { n.onclick = function () { openPlace(n.dataset.open); }; });
      $$('.pi[data-id]', el).forEach(function (row) {
        var id = row.dataset.id;
        row.querySelector('.t').onchange = function (e) { patchPlan(id, { time: e.target.value }); };
        row.querySelector('.nm').onclick = function () { var o = row.querySelector('[data-open]'); if (o) openPlace(o.dataset.open); };
        row.querySelector('.ops').onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return;
          var list = planItems(day), i = list.findIndex(function (x) { return x.id === id; });
          if (b.dataset.op === 'del') patchPlan(id, { x: 1 });
          else {
            var j = b.dataset.op === 'up' ? i - 1 : i + 1;
            if (j < 0 || j >= list.length) return;
            var a = list[i], c = list[j];
            change(function (st) {
              var oa = a.ord, oc = c.ord; if (oa === oc) oc = oa + (j > i ? 1 : -1);
              st.p[a.id] = Object.assign({}, st.p[a.id], { ord: oc, ts: now() });
              st.p[c.id] = Object.assign({}, st.p[c.id], { ord: oa, ts: now() });
            });
          }
        };
      });
    });
  }

  // ——— Карта ———
  var map = null, layer = null, tileLayer = null, addMode = false, lastMapCity = null;
  function dark() { return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark'; }
  // Тайлы OpenStreetMap работают без ключа на любом домене; в тёмной теме затемняем их CSS-фильтром
  function L_map(id, center, zoom, opts) {
    var m = window.L.map(id, Object.assign({ zoomControl: true }, opts || {})).setView(center, zoom);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    m.getContainer().classList.toggle('dark-tiles', dark());
    return m;
  }
  function pinIcon(p, kind) {
    var cat = CATS[p.cat] || CATS.sight;
    if (kind === 'concert') {
      return window.L.divIcon({ className: '', html: '<div class="pin concert"><span>🎤</span></div><div class="pin-label">SKZ · 6–7 марта</div>', iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -42] });
    }
    var big = /match|super/.test(kind);
    var col = /match/.test(kind) ? '#ff3d8b' : kind === 'dim' ? '#9a92ab' : cat.c;
    return window.L.divIcon({ className: '', html: '<div class="pin ' + kind + '" style="background:' + col + '"><span>' + cat.e + '</span>' + (/super/.test(kind) ? '<i class="pin-star">⭐</i>' : '') + '</div>',
      iconSize: big ? [36, 36] : [30, 30], iconAnchor: big ? [18, 36] : [15, 30], popupAnchor: [0, -30] });
  }
  function renderMap() {
    citySeg($('#map-city-seg'), S.mapCity, function (v) { S.mapCity = v; lastMapCity = null; render(); });
    var os = others();
    var modes = [['all', '🌐 Все'], ['match', '💞 Мэтчи'], ['mine', S.me.av + ' Мои']];
    os.forEach(function (m) { modes.push(['m:' + m.key, m.av + ' ' + m.name]); });
    modes.push(['plan', '📅 В плане']);
    seg($('#map-mode-seg'), modes, S.mapMode, function (v) { S.mapMode = v; render(); });
    if (!map) {
      map = L_map('map', CITY[S.mapCity].center, CITY[S.mapCity].zoom);
      layer = window.L.layerGroup().addTo(map);
      map.on('click', function (e) {
        if (!addMode) return;
        addMode = false; $('#map-hint').hidden = true;
        openAddPlace(e.latlng.lat, e.latlng.lng);
      });
    }
    layer.clearLayers();
    var planned = {}; planItems().forEach(function (x) { if (x.pid) planned[x.pid] = 1; });
    var shown = [];
    ALL.forEach(function (p) {
      if (p.city !== S.mapCity) return;
      var match = isMatch(p.id), mine = myVote(p.id) > 0, kind;
      var concert = p.tags.indexOf('концерт') >= 0;
      if (!concert) switch (S.mapMode) {
        case 'match': if (!match) return; break;
        case 'mine': if (!mine) return; break;
        case 'plan': if (!planned[p.id]) return; break;
        case 'all': break;
        default: if (voteOf(S.mapMode.slice(2), p.id) <= 0) return;
      }
      kind = match ? 'match' : (likers(p.id).length ? '' : (S.mapMode === 'all' ? 'dim' : ''));
      if (myVote(p.id) < 0 && S.mapMode === 'all') kind = 'dim';
      if (concert) kind = 'concert';
      else if (superBy(p.id).length && kind !== 'dim') kind += ' super';
      var mk = window.L.marker([p.lat, p.lng], { icon: pinIcon(p, kind), zIndexOffset: concert ? 2000 : match ? 1000 : kind === 'dim' ? -100 : 0 });
      var who = likers(p.id).map(function (m) { return esc(m.av); }).join(' ');
      var sup = superBy(p.id).map(function (m) { return esc(m.name); }).join(', ');
      mk.bindPopup('<b>' + esc(p.name) + '</b>' + (sup ? '<br><b style="color:#d99000">⭐ обязательно: ' + sup + '</b>' : '') + '<br><span style="color:#888">' + (concert ? '🎤 6 и 7 марта, начало 18:00' : (CATS[p.cat] || CATS.sight).e + ' ' + esc(p.area)) + '</span>' + (who ? '<br>' + who : '') + '<br><button class="pop-btn" data-open="' + esc(p.id) + '">Подробнее</button>');
      mk.addTo(layer); shown.push([p.lat, p.lng]);
    });
    if (lastMapCity !== S.mapCity + S.mapMode) {
      lastMapCity = S.mapCity + S.mapMode;
      if (shown.length > 1 && S.mapCity !== 'cn') map.fitBounds(shown, { padding: [40, 40], maxZoom: 15 });
      else map.setView(CITY[S.mapCity].center, CITY[S.mapCity].zoom);
    }
    setTimeout(function () { map.invalidateSize(); }, 30);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.pop-btn'); if (b) openPlace(b.dataset.open);
  });
  // Координаты и название из того, что вставили: ссылка Google/Apple Карт, «1.2816, 103.8636» или 1°16'53.8"N 103°51'49.0"E
  function parseLocation(text) {
    var t = String(text || '').trim(), s = t;
    try { s = decodeURIComponent(t.replace(/\+/g, ' ')); } catch (e) {}
    var lat, lng, m;
    var pats = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,                        // Google: точка самого места
      /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/,                          // Google: центр карты
      /[?&](?:q|query|ll|sll|daddr|coordinate|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i, // Google/Apple параметры
      /(-?\d{1,2}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})/        // просто «широта, долгота»
    ];
    for (var i = 0; i < pats.length && lat == null; i++) { m = pats[i].exec(s); if (m) { lat = +m[1]; lng = +m[2]; } }
    if (lat == null && (m = /(\d+)°\s*(\d+)['′]\s*([\d.]+)["″]?\s*([NS])[\s,]*(\d+)°\s*(\d+)['′]\s*([\d.]+)["″]?\s*([EW])/i.exec(s))) {
      lat = (+m[1] + m[2] / 60 + m[3] / 3600) * (/s/i.test(m[4]) ? -1 : 1);
      lng = (+m[5] + m[6] / 60 + m[7] / 3600) * (/w/i.test(m[8]) ? -1 : 1);
    }
    var ok = lat != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
    var name = '';
    if ((m = /\/place\/([^/@?]+)/.exec(s))) name = m[1];
    else if ((m = /[?&]name=([^&]+)/.exec(s))) name = m[1];
    else if ((m = /maps\.apple\.com\/[^#]*[?&]q=([^&]+)/.exec(s)) && !/^-?\d/.test(m[1])) name = m[1];
    return { ok: ok, lat: ok ? +lat.toFixed(6) : null, lng: ok ? +lng.toFixed(6) : null, name: name.trim(), short: /goo\.gl|maps\.app\.goo/.test(t) };
  }

  // Фото сжимаем до ~45 КБ, чтобы оно поместилось в одну зашифрованную запись
  function compressPhoto(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 720, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var out = null;
        for (var step = 0; step < 6; step++) {
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', step < 3 ? 0.72 - step * 0.12 : 0.45);
          if (out.length < 60000) break;
          if (step >= 2) k *= 0.75;
        }
        URL.revokeObjectURL(url);
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }

  function openAddPlace(lat, lng) {
    openSheet('add');
    var catOpts = Object.keys(CATS).map(function (k) { return '<option value="' + k + '">' + CATS[k].e + ' ' + CATS[k].n + '</option>'; }).join('');
    var others_ = others().map(function (m) { return m.name; }).join(' и ') || 'подруги';
    $('#sheet-body').innerHTML = '<div class="sh-pad"><h2>💡 Предложить место</h2>' +
      '<p class="muted small">Нашла что-то в TikTok, Instagram или на карте? Добавь — у ' + esc(others_) + ' это место первым появится в свайпах, а у тебя оно сразу отмечено как «хочу».</p>' +
      '<div class="sec-h">📍 Ссылка или координаты</div>' +
      '<textarea id="ap-link" placeholder="Вставь ссылку из Google/Apple Карт или координаты, например 1.2816, 103.8636" style="min-height:64px"></textarea>' +
      '<div id="ap-loc" class="muted small" style="margin:6px 0"></div>' +
      '<details class="howto"><summary class="muted small">Как скопировать координаты?</summary><div class="muted small">' +
      '<p><b>Google Карты:</b> нажми и подержи точку на карте — координаты появятся в строке поиска, скопируй их. На компьютере подойдёт и обычная ссылка из адресной строки.</p>' +
      '<p><b>Apple Карты:</b> открой место → «Поделиться» → «Скопировать» и вставь ссылку сюда. Или поставь булавку: координаты будут внизу карточки.</p>' +
      '<p>Короткие ссылки вида maps.app.goo.gl отсюда не читаются — открой такую ссылку и скопируй координаты, или найди место по названию ниже.</p></div></details>' +
      '<div class="btn-row"><button class="btn sm" id="ap-search">🔎 Найти по названию</button><button class="btn sm" id="ap-tap">👆 Указать на карте</button></div>' +
      '<div id="ap-res" class="list"></div>' +
      '<div class="sec-h">✏️ Что за место</div>' +
      '<input id="ap-name" placeholder="Название" style="margin-bottom:8px"><select id="ap-cat" style="margin-bottom:8px">' + catOpts + '</select>' +
      '<textarea id="ap-desc" placeholder="Заметка: что там, почему хотим, цены, часы работы, ссылка на рилс…" style="min-height:80px"></textarea>' +
      '<div class="sec-h">📸 Фото</div>' +
      '<div class="ap-photo" id="ap-photo"><span class="muted small">Нет фото</span></div>' +
      '<div class="btn-row"><label class="btn sm">Выбрать фото<input type="file" id="ap-file" accept="image/*" hidden></label><button class="btn sm" id="ap-photo-del" hidden>Убрать фото</button></div>' +
      '<input id="ap-img" placeholder="…или ссылка на картинку (https://…)">' +
      '<input type="hidden" id="ap-lat"><input type="hidden" id="ap-lng"><input type="hidden" id="ap-ph">' +
      '<button class="btn big primary" id="ap-save" style="margin-top:14px">Предложить 💡</button></div>';

    function setLoc(la, ln, src) {
      $('#ap-lat').value = la; $('#ap-lng').value = ln;
      var city = CITY[cityFor(la, ln)];
      $('#ap-loc').innerHTML = '✅ ' + (+la).toFixed(5) + ', ' + (+ln).toFixed(5) + ' · ' + city.flag + ' ' + city.name + (src ? ' · ' + esc(src) : '');
    }
    function setPhoto(dataUrl) {
      $('#ap-ph').value = dataUrl || '';
      $('#ap-photo').innerHTML = dataUrl ? '<img alt="" src="' + dataUrl + '">' : '<span class="muted small">Нет фото</span>';
      $('#ap-photo-del').hidden = !dataUrl;
    }
    function saveDraft() {
      lsSet('ts_add_draft', { name: $('#ap-name').value, desc: $('#ap-desc').value, cat: $('#ap-cat').value, link: $('#ap-link').value,
        lat: $('#ap-lat').value, lng: $('#ap-lng').value, ph: $('#ap-ph').value, img: $('#ap-img').value });
    }
    var draft = lsGet('ts_add_draft', null);
    if (draft) {
      $('#ap-name').value = draft.name || ''; $('#ap-desc').value = draft.desc || ''; $('#ap-cat').value = draft.cat || 'sight';
      $('#ap-link').value = draft.link || ''; $('#ap-img').value = draft.img || '';
      if (draft.lat && draft.lng) setLoc(draft.lat, draft.lng);
      if (draft.ph) setPhoto(draft.ph);
    }
    if (lat != null) setLoc(lat, lng, 'точка на карте');

    $('#ap-link').oninput = function () {
      var v = $('#ap-link').value;
      if (!v.trim()) { $('#ap-loc').textContent = ''; return; }
      var r = parseLocation(v);
      if (r.ok) {
        setLoc(r.lat, r.lng);
        if (r.name && !$('#ap-name').value.trim()) $('#ap-name').value = r.name;
      } else {
        $('#ap-lat').value = $('#ap-lng').value = '';
        $('#ap-loc').innerHTML = r.short ? '⚠️ Это короткая ссылка — открой её и скопируй координаты, или найди место по названию.' : '⚠️ Не вижу координат. Вставь ссылку целиком или числа вида 1.2816, 103.8636.';
      }
    };
    $('#ap-tap').onclick = function () {
      saveDraft();
      closeSheet(); setView('map'); addMode = true; $('#map-hint').hidden = false;
    };
    $('#ap-search').onclick = function () {
      var qv = $('#ap-name').value.trim() || $('#ap-link').value.trim();
      if (!qv) { toast('Сначала напиши название'); $('#ap-name').focus(); return; }
      $('#ap-res').innerHTML = '<div class="muted small">Ищу «' + esc(qv) + '»…</div>';
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=sg,kr,cn&accept-language=ru,en&q=' + encodeURIComponent(qv))
        .then(function (r) { return r.json(); }).then(function (j) {
          if (!j.length) { $('#ap-res').innerHTML = '<div class="muted small">Ничего не нашлось — попробуй по-английски, вставь координаты или укажи на карте.</div>'; return; }
          $('#ap-res').innerHTML = j.map(function (x) { return '<button class="btn" style="text-align:left;white-space:normal" data-ll="' + x.lat + ',' + x.lon + '">' + esc(x.display_name) + '</button>'; }).join('');
        }).catch(function () { $('#ap-res').innerHTML = '<div class="muted small">Поиск недоступен — вставь координаты или укажи на карте.</div>'; });
    };
    $('#ap-res').onclick = function (e) {
      var b = e.target.closest('[data-ll]'); if (!b) return;
      var ll = b.dataset.ll.split(','); setLoc(ll[0], ll[1], 'найдено поиском');
      $$('#ap-res button').forEach(function (x) { x.classList.toggle('primary', x === b); });
    };
    $('#ap-file').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      $('#ap-photo').innerHTML = '<span class="muted small">Сжимаю фото…</span>';
      compressPhoto(f).then(setPhoto).catch(function () { setPhoto(''); toast('Не получилось открыть фото'); });
    };
    $('#ap-photo-del').onclick = function () { setPhoto(''); };

    $('#ap-save').onclick = function () {
      var name = $('#ap-name').value.trim(), la = parseFloat($('#ap-lat').value), ln = parseFloat($('#ap-lng').value);
      if (isNaN(la) || isNaN(ln)) { toast('Добавь координаты, найди по названию или укажи на карте'); return; }
      if (!name) { toast('Напиши название'); $('#ap-name').focus(); return; }
      var img = $('#ap-img').value.trim(), ph = $('#ap-ph').value;
      if (img && !/^https?:\/\//i.test(img)) img = '';
      var id = uid(), t = now();
      change(function (st) {
        st.c[id] = { name: name, cat: $('#ap-cat').value, desc: $('#ap-desc').value.trim(), lat: la, lng: ln, city: cityFor(la, ln),
          img: img, ph: ph ? 1 : 0, a: S.me.key, c: t, ts: t };
        st.v[S.me.key + '|c-' + id] = [1, t]; // своё предложение — сразу «хочу»
      });
      if (ph) {
        lsSet('ts_blob_' + S.code + '_ph:' + id, ph);
        S.room.publishBlob('ph:' + id, ph);
      }
      lsSet('ts_add_draft', null);
      closeSheet();
      toast('💡 Предложено! У ' + others_ + ' оно будет первым в свайпах');
      openPlace('c-' + id);
    };
  }

  // ——— Ещё ———
  function renderMore() {
    seg($('#more-seg'), [['notes', '📝 Заметки'], ['check', '✅ Чек-лист'], ['tips', '💡 Советы'], ['export', '📤 Экспорт'], ['room', '🔑 Комната']], S.more, function (v) { S.more = v; render(); });
    var el = $('#more-body');
    var draft = $('#gen-note') ? $('#gen-note').value : '';
    if (S.more === 'notes') {
      var all = Object.keys(S.state.n).map(function (id) { return Object.assign({ id: id }, S.state.n[id]); }).filter(function (n) { return !n.x && n.k !== 'check'; });
      var gen = all.filter(function (n) { return !n.p && !n.d; }).sort(function (a, b) { return a.c - b.c; });
      var refd = all.filter(function (n) { return n.p || n.d; }).sort(function (a, b) { return b.c - a.c; });
      el.innerHTML = '<div class="panel"><h3>Общие заметки</h3><p class="muted small">Адреса отелей, брони, идеи, «не забыть». Видят обе.</p><div class="notes" id="gen-notes">' + notesHTML(gen) + '</div>' +
        '<div class="note-form"><textarea id="gen-note" placeholder="Напиши заметку…"></textarea><button class="btn primary" id="gen-add">→</button></div></div>' +
        '<div class="panel"><h3>К местам и дням</h3><div class="notes" id="ref-notes">' + notesHTML(refd, true) + '</div></div>';
      if (draft) $('#gen-note').value = draft;
      $('#gen-add').onclick = function () { var t = $('#gen-note').value.trim(); if (t) { $('#gen-note').value = ''; addNote({ t: t }); } };
      bindNotes($('#gen-notes')); bindNotes($('#ref-notes'));
    } else if (S.more === 'check') {
      var cl = Object.keys(S.state.n).map(function (id) { return Object.assign({ id: id }, S.state.n[id]); }).filter(function (n) { return !n.x && n.k === 'check'; }).sort(function (a, b) { return a.c - b.c; });
      var done = cl.filter(function (n) { return n.done; }).length;
      el.innerHTML = '<div class="panel"><h3>Чек-лист сборов ' + (cl.length ? '· ' + done + '/' + cl.length : '') + '</h3>' +
        (cl.length ? '' : '<p class="muted">Пусто. Можно начать с базового списка для этой поездки.</p><button class="btn primary" id="cl-preset">Добавить базовый список</button>') +
        '<div class="notes" id="cl">' + cl.map(function (n) {
          return '<label class="check ' + (n.done ? 'done' : '') + '"><input type="checkbox" data-id="' + n.id + '" ' + (n.done ? 'checked' : '') + '><span class="ct">' + esc(n.t) +
            (n.done && n.by ? ' <span class="muted small">' + esc(memberAv(n.by)) + '</span>' : '') + '</span><button class="del btn ghost sm" data-del="' + n.id + '">✕</button></label>';
        }).join('') + '</div><div class="note-form"><textarea id="cl-new" placeholder="Новый пункт"></textarea><button class="btn primary" id="cl-add">＋</button></div></div>';
      if ($('#cl-preset')) $('#cl-preset').onclick = function () {
        change(function (st) { TRIP.checklist.forEach(function (t, i) { st.n[uid() + i] = { k: 'check', t: t, a: S.me.key, c: now() + i, ts: now() }; }); });
      };
      $('#cl-add').onclick = function () { var t = $('#cl-new').value.trim(); if (t) addNote({ k: 'check', t: t }); };
      $('#cl').onclick = function (e) {
        var d = e.target.closest('[data-del]');
        if (d) { e.preventDefault(); change(function (st) { st.n[d.dataset.del] = Object.assign({}, st.n[d.dataset.del], { x: 1, ts: now() }); }); }
      };
      $('#cl').onchange = function (e) {
        var id = e.target.dataset.id; if (!id) return;
        change(function (st) { st.n[id] = Object.assign({}, st.n[id], { done: e.target.checked, by: S.me.key, ts: now() }); });
      };
    } else if (S.more === 'tips') {
      el.innerHTML = TIPS.map(function (t, i) {
        return '<details class="tip-sec"' + (i === 0 ? ' open' : '') + '><summary><span>' + t.icon + '</span>' + esc(t.title) + '</summary><ul>' + t.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></details>';
      }).join('') + '<p class="muted small" style="text-align:center">Правила въезда и цены меняются — перепроверьте важное ближе к поездке.</p>';
    } else if (S.more === 'export') {
      renderExport(el);
    } else if (S.more === 'room') {
      renderRoom(el);
    }
  }
  function exportGroups(scope) {
    var groups = [];
    if (scope === 'plan') {
      TRIP.days.forEach(function (d) {
        var its = planItems(d.id).filter(function (x) { return PLACE[x.pid]; }).map(function (x) { return { p: PLACE[x.pid], extra: d.title + (x.time ? ' ' + x.time : '') }; });
        if (its.length) groups.push({ name: d.title + ' · ' + CITY[d.city].name, places: its });
      });
      return groups;
    }
    TRIP.cities.forEach(function (c) {
      var its = ALL.filter(function (p) {
        if (p.city !== c.id) return false;
        if (scope === 'match') return isMatch(p.id);
        if (scope === 'mine') return myVote(p.id) > 0;
        if (scope === 'any') return likers(p.id).length > 0;
        return true;
      }).map(function (p) { return { p: p, extra: likers(p.id).map(function (m) { return m.name; }).join(', ') }; });
      if (its.length) groups.push({ name: c.name, places: its });
    });
    return groups;
  }
  function renderExport(el) {
    var scope = S.exportScope || 'match';
    var groups = exportGroups(scope);
    var n = groups.reduce(function (s, g) { return s + g.places.length; }, 0);
    el.innerHTML = '<div class="panel"><h3>Что выгружаем</h3><div class="seg small-seg" id="ex-scope"></div><p class="muted small">Мест: ' + n + '</p>' +
      '<div class="btn-row"><button class="btn" data-ex="kml">KML · Google My Maps</button><button class="btn" data-ex="gpx">GPX · офлайн-карты</button><button class="btn" data-ex="csv">CSV · таблица</button><button class="btn" data-ex="txt">Скопировать списком</button></div></div>' +
      '<details class="tip-sec" open><summary>🟢 Google Карты — все места разом</summary><ul>' +
      '<li>Скачайте <b>KML</b> кнопкой выше.</li><li>Откройте <b>mymaps.google.com</b> (с компьютера удобнее) → «Создать карту» → «Импорт» → выберите файл. Города станут слоями.</li>' +
      '<li>На телефоне карта появится в Google Maps: <b>Сохранённое → Карты</b>. Можно поделиться ею с подругой.</li></ul></details>' +
      '<details class="tip-sec"><summary>🍎 Apple Карты</summary><ul><li>Apple Карты не умеют импортировать файлы. Откройте место в списке ниже → «Apple Карты» → «Добавить в путеводитель» (Guides). Путеводителем можно поделиться.</li>' +
      '<li>Альтернатива: импортируйте <b>KML</b> в Google My Maps или <b>GPX</b> в Organic Maps — работают и на iPhone.</li></ul></details>' +
      '<details class="tip-sec"><summary>🇰🇷 Naver / KakaoMap</summary><ul><li>Импорта файлов у них нет, но у каждого корейского места в карточке есть кнопки Naver и Kakao — откройте и нажмите ☆ «Сохранить», места соберутся в избранном.</li></ul></details>' +
      '<details class="tip-sec"><summary>📴 Офлайн (Organic Maps / Maps.me)</summary><ul><li>Скачайте <b>GPX</b> или <b>KML</b> и откройте файл в Organic Maps — все точки появятся как метки. Работает без интернета, удобно на пересадках в Китае.</li></ul></details>' +
      '<div class="panel"><h3>Ссылки по каждому месту</h3><div class="list" id="ex-list">' + groups.map(function (g) {
        return '<div class="group-h">' + esc(g.name) + '</div>' + g.places.map(function (it) {
          var p = it.p, L = TripExport.links, k = p.city === 'seoul' || p.city === 'korea';
          return '<div class="note"><b>' + esc(p.name) + '</b><div class="btn-row" style="margin:6px 0 0"><a class="btn sm" target="_blank" rel="noopener" href="' + L.google(p) + '">Google</a><a class="btn sm" target="_blank" rel="noopener" href="' + L.apple(p) + '">Apple</a>' +
            (k ? '<a class="btn sm" target="_blank" rel="noopener" href="' + L.naver(p) + '">Naver</a><a class="btn sm" target="_blank" rel="noopener" href="' + L.kakao(p) + '">Kakao</a>' : '') + '</div></div>';
        }).join('');
      }).join('') + '</div></div>' +
      '<div class="panel"><h3>Резервная копия</h3><p class="muted small">Все голоса, заметки и план в одном файле — на всякий случай.</p><div class="btn-row"><button class="btn" id="bk-save">Скачать копию</button><label class="btn">Загрузить копию<input type="file" id="bk-load" accept=".json,application/json" hidden></label></div></div>';
    seg($('#ex-scope'), [['match', '💞 Мэтчи'], ['mine', '♥ Мои'], ['any', 'Лайки всех'], ['plan', '📅 План'], ['all', 'Всё']], scope, function (v) { S.exportScope = v; render(); });
    var title = 'Трип ' + S.code + ' · ' + ({ match: 'мэтчи', mine: 'лайки ' + S.me.name, any: 'все лайки', plan: 'план', all: 'все места' })[scope];
    $$('[data-ex]', el).forEach(function (b) {
      b.onclick = function () {
        if (!n) { toast('Пока нечего выгружать'); return; }
        var f = 'trip-' + scope;
        if (b.dataset.ex === 'kml') TripExport.download(f + '.kml', TripExport.kml(title, groups), 'application/vnd.google-earth.kml+xml');
        if (b.dataset.ex === 'gpx') TripExport.download(f + '.gpx', TripExport.gpx(title, groups), 'application/gpx+xml');
        if (b.dataset.ex === 'csv') TripExport.download(f + '.csv', TripExport.csv(groups), 'text/csv');
        if (b.dataset.ex === 'txt') copy(title + '\n\n' + TripExport.text(groups));
      };
    });
    $('#bk-save').onclick = function () { TripExport.download('trip-' + S.code + '-backup.json', JSON.stringify({ code: S.code, state: S.state }), 'application/json'); };
    $('#bk-load').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { var j = JSON.parse(t); change(function (st) { mergeInto(st, j.state || j); }); toast('Копия загружена и объединена'); }).catch(function () { toast('Не получилось прочитать файл'); });
    };
  }
  function renderRoom(el) {
    var link = location.origin + location.pathname + '#join=' + S.code;
    var total = ALL.length;
    el.innerHTML = '<div class="panel" style="text-align:center"><div class="muted small">Код вашей комнаты</div><div class="code">' + esc(S.code) + '</div>' +
      '<p class="muted small">Подруга открывает этот сайт, нажимает «Войти по коду» и вводит код — или просто открывает ссылку.</p>' +
      '<div class="btn-row" style="justify-content:center"><button class="btn" id="rm-copy">Скопировать ссылку</button>' + (navigator.share ? '<button class="btn primary" id="rm-share">Отправить</button>' : '') + '</div></div>' +
      '<div class="panel"><h3>Участницы</h3>' + members().map(function (m) {
        var like = 0, sup = 0, nope = 0;
        ALL.forEach(function (p) { var v = voteOf(m.key, p.id); if (v === 1) like++; else if (v === 2) sup++; else if (v < 0) nope++; });
        return '<p><b>' + esc(m.av) + ' ' + esc(m.name) + (m.key === S.me.key ? ' (ты)' : '') + '</b></p><div class="stats"><div><b>' + (like + sup) + '</b><span>хочет</span></div><div><b>' + sup + '</b><span>обязательно</span></div><div><b>' + (total - like - sup - nope) + '</b><span>не смотрела</span></div></div>';
      }).join('') + '<p class="muted small">Общих мэтчей: <b>' + matchIds().length + '</b> · всего мест в базе: ' + total + '</p></div>' +
      '<div class="panel"><h3>Синхронизация</h3><p class="muted small">Подключено к ' + S.status.open + ' из ' + S.status.total + ' серверов. Данные зашифрованы кодом комнаты и сохраняются на нескольких независимых серверах nostr, а ещё — в памяти каждого телефона. Пока хотя бы у одной из вас есть данные, всё восстановится.</p>' +
      '<div class="btn-row"><button class="btn sm" id="rm-sync">Синхронизировать сейчас</button></div></div>' +
      '<div class="panel"><h3>Настройки</h3><div class="btn-row"><button class="btn sm" id="rm-theme">Тема: ' + ({ light: 'светлая', dark: 'тёмная' }[lsGet('ts_theme', '')] || 'как в системе') + '</button>' +
      '<button class="btn sm" id="rm-me">Сменить имя/аватар</button><button class="btn sm" id="rm-leave">Другая комната</button></div></div>';
    $('#rm-copy').onclick = function () { copy(link); };
    if ($('#rm-share')) $('#rm-share').onclick = function () { navigator.share({ title: 'Трип-свайп', text: 'Заходи в нашу комнату! Код: ' + S.code, url: link }).catch(function () {}); };
    $('#rm-sync').onclick = function () { S.room.reconnect(); S.room.publish(function () { return S.state; }); toast('Отправляю…'); };
    $('#rm-theme').onclick = function () {
      var cur = lsGet('ts_theme', ''), next = cur === '' ? 'dark' : cur === 'dark' ? 'light' : '';
      lsSet('ts_theme', next); applyTheme(); if (map) { map.remove(); map = null; lastMapCity = null; } render();
    };
    $('#rm-me').onclick = function () { lsSet('ts_me_' + S.code, null); S.room.close(); S.room = null; showGate(); startWho(S.code, false); };
    $('#rm-leave').onclick = function () { lsSet('ts_current', null); S.room.close(); S.room = null; S.me = null; showGate(); };
  }
  // ——— Музыка ———
  function renderMusicButtons() {
    var st = TripMusic.state(), b = $('#btn-mute');
    b.hidden = !st.tracks.length;
    b.textContent = st.muted ? '🔇' : '🔊';
    b.title = st.muted ? 'Включить музыку' : 'Выключить музыку';
    $('#btn-music').classList.toggle('on', st.playing);
  }
  function openMusic() {
    openSheet('music');
    renderMusicSheet();
  }
  function renderMusicSheet() {
    if (sheetKind !== 'music') return;
    var st = TripMusic.state();
    $('#sheet-body').innerHTML = '<div class="sh-pad"><h2>🎵 Фоновая музыка</h2>' +
      '<p class="muted small">Песни играют по кругу, в случайном порядке. Они хранятся только в памяти этого телефона и никуда не загружаются, поэтому каждая добавляет свои файлы у себя (например, mp3 из «Файлов» или Telegram).</p>' +
      (st.tracks.length ?
        '<button class="btn big ' + (st.muted ? '' : 'primary') + '" id="mu-toggle">' + (st.muted ? '🔇 Музыка выключена — включить' : '🔊 Музыка играет — выключить') + '</button>' +
        '<div class="now">' + (st.currentName ? '<span class="eq' + (st.playing ? ' on' : '') + '"><i></i><i></i><i></i></span> <b>' + esc(st.currentName) + '</b>' : '') +
        '<button class="btn sm" id="mu-next">⏭ Следующая</button></div>' +
        '<label class="vol">🔈<input type="range" id="mu-vol" min="0" max="1" step="0.05" value="' + st.volume + '">🔊</label>' +
        '<div class="sec-h">Плейлист · ' + st.tracks.length + '</div><div class="tracks">' + st.tracks.map(function (t, i) {
          return '<div class="track' + (t.id === st.current ? ' cur' : '') + '"><button class="btn sm ghost" data-play="' + i + '">▶</button><span>' + esc(t.name) + '</span><button class="btn sm ghost" data-del="' + esc(t.id) + '" title="Убрать">✕</button></div>';
        }).join('') + '</div>'
        : '<div class="empty"><span class="big-emo">🎧</span>Пока нет песен — добавь свои mp3</div>') +
      '<label class="btn big" style="margin-top:12px;display:block;text-align:center">＋ Добавить песни<input type="file" id="mu-add" accept="audio/*,.mp3,.m4a" multiple hidden></label></div>';
    var tg = $('#mu-toggle'); if (tg) tg.onclick = function () { TripMusic.setMuted(!TripMusic.state().muted); };
    var nx = $('#mu-next'); if (nx) nx.onclick = function () { TripMusic.next(); };
    var vol = $('#mu-vol'); if (vol) vol.oninput = function () { TripMusic.setVolume(+vol.value); };
    $('#mu-add').onchange = function (e) {
      var files = e.target.files; if (!files.length) return;
      toast('Добавляю…');
      TripMusic.addFiles(files).then(function (n) {
        toast(n ? 'Добавлено песен: ' + n + ' 🎶' : 'Это не похоже на аудиофайлы');
        if (n) TripMusic.setMuted(false);
      }).catch(function () { toast('Не хватило места в памяти браузера'); });
    };
    $$('.tracks [data-play]').forEach(function (b) { b.onclick = function () { TripMusic.playIndex(+b.dataset.play); }; });
    $$('.tracks [data-del]').forEach(function (b) { b.onclick = function () { TripMusic.remove(b.dataset.del); }; });
  }

  function applyTheme() {
    var t = lsGet('ts_theme', '');
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }

  // ——— Старт ———
  function boot() {
    applyTheme();
    $('#btn-create').onclick = function () { startWho(newCode(), true); };
    $('#join-form').onsubmit = function (e) {
      e.preventDefault();
      var c = normCode($('#join-code').value);
      if (c.replace('-', '').length < 8) { toast('Код из 8 символов, например K7PM-2QXA'); return; }
      openRoom(c);
    };
    $('#recent-rooms').onclick = function (e) { var b = e.target.closest('[data-room]'); if (b) openRoom(b.dataset.room); };
    $$('.tabs button').forEach(function (b) { b.onclick = function () { setView(b.dataset.view); }; });
    $('#ctl-like').onclick = function () { swipeTop(1); };
    $('#ctl-nope').onclick = function () { swipeTop(-1); };
    $('#ctl-super').onclick = function () { swipeTop(2); };
    $('#ctl-undo').onclick = undoSwipe;
    $('#ctl-info').onclick = function () { var t = $('#deck .card:not(.under)'); if (t) openPlace(t.dataset.id); };
    $('#sheet-back').onclick = closeSheet;
    $('#room-pill').onclick = function () { S.more = 'room'; setView('more'); };
    $('#list-search').oninput = function () { renderLists(); };
    $('#btn-random').onclick = function () {
      var pool = ALL.filter(function (p) { return inCity(p, S.listCity) && isMatch(p.id); });
      if (!pool.length) pool = ALL.filter(function (p) { return inCity(p, S.listCity) && myVote(p.id) > 0; });
      if (!pool.length) { toast('Сначала полайкайте места 🙂'); return; }
      openPlace(pool[Math.floor(Math.random() * pool.length)].id);
    };
    $('#btn-add-place').onclick = function () { openAddPlace(null, null); };
    $('#btn-suggest').onclick = function () { openAddPlace(null, null); };
    $('#btn-music').onclick = openMusic;
    $('#btn-mute').onclick = function () { TripMusic.setMuted(!TripMusic.state().muted); };
    TripMusic.onChange(function () { renderMusicButtons(); renderMusicSheet(); });
    renderMusicButtons();
    $('#map-hint-cancel').onclick = function () { addMode = false; $('#map-hint').hidden = true; };
    document.addEventListener('keydown', function (e) {
      if (S.view !== 'swipe' || !$('#sheet').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') swipeTop(1);
      else if (e.key === 'ArrowLeft') swipeTop(-1);
      else if (e.key === 'ArrowUp') swipeTop(2);
      else if (e.key === 'Backspace') undoSwipe();
    });
    window.addEventListener('hashchange', function () {
      var h = location.hash.match(/join=([A-Za-z0-9-]+)/);
      if (h && normCode(h[1]) !== S.code) openRoom(h[1]);
    });

    var hash = location.hash.match(/join=([A-Za-z0-9-]+)/);
    var cur = lsGet('ts_current', null);
    if (hash) openRoom(hash[1]);
    else if (cur && lsGet('ts_me_' + cur, null)) openRoom(cur);
    else showGate();
  }
  boot();
})();
