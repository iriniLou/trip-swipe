// Фоновая музыка. Песни хранятся только в памяти этого устройства (IndexedDB) и никуда не загружаются:
// сайт публичный, поэтому чужие mp3 в репозиторий не кладём — каждая добавляет свои файлы у себя.
(function () {
  var DB = 'trip-music', STORE = 'tracks';
  var audio = new Audio();
  audio.preload = 'auto';
  var tracks = [], order = [], pos = 0, url = null, started = false, listeners = [];

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var muted = lsGet('ts_music_muted', false);
  audio.volume = lsGet('ts_music_vol', 0.5);

  function db() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  // «Stray Kids - Chk Chk Boom.mp3» → «Chk Chk Boom»; «1629806582_stray-kids-red-lights-...» → «Red Lights Bang Chan Hyunjin»
  function prettyName(file) {
    var n = file.replace(/\.[a-z0-9]+$/i, '').replace(/^\d{6,}[_-]/, '');
    n = n.replace(/^stray[\s_-]*kids\s*[-–—_]\s*/i, '').replace(/^stray-kids-/i, '');
    if (!/\s/.test(n)) n = n.replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return n.trim() || file;
  }

  function shuffle() {
    order = tracks.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = order[i]; order[i] = order[j]; order[j] = x; }
    pos = 0;
  }
  function load(i) {
    var t = tracks[order[i]]; if (!t) return;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(t.blob);
    audio.src = url;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: 'Stray Kids', album: 'Трип-свайп' });
    }
  }
  function play() {
    if (!tracks.length || muted) return;
    if (!audio.src) load(pos);
    audio.play().then(function () { started = true; emit(); }).catch(function () { emit(); });
  }
  function next() {
    if (!tracks.length) return;
    pos++;
    if (pos >= order.length) shuffle(); // плейлист по кругу, каждый круг — новый порядок
    load(pos);
    if (!muted) play(); else emit();
  }
  audio.addEventListener('ended', next);
  audio.addEventListener('error', function () { if (tracks.length > 1) next(); });
  audio.addEventListener('play', emit);
  audio.addEventListener('pause', emit);
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('play', function () { setMuted(false); });
      navigator.mediaSession.setActionHandler('pause', function () { setMuted(true); });
    } catch (e) {}
  }

  function refresh() {
    return tx('readonly', function (st) { return st.getAll(); }).then(function (all) {
      tracks = (all || []).sort(function (a, b) { return a.added - b.added; });
      if (order.length !== tracks.length) { shuffle(); audio.removeAttribute('src'); }
      emit();
    }).catch(function () { tracks = []; emit(); });
  }

  function addFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^audio\//.test(f.type) || /\.(mp3|m4a|aac|ogg|wav)$/i.test(f.name); });
    var now = Date.now();
    return tx('readwrite', function (st) {
      list.forEach(function (f, i) { st.put({ id: f.name + '|' + f.size, name: prettyName(f.name), blob: f, added: now + i }); });
    }).then(function () { return refresh(); }).then(function () { return list.length; });
  }
  function remove(id) {
    var cur = tracks[order[pos]];
    return tx('readwrite', function (st) { st.delete(id); }).then(function () {
      if (cur && cur.id === id) { audio.pause(); audio.removeAttribute('src'); }
      return refresh();
    });
  }
  function setMuted(m) {
    muted = m; lsSet('ts_music_muted', m);
    if (m) audio.pause(); else play();
    emit();
  }
  function playIndex(i) {
    // поставить выбранную песню следующей в текущем круге и включить
    var k = order.indexOf(i); if (k < 0) return;
    order.splice(k, 1); order.splice(pos, 0, i);
    load(pos); setMuted(false);
  }

  // Браузеры не дают играть звук без касания — запускаем при первом нажатии где угодно
  function firstTouch() {
    if (!started && !muted && tracks.length) play();
  }
  document.addEventListener('pointerdown', firstTouch, true);
  document.addEventListener('keydown', firstTouch, true);

  refresh();

  window.TripMusic = {
    addFiles: addFiles, remove: remove, next: next, playIndex: playIndex,
    setMuted: setMuted,
    setVolume: function (v) { audio.volume = v; lsSet('ts_music_vol', v); },
    onChange: function (f) { listeners.push(f); },
    state: function () {
      var cur = tracks[order[pos]];
      return { tracks: tracks.slice(), muted: muted, playing: !audio.paused, current: cur ? cur.id : null, currentName: cur ? cur.name : '', volume: audio.volume };
    }
  };
})();
