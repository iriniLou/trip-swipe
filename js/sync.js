// Синхронизация комнаты без своего сервера.
// Состояние комнаты шифруется кодом комнаты (AES-GCM) и хранится на публичных nostr-релеях
// как заменяемое событие kind 30078. Каждое устройство публикует ВСЁ, что знает о комнате,
// а при получении данные сливаются по принципу «последняя запись побеждает» — поэтому
// даже если какой-то релей потеряет данные, они восстановятся с любого устройства.
(function () {
  var RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://relay.snort.social',
    'wss://nostr.mom',
    'wss://offchain.pub'
  ];
  var KIND = 30078;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function b64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function pipe(bytes, stream) {
    var res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  var canZip = typeof CompressionStream !== 'undefined';

  function getSecretKey() {
    var sk = null;
    try { sk = localStorage.getItem('ts_sk'); } catch (e) {}
    if (!sk) {
      sk = hex(NostrTools.generateSecretKey());
      try { localStorage.setItem('ts_sk', sk); } catch (e) {}
    }
    return new Uint8Array(sk.match(/.{2}/g).map(function (h) { return parseInt(h, 16); }));
  }

  function Room(code, handlers) {
    this.code = code;
    this.h = handlers; // { onState(state), onStatus(status) }
    this.sockets = {};
    this.ok = {};
    this.lastCreated = 0;
    this.pending = null;
    this.blobEvents = {};
    this.blobWant = {};
    this.sk = getSecretKey();
    this.pub = NostrTools.getPublicKey(this.sk);
    this.ready = this._derive();
  }

  Room.prototype._derive = async function () {
    var norm = this.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.tag = hex(await crypto.subtle.digest('SHA-256', enc.encode('trip-swipe-v1|room|' + norm))).slice(0, 40);
    var base = await crypto.subtle.importKey('raw', enc.encode(norm), 'PBKDF2', false, ['deriveKey']);
    this.key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('trip-swipe-v1|salt'), iterations: 120000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };

  Room.prototype._encrypt = async function (obj) {
    var bytes = enc.encode(JSON.stringify(obj)), flag = 'p';
    if (canZip) { bytes = await pipe(bytes, new CompressionStream('gzip')); flag = 'z'; }
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, this.key, bytes));
    return 'v1' + flag + ':' + b64(iv) + ':' + b64(ct);
  };

  Room.prototype._decrypt = async function (content) {
    var parts = content.split(':');
    if (parts.length !== 3 || parts[0].slice(0, 2) !== 'v1') return null;
    var flag = parts[0].charAt(2);
    var pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parts[1]) }, this.key, unb64(parts[2])));
    if (flag === 'z') {
      if (!canZip) return null;
      pt = await pipe(pt, new DecompressionStream('gzip'));
    }
    return JSON.parse(dec.decode(pt));
  };

  Room.prototype.connect = async function () {
    await this.ready;
    var self = this;
    RELAYS.forEach(function (url) { self._open(url, 0); });
    if (!this._vis) {
      this._vis = function () { if (document.visibilityState === 'visible') self.reconnect(); };
      document.addEventListener('visibilitychange', this._vis);
      window.addEventListener('online', this._vis);
    }
  };

  Room.prototype.reconnect = function () {
    var self = this;
    RELAYS.forEach(function (url) {
      var ws = self.sockets[url];
      if (!ws || ws.readyState > 1) self._open(url, 0);
    });
  };

  Room.prototype._open = function (url, attempt) {
    var self = this, ws;
    try { ws = new WebSocket(url); } catch (e) { return; }
    this.sockets[url] = ws;
    var subId = 'ts' + Math.random().toString(36).slice(2, 8);
    ws.onopen = function () {
      ws.send(JSON.stringify(['REQ', subId, { kinds: [KIND], '#d': [self.tag], limit: 100 }]));
      self._status();
      if (self.lastEvent) ws.send(JSON.stringify(['EVENT', self.lastEvent]));
      Object.values(self.blobEvents).forEach(function (ev) { ws.send(JSON.stringify(['EVENT', ev])); });
      var want = Object.keys(self.blobWant);
      if (want.length) self._reqBlobs(ws, want);
    };
    ws.onmessage = function (m) {
      var msg; try { msg = JSON.parse(m.data); } catch (e) { return; }
      if (msg[0] === 'EVENT' && msg[2] && msg[2].kind === KIND) self._incoming(msg[2]);
      else if (msg[0] === 'OK') { self.ok[url] = msg[2] ? Date.now() : -1; self._status(); }
      else if (msg[0] === 'EOSE') { self.h.onSynced && self.h.onSynced(url); }
    };
    ws.onclose = function () {
      self._status();
      if (self.closed) return;
      var delay = Math.min(30000, 2000 * Math.pow(2, attempt));
      setTimeout(function () {
        if (!self.closed && document.visibilityState === 'visible' && self.sockets[url] === ws) self._open(url, attempt + 1);
      }, delay);
    };
    ws.onerror = function () {};
  };

  Room.prototype._incoming = async function (ev) {
    var d = ((ev.tags || []).filter(function (t) { return t[0] === 'd'; })[0] || [])[1];
    if (!d || (d !== this.tag && d.indexOf(this.tag + ':') !== 0)) return;
    this.seen = this.seen || {};
    if (this.seen[ev.id]) return;
    this.seen[ev.id] = 1;
    try {
      var data = await this._decrypt(ev.content);
      if (!data) return;
      if (d === this.tag) this.h.onState(data, ev.pubkey === this.pub);
      else if (this.h.onBlob) this.h.onBlob(d.slice(this.tag.length + 1), data.v);
    } catch (e) { /* чужое или битое событие — пропускаем */ }
  };

  // Отдельные зашифрованные записи для тяжёлых данных (фото предложенных мест), ключ — например «ph:abc123»
  Room.prototype._reqBlobs = function (ws, keys) {
    var self = this;
    ws.send(JSON.stringify(['REQ', 'tb' + Math.random().toString(36).slice(2, 8),
      { kinds: [KIND], '#d': keys.map(function (k) { return self.tag + ':' + k; }), limit: keys.length * 3 }]));
  };
  Room.prototype.wantBlobs = async function (keys) {
    await this.ready;
    var self = this, fresh = keys.filter(function (k) { return !self.blobWant[k]; });
    if (!fresh.length) return;
    fresh.forEach(function (k) { self.blobWant[k] = 1; });
    Object.values(this.sockets).forEach(function (ws) { if (ws.readyState === 1) self._reqBlobs(ws, fresh); });
  };
  Room.prototype.gotBlob = function (key) { delete this.blobWant[key]; };
  Room.prototype.publishBlob = async function (key, value) {
    await this.ready;
    var ev = NostrTools.finalizeEvent({
      kind: KIND, created_at: Math.floor(Date.now() / 1000),
      tags: [['d', this.tag + ':' + key], ['client', 'trip-swipe']],
      content: await this._encrypt({ v: value })
    }, this.sk);
    this.blobEvents[key] = ev;
    var raw = JSON.stringify(['EVENT', ev]);
    Object.values(this.sockets).forEach(function (ws) { if (ws.readyState === 1) ws.send(raw); });
  };

  Room.prototype.publish = function (state) {
    var self = this;
    clearTimeout(this.pending);
    this.pending = setTimeout(function () { self._publishNow(state()); }, 1200);
  };

  Room.prototype._publishNow = async function (state) {
    await this.ready;
    var created = Math.max(Math.floor(Date.now() / 1000), this.lastCreated + 1);
    this.lastCreated = created;
    var ev = NostrTools.finalizeEvent({
      kind: KIND, created_at: created,
      tags: [['d', this.tag], ['client', 'trip-swipe']],
      content: await this._encrypt(state)
    }, this.sk);
    this.lastEvent = ev;
    var raw = JSON.stringify(['EVENT', ev]);
    Object.values(this.sockets).forEach(function (ws) { if (ws.readyState === 1) ws.send(raw); });
    this.h.onPublished && this.h.onPublished();
  };

  Room.prototype._status = function () {
    var self = this, open = 0;
    Object.values(this.sockets).forEach(function (ws) { if (ws.readyState === 1) open++; });
    var saved = Object.values(this.ok).filter(function (t) { return t > 0; }).length;
    this.h.onStatus && this.h.onStatus({ open: open, total: RELAYS.length, saved: saved });
  };

  Room.prototype.close = function () {
    this.closed = true;
    Object.values(this.sockets).forEach(function (ws) { try { ws.close(); } catch (e) {} });
    if (this._vis) {
      document.removeEventListener('visibilitychange', this._vis);
      window.removeEventListener('online', this._vis);
    }
  };

  window.TripSync = { Room: Room, RELAYS: RELAYS };
})();
