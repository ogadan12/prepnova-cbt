// Access codes: a code decrypts a small bundle that holds the subject keys.
// A subject key decrypts that subject's paid question file. All in the browser.
(function (g) {
  'use strict';
  var ITER = 200000, KEY = 'jcbt.access';
  var te = new TextEncoder(), td = new TextDecoder();
  var unb64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var norm = function (c) { return String(c).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  var hex = function (buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); };
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  var write = function (o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  var alive = function (exp) { return Date.now() <= Date.parse(exp + 'T23:59:59Z'); };

  async function open(rawKey, blob) {
    var key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
    return JSON.parse(td.decode(pt));
  }

  var Access = {
    entry: function (sid) {
      var a = read(), e = a[sid];
      if (e && alive(e.exp)) return e;
      if (e) { delete a[sid]; write(a); }
      return null;
    },
    getKey: function (sid) { var e = Access.entry(sid); return e ? e.key : null; },
    expiry: function (sid) { var e = Access.entry(sid); return e ? e.exp : null; },
    has: function (sid) { return !!Access.getKey(sid); },
    clear: function () { write({}); },
    decrypt: function (keyB64, blob) { return open(unb64(keyB64), blob); },
    redeem: async function (code) {
      if (!g.crypto || !g.crypto.subtle) throw new Error('Open this site with https:// so codes can work.');
      var n = norm(code);
      if (n.length !== 12) throw new Error('A code has 12 letters and numbers, like ABCD-EFGH-JKLM.');
      var codes;
      try {
        var r = await fetch('codes.json?t=' + Date.now(), { cache: 'no-store' });
        codes = await r.json();
      } catch (e) { throw new Error('Could not check the code. Check your internet and try again.'); }
      var id = hex(await crypto.subtle.digest('SHA-256', te.encode('jcbt-id:' + n))).slice(0, 24);
      var rec = codes[id];
      var bad = new Error('That code is not valid. Check it and try again.');
      if (!rec) throw bad;
      var base = await crypto.subtle.importKey('raw', te.encode(n), 'PBKDF2', false, ['deriveBits']);
      var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(rec.salt), iterations: ITER, hash: 'SHA-256' }, base, 256);
      var bundle;
      try { bundle = await open(new Uint8Array(bits), rec); } catch (e) { throw bad; }
      if (!alive(bundle.exp)) throw new Error('This code expired on ' + bundle.exp + '. Message us to renew it.');
      var a = read();
      Object.keys(bundle.keys).forEach(function (s) {
        var old = a[s];
        if (!old || !alive(old.exp) || old.exp < bundle.exp) a[s] = { key: bundle.keys[s], exp: bundle.exp };
      });
      write(a);
      return { subjects: Object.keys(bundle.keys), exp: bundle.exp };
    }
  };
  g.Access = Access;
})(typeof window !== 'undefined' ? window : globalThis);
