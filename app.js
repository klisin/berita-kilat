/* Berita Kilat — link berita → gambar judul + caption 5W+1H
   Semua berjalan di browser. API key disimpan di localStorage pengguna. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ---------- Penyimpanan aman ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bk_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('bk_' + k, JSON.stringify(v)); return true; } catch { return false; } }
  };

  // ---------- State ----------
  const state = {
    fmt: store.get('fmt', '4:5'),
    photo: null,       // HTMLImageElement
    logo: null,        // HTMLImageElement
    logoData: null,    // data URL logo (untuk disimpan/preset)
    article: { url: '', title: '', site: '', date: '', image: '', description: '', body: '', author: '', section: '' }
  };
  const SIZES = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920] };

  // ---------- Pengaturan ----------
  const FX_IDS = ['sLogoFx', 'sLogoFxAmt', 'sLogoContrast', 'sLogoBright'];
  const settingIds = ['sName', 'sHandle', 'sAccent', 'sPanel', 'sFont', 'sDateline', 'sBrandMode', 'sLogoScale', ...FX_IDS, 'sProxy', 'wpSite'];
  const optIds = ['engine', 'length', 'platform', 'style', 'vStyle', 'vFontScale'];
  // Isi preset akun media (API key sengaja tidak ikut)
  const PRESET_IDS = ['sName', 'sHandle', 'sAccent', 'sPanel', 'sFont', 'sDateline', 'sBrandMode', 'sLogoScale', ...FX_IDS, 'style', 'vStyle', 'vFontScale', 'platform', 'wpSite'];
  // Data rahasia yang boleh ikut ekspor bila dicentang (daftar tetap: impor tidak bisa menulis kunci lain)
  const SECRET_KEYS = ['aiKeys', 'aiModels', 'engine', 'jinaKey', 'pixabayKey', 'pexelsKey', 'fPreferVideo', 'wpSites', 'wpSite'];
  const MERGE_KEYS = ['aiKeys', 'aiModels', 'wpSites']; // objek: digabung dengan yang sudah ada, bukan ditimpa
  function loadSettings() {
    settingIds.concat(optIds).forEach((id) => { const v = store.get(id, null); if (v !== null) $(id).value = v; });
    const logo = store.get('logo', null);
    // Pengguna lama: logo sudah ada tetapi mode belum pernah disimpan → tetap tampilkan logo
    if (logo && store.get('sBrandMode', null) === null) $('sBrandMode').value = 'logo';
    if (logo) setLogoData(logo, false).then(draw);
    setBrandMode($('sBrandMode').value);
    applyAccent();
    renderPresets();
  }
  const defaultOf = (el) => el.tagName === 'SELECT' ? (el.querySelector('option[selected]') || el.options[0]).value : el.defaultValue;
  async function setLogoData(data, persist = true) {
    state.logoData = data || null;
    state.logo = null;
    if (data) { try { state.logo = await loadImage(data); } catch { state.logo = null; } }
    if (persist && !store.set('logo', state.logoData)) presetMsg('Penyimpanan browser penuh — logo tidak tersimpan permanen.', true);
    showLogoPreview(state.logo ? data : null);
  }

  // ---------- Preset akun media ----------
  const getPresets = () => { const p = store.get('presets', {}); return p && typeof p === 'object' ? p : {}; };
  function presetMsg(msg, err) { const el = $('presetMsg'); el.textContent = msg || ''; el.style.color = err ? '#dc2626' : ''; }
  function renderPresets() {
    const all = getPresets(), names = Object.keys(all).sort((a, b) => a.localeCompare(b, 'id'));
    const active = store.get('activePreset', '');
    const fill = (sel, placeholder) => {
      sel.innerHTML = '';
      const o0 = document.createElement('option'); o0.value = ''; o0.textContent = placeholder; sel.appendChild(o0);
      names.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
      sel.value = names.includes(active) ? active : '';
    };
    fill($('presetSel'), names.length ? '— pilih preset —' : '(belum ada preset)');
    fill($('presetQuick'), 'Akun media…');
    $('presetQuick').hidden = !names.length;
  }
  function snapshot() {
    const o = {}; PRESET_IDS.forEach((id) => { o[id] = $(id).value; });
    o.logo = state.logoData; o.savedAt = new Date().toISOString();
    return o;
  }
  function writePreset(name, data) {
    const all = getPresets(); all[name] = data;
    if (!store.set('presets', all)) { presetMsg('Penyimpanan browser penuh. Hapus preset lain atau pakai logo berukuran lebih kecil.', true); return false; }
    store.set('activePreset', name); renderPresets(); return true;
  }
  async function applyPreset(name) {
    const p = getPresets()[name]; if (!p) return;
    PRESET_IDS.forEach((id) => { const el = $(id); el.value = p[id] != null ? p[id] : defaultOf(el); });
    await setLogoData(p.logo || null);
    setBrandMode($('sBrandMode').value);
    store.set('activePreset', name); saveSettings(); renderPresets(); draw();
    if (window.BKVideo) window.BKVideo.refresh();
    if (window.BKWP) window.BKWP.refresh(); // tiap preset bisa terhubung ke website berbeda
    presetMsg(`Preset "${name}" dipakai.`);
    status(`Akun media: <b>${escapeHtml(name)}</b>`, 'ok');
  }
  function setBrandMode(mode) {
    if (!['text', 'logo', 'both'].includes(mode)) mode = 'text';
    $('sBrandMode').value = mode;
    document.querySelectorAll('#brandSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    $('logoBox').hidden = mode === 'text';
  }
  function showLogoPreview(src) {
    const box = $('logoPrev'); box.innerHTML = '';
    if (!src) { box.innerHTML = '<span class="muted">Belum ada logo</span>'; return; }
    const im = document.createElement('img'); im.src = src; im.alt = 'Logo media'; box.appendChild(im);
  }
  // Kecilkan logo besar agar muat di localStorage (batas ±5 MB)
  async function prepLogo(f) {
    const raw = await fileToDataUrl(f);
    const im = await loadImage(raw);
    const max = 800, r = Math.min(1, max / Math.max(im.width || max, im.height || max));
    if (r === 1 && f.size < 300000) return raw;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((im.width || max) * r)); c.height = Math.max(1, Math.round((im.height || max) * r));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  function saveSettings() { settingIds.concat(optIds).forEach((id) => store.set(id, $(id).value)); applyAccent(); }
  function applyAccent() { document.documentElement.style.setProperty('--accent', $('sAccent').value || '#e11d48'); }
  const S = () => ({
    name: $('sName').value.trim() || 'MEDIA ANDA',
    handle: $('sHandle').value.trim(),
    accent: $('sAccent').value || '#e11d48',
    panel: $('sPanel').value || '#0f172a',
    font: $('sFont').value || 'Inter',
    dateline: $('sDateline').value.trim(),
    mode: $('sBrandMode').value || 'text',
    logoScale: parseFloat($('sLogoScale').value) || 1,
    fx: $('sLogoFx').value || 'none',
    fxAmt: parseFloat($('sLogoFxAmt').value) || 0.6,
    contrast: parseFloat($('sLogoContrast').value) || 1,
    bright: parseFloat($('sLogoBright').value) || 1
  });

  // ---------- Status ----------
  function status(msg, kind = '') {
    const el = $('status');
    if (!msg) { el.hidden = true; return; }
    el.hidden = false; el.className = 'status ' + kind; el.innerHTML = msg;
  }

  // ---------- Pengambilan halaman via proxy CORS ----------
  function proxies() {
    const list = [];
    const custom = $('sProxy').value.trim();
    if (custom) list.push((u) => custom + encodeURIComponent(u));
    list.push(
      (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
      (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
      (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u)
    );
    return list;
  }
  async function fetchWithTimeout(url, opts = {}, ms = 15000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(t); }
  }
  // Semua proxy dicoba bersamaan; yang pertama berhasil dipakai (tidak menunggu satu per satu gagal)
  async function fetchHtml(url) {
    const tries = proxies().map(async (p) => {
      const r = await fetchWithTimeout(p(url), {}, 9000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      if (txt && txt.length > 500 && /<html|<meta|<title/i.test(txt)) return txt;
      throw new Error('bukan HTML');
    });
    try { return await Promise.any(tries); } catch { return null; }
  }
  async function fetchJina(url) {
    try {
      const headers = { 'Accept': 'text/plain' };
      const key = (store.get('jinaKey', '') || '').trim(); // opsional, mengurangi pembatasan akses anonim
      if (key) headers.Authorization = 'Bearer ' + key;
      const r = await fetchWithTimeout('https://r.jina.ai/' + url, { headers }, 25000);
      if (!r.ok) return null;
      return await r.text();
    } catch { return null; }
  }

  // ---------- Ekstraksi artikel ----------
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  function meta(doc, ...names) {
    for (const n of names) {
      const el = doc.querySelector(`meta[property="${n}"],meta[name="${n}"],meta[itemprop="${n}"]`);
      if (el && el.content) return clean(el.content);
    }
    return '';
  }
  function jsonLd(doc) {
    const out = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent);
        const walk = (o) => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) return o.forEach(walk);
          if (o['@graph']) walk(o['@graph']);
          const t = [].concat(o['@type'] || []).join(' ');
          if (/Article|Posting|Report/i.test(t)) out.push(o);
        };
        walk(j);
      } catch {}
    });
    return out[0] || null;
  }
  const JUNK = /^(baca juga|simak juga|lihat juga|baca selengkapnya|dapatkan update|ikuti kami|follow|klik|download|unduh aplikasi|artikel ini|editor\s*:|penulis\s*:|sumber\s*:|copyright|©|tonton|saksikan|video)/i;
  function articleRoot(doc) {
    const sels = ['[itemprop="articleBody"]', '.read__content', '.detail__body-text', '.detail-text', '.post-content', '.entry-content',
      '.article-content', '.article__content', '.content-detail', '.itp_bodycontent', '.txt-article', '.detail_text', 'article', 'main'];
    for (const s of sels) { const el = doc.querySelector(s); if (el && el.querySelectorAll('p').length >= 2) return el; }
    return doc.body;
  }
  // Foto lain di dalam artikel (untuk footage video): buang logo/ikon/iklan/gambar kecil
  const IMG_JUNK = /logo|icon|avatar|sprite|pixel|banner|ads?[\/_-]|placeholder|loading|blank|emoji|\.svg|\.gif/i;
  function articleImages(doc, abs, main) {
    const root = articleRoot(doc) || doc.body;
    const out = [];
    const add = (u) => { u = abs((u || '').trim()); if (u && /^https?:/.test(u) && !IMG_JUNK.test(u) && !out.includes(u)) out.push(u); };
    if (main) add(main);
    (root ? root.querySelectorAll('img') : []).forEach((im) => {
      if (im.closest('aside,nav,footer,header,.related,.ads,[class*="related"],[class*="share"],[class*="author"]')) return;
      const w = parseInt(im.getAttribute('width') || '0', 10);
      if (w && w < 300) return;
      const set = im.getAttribute('data-srcset') || im.getAttribute('srcset') || '';
      const big = set ? set.split(',').map((x) => x.trim().split(/\s+/)[0]).pop() : '';
      add(im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('data-original') || big || im.getAttribute('src'));
    });
    return out.slice(0, 12);
  }
  function bodyFromDom(doc) {
    const root = articleRoot(doc);
    if (!root) return '';
    const paras = [];
    root.querySelectorAll('p').forEach((p) => {
      if (p.closest('aside,nav,footer,figure,figcaption,.baca-juga,.related,.ads,[class*="related"],[class*="share"]')) return;
      const t = clean(p.textContent);
      if (t.length < 40 || JUNK.test(t)) return;
      if (!paras.includes(t)) paras.push(t);
    });
    return paras.join('\n\n');
  }
  function parseHtml(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ld = jsonLd(doc);
    const abs = (u) => { try { return new URL(u, url).href; } catch { return u || ''; } };
    let image = meta(doc, 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src');
    if (!image && ld && ld.image) { const im = [].concat(ld.image)[0]; image = typeof im === 'string' ? im : (im.url || ''); }
    let author = meta(doc, 'author', 'article:author', 'content_author');
    if (!author && ld && ld.author) { const a = [].concat(ld.author)[0]; author = typeof a === 'string' ? a : (a.name || ''); }
    let body = (ld && ld.articleBody) ? clean(ld.articleBody) : '';
    const domBody = bodyFromDom(doc);
    if (domBody.length > body.length * 0.8) body = domBody;
    return {
      url,
      title: meta(doc, 'og:title', 'twitter:title') || clean(ld && ld.headline) || clean(doc.title),
      site: meta(doc, 'og:site_name') || new URL(url).hostname.replace(/^www\./, ''),
      date: meta(doc, 'article:published_time', 'datePublished', 'pubdate', 'publishdate', 'content_PublishedDate') || (ld && ld.datePublished) || '',
      image: abs(image),
      description: meta(doc, 'og:description', 'description', 'twitter:description'),
      body,
      author: clean(author),
      section: meta(doc, 'article:section', 'content_category', 'section') || (ld && clean([].concat(ld.articleSection || [])[0])) || '',
      images: articleImages(doc, abs, image)
    };
  }
  function parseJina(txt, url) {
    const get = (k) => { const m = txt.match(new RegExp('^' + k + ':\\s*(.+)$', 'm')); return m ? m[1].trim() : ''; };
    const content = txt.split(/Markdown Content:\s*/)[1] || txt;
    const img = (content.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/) || [])[1] || '';
    const paras = content.split(/\n{2,}/).map((p) => clean(p.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>`]/g, '')))
      .filter((p) => p.length > 60 && !JUNK.test(p));
    return {
      url, title: get('Title'), site: new URL(url).hostname.replace(/^www\./, ''), date: get('Published Time'),
      image: img, description: paras[0] || '', body: paras.join('\n\n'), author: '', section: '',
      images: [...new Set([...content.matchAll(/!\[[^\]]*\]\((https?:[^)\s]+)\)/g)].map((m) => m[1]))].filter((u) => !IMG_JUNK.test(u)).slice(0, 12)
    };
  }

  // ---------- Gambar ----------
  // URL blob: dilepas setelah gambar ter-decode (gambar tetap bisa digambar) agar memori tidak menumpuk
  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      const free = () => { if (/^blob:/.test(src)) URL.revokeObjectURL(src); };
      im.onload = () => { free(); res(im); }; im.onerror = (e) => { free(); rej(e); };
      im.src = src;
    });
  }
  // Thumbnail kecil (data URL) dari gambar/video yang sudah dimuat, untuk pratinjau di UI
  function thumb(el, size = 128) {
    if (!el) return '';
    try {
      const c = document.createElement('canvas'); c.width = c.height = size;
      withCtx(c.getContext('2d'), () => drawCover(el, 0, 0, size, size, 0.4));
      return c.toDataURL('image/jpeg', 0.7);
    } catch { return ''; }
  }
  // Nama file dari judul gambar, dipakai untuk PNG, video, dan file yang dibagikan
  const slug = (fallback = 'posting') => ($('headline').value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/^-|-$/g, '') || fallback;
  async function loadRemoteImage(url) {
    const tries = [
      'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')) + '&w=2000&output=jpg&q=90',
      ...proxies().map((p) => p(url))
    ];
    for (const t of tries) {
      try {
        const r = await fetchWithTimeout(t, {}, 20000);
        if (!r.ok) continue;
        const b = await r.blob();
        if (!b.type.startsWith('image/') && b.size < 5000) continue;
        return await loadImage(URL.createObjectURL(b));
      } catch {}
    }
    throw new Error('Foto tidak bisa diambil');
  }
  const fileToDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

  // ---------- Tanggal ----------
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function fmtDate(s, short) {
    const d = s ? new Date(s) : null;
    if (!d || isNaN(d)) return s || '';
    const m = BULAN[d.getMonth()];
    return `${d.getDate()} ${short ? m.slice(0, 3) : m} ${d.getFullYear()}`;
  }

  // ---------- Kanvas ----------
  const cv = $('cv');
  let ctx = cv.getContext('2d');
  // Arahkan sementara semua helper menggambar ke canvas lain (dipakai video.js)
  function withCtx(c, fn) { const prev = ctx; ctx = c; try { return fn(); } finally { ctx = prev; } }
  function wrap(text, maxW) {
    const words = text.split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function fitText(text, font, weight, maxW, maxH, start, min, lh) {
    let size = start;
    for (; size >= min; size -= 2) {
      ctx.font = `${weight} ${size}px "${font}"`;
      const lines = wrap(text, maxW);
      if (lines.length * size * lh <= maxH) return { size, lines };
    }
    ctx.font = `${weight} ${min}px "${font}"`;
    return { size: min, lines: wrap(text, maxW) };
  }
  function drawCover(im, x, y, w, h, fy) {
    const r = Math.max(w / im.width, h / im.height);
    const iw = im.width * r, ih = im.height * r;
    const ox = x + (w - iw) / 2;
    const oy = y + (h - ih) * fy;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(im, ox, oy, iw, ih); ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // ---------- Efek logo ----------
  // Logo hasil olahan kontras/kecerahan/putih, disimpan di cache agar tidak dihitung ulang tiap gambar
  const logoCache = { img: null, key: '', canvas: null, sil: null };
  function logoSource(s) {
    const im = state.logo, key = [s.contrast, s.bright, s.fx === 'white'].join('|');
    if (logoCache.img === im && logoCache.key === key) return logoCache.canvas;
    const c = document.createElement('canvas');
    c.width = im.naturalWidth || im.width || 400; c.height = im.naturalHeight || im.height || 400;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    let out = c;
    try {
      const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        if (s.fx === 'white') { px[i] = px[i + 1] = px[i + 2] = 255; }
        else if (s.contrast !== 1 || s.bright !== 1) {
          for (let k = 0; k < 3; k++) px[i + k] = ((px[i + k] / 255 - 0.5) * s.contrast + 0.5) * 255 * s.bright;
        }
        if (px[i + 3] > 8) { const x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      g.putImageData(d, 0, 0);
      // Buang tepi transparan agar plat/efek pas dengan logo
      if (x1 >= x0 && (x0 > 0 || y0 > 0 || x1 < c.width - 1 || y1 < c.height - 1)) {
        out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
        out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      }
    } catch {}
    Object.assign(logoCache, { img: im, key, canvas: out, sil: null });
    return out;
  }
  // Siluet putih logo (untuk garis tepi)
  function logoSilhouette(src) {
    if (logoCache.sil) return logoCache.sil;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    return (logoCache.sil = c);
  }
  function drawLogo(s, x, y, w, h) {
    const src = logoSource(s), a = s.fxAmt;
    ctx.save();
    if (s.fx === 'shadow') {
      ctx.shadowColor = `rgba(0,0,0,${0.35 + 0.55 * a})`; ctx.shadowBlur = 6 + 26 * a; ctx.shadowOffsetY = 2 + 4 * a;
      ctx.drawImage(src, x, y, w, h);
      if (a > 0.6) ctx.drawImage(src, x, y, w, h);
    } else if (s.fx === 'glow') {
      ctx.shadowColor = `rgba(255,255,255,${0.45 + 0.55 * a})`; ctx.shadowBlur = 8 + 30 * a;
      ctx.drawImage(src, x, y, w, h); ctx.drawImage(src, x, y, w, h);
    } else if (s.fx === 'outline') {
      const sil = logoSilhouette(src), r = 1.5 + 5 * a;
      for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; ctx.drawImage(sil, x + Math.cos(t) * r, y + Math.sin(t) * r, w, h); }
    }
    ctx.restore();
    ctx.drawImage(src, x, y, w, h);
  }

  function drawBrand(x, y, light) {
    const s = S();
    let cx = x;
    const useLogo = state.logo && s.mode !== 'text';
    if (useLogo) {
      const h = Math.round(64 * s.logoScale);
      const src = logoSource(s);
      const ratio = src.width && src.height ? src.width / src.height : 1;
      const lw = Math.min(ctx.canvas.width * (s.mode === 'both' ? 0.35 : 0.55), h * ratio);
      const lh = lw / ratio;
      const plate = s.fx === 'plate' || s.fx === 'plateDark';
      const pad = plate ? Math.round(10 + 8 * s.fxAmt) : 0;
      if (plate) {
        const op = 0.45 + 0.5 * s.fxAmt;
        ctx.fillStyle = s.fx === 'plate' ? `rgba(255,255,255,${op})` : `rgba(10,15,25,${op})`;
        roundRect(cx, y + (h - lh) / 2 - pad, lw + pad * 2, lh + pad * 2, 12); ctx.fill();
      }
      drawLogo(s, cx + pad, y + (h - lh) / 2, lw, lh); cx += lw + pad * 2 + 18;
      if (s.mode === 'both') {
        ctx.fillStyle = light ? '#fff' : '#0f172a'; ctx.font = '800 32px Inter'; ctx.textBaseline = 'middle';
        ctx.fillText(s.name.toUpperCase(), cx, y + h / 2);
      }
    } else {
      ctx.fillStyle = s.accent; roundRect(cx, y + 8, 48, 48, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 30px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((s.name[0] || 'M').toUpperCase(), cx + 24, y + 33); ctx.textAlign = 'left';
      cx += 64;
      ctx.fillStyle = light ? '#fff' : '#0f172a'; ctx.font = '800 32px Inter'; ctx.textBaseline = 'middle';
      ctx.fillText(s.name.toUpperCase(), cx, y + 33);
    }
    ctx.textBaseline = 'alphabetic';
  }
  function drawKicker(text, x, y, s) {
    if (!text) return 0;
    ctx.font = '800 26px Inter';
    const t = text.toUpperCase(), w = ctx.measureText(t).width + 36;
    ctx.fillStyle = s.accent; roundRect(x, y, w, 46, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 18, y + 24); ctx.textBaseline = 'alphabetic';
    return 46;
  }
  function drawFooter(x, y, w, color) {
    const s = S();
    ctx.font = '600 20px Inter'; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    const credit = $('credit').value.trim();
    ctx.textAlign = 'left'; ctx.fillText(credit, x, y);
    if (s.handle) { ctx.textAlign = 'right'; ctx.font = '700 20px Inter'; ctx.fillText(s.handle, x + w, y); }
    ctx.textAlign = 'left';
  }
  function placeholderBg(W, H, s) {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, s.panel); g.addColorStop(1, s.accent);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    const [W, H] = SIZES[state.fmt];
    cv.width = W; cv.height = H;
    const s = S();
    const style = $('style').value;
    const fy = parseFloat($('focusY').value);
    const scale = parseFloat($('fontScale').value);
    const headline = $('headline').value.trim() || 'Tempel link berita, judul akan muncul di sini';
    const kicker = $('kicker').value.trim();
    const P = 64; // padding
    const tall = H / W;
    const lh = s.font === 'Merriweather' ? 1.28 : 1.12;
    const weight = s.font === 'Merriweather' ? 900 : 900;
    ctx.clearRect(0, 0, W, H);

    if (style === 'gradient') {
      if (state.photo) drawCover(state.photo, 0, 0, W, H, fy); else placeholderBg(W, H, s);
      const g = ctx.createLinearGradient(0, H * 0.28, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,.62)'); g.addColorStop(1, 'rgba(0,0,0,.93)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const tg = ctx.createLinearGradient(0, 0, 0, 200); tg.addColorStop(0, 'rgba(0,0,0,.45)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 200);
      drawBrand(P, P - 8, true);
      const bottom = H - P - 40;
      const maxH = H * (tall > 1.5 ? 0.30 : 0.36);
      const f = fitText(headline, s.font, weight, W - P * 2, maxH, Math.round(84 * scale), Math.round(40 * scale), lh);
      const blockH = f.lines.length * f.size * lh;
      let y = bottom - blockH - 26;
      const kh = kicker ? 46 + 22 : 0;
      drawKicker(kicker, P, y - kh, s);
      ctx.fillStyle = '#fff'; ctx.font = `${weight} ${f.size}px "${s.font}"`; ctx.textBaseline = 'top';
      f.lines.forEach((l, i) => ctx.fillText(l, P, y + i * f.size * lh));
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = s.accent; ctx.fillRect(P, bottom - 8, 120, 8);
      drawFooter(P, H - P + 6, W - P * 2, 'rgba(255,255,255,.85)');
    } else {
      const frame = style === 'frame' ? 36 : 0;
      ctx.fillStyle = style === 'frame' ? s.accent : s.panel; ctx.fillRect(0, 0, W, H);
      const photoH = Math.round(H * (tall > 1.5 ? 0.55 : tall > 1.1 ? 0.56 : 0.5));
      if (state.photo) drawCover(state.photo, frame, frame, W - frame * 2, photoH - frame, fy);
      else { ctx.save(); ctx.beginPath(); ctx.rect(frame, frame, W - frame * 2, photoH - frame); ctx.clip(); placeholderBg(W, H, s); ctx.restore(); }
      const tg = ctx.createLinearGradient(0, frame, 0, frame + 180); tg.addColorStop(0, 'rgba(0,0,0,.5)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tg; ctx.fillRect(frame, frame, W - frame * 2, 180);
      drawBrand(frame + 40, frame + 30, true);
      // panel
      const px = frame, pw = W - frame * 2, py = photoH, ph = H - photoH - frame;
      ctx.fillStyle = s.panel; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = s.accent; ctx.fillRect(px, py, pw, 10);
      const ix = px + P - frame / 2;
      const iw = pw - (P - frame / 2) * 2;
      const top = py + 10 + 44, kh = kicker ? 46 + 26 : 0;
      const avail = py + ph - top - kh - 100;
      const f = fitText(headline, s.font, weight, iw, avail, Math.round(80 * scale), Math.round(38 * scale), lh);
      const blockH = kh + f.lines.length * f.size * lh;
      let y = top + Math.max(0, (avail + kh - blockH) / 2);
      if (kicker) { drawKicker(kicker, ix, y, s); y += kh; }
      ctx.fillStyle = '#fff'; ctx.font = `${weight} ${f.size}px "${s.font}"`; ctx.textBaseline = 'top';
      f.lines.forEach((l, i) => ctx.fillText(l, ix, y + i * f.size * lh));
      ctx.textBaseline = 'alphabetic';
      drawFooter(ix, py + ph - 44, iw, 'rgba(255,255,255,.75)');
    }
    if ($('dlg').open) drawBrandPreview();
    if (window.BKVideo) window.BKVideo.refresh();
    if (window.BKWP) window.BKWP.featuredPreview();
  }
  // Pratinjau di Pengaturan: potongan bagian atas gambar (area merek)
  function drawBrandPreview() {
    const pv = $('brandPreview'), pc = pv.getContext('2d');
    const sh = Math.round(cv.width * pv.height / pv.width);
    pc.clearRect(0, 0, pv.width, pv.height);
    pc.drawImage(cv, 0, 0, cv.width, sh, 0, 0, pv.width, pv.height);
  }

  // ---------- Caption: prompt ----------
  const LEN = { pendek: '70–90 kata, 2 paragraf', sedang: '130–170 kata, 3–4 paragraf', panjang: '220–270 kata, 4–5 paragraf' };
  // Mode kata kunci: rangkum beberapa berita terkini menjadi konten (mis. daftar "3 HP terbaik")
  function buildResearchPrompt(a) {
    const s = S(), dl = (s.dateline || s.name).toUpperCase();
    const n = (String(a.query || a.title).match(/\b(\d{1,2})\b/) || [])[1];
    const today = fmtDate(new Date().toISOString());
    return `Anda adalah redaktur senior media daring Indonesia yang menulis dengan gaya Harian Kompas: lugas, akurat, berimbang, kalimat efektif, Bahasa Indonesia baku sesuai KBBI/PUEBI, tanpa sensasi dan tanpa emoji.

TUGAS: pembaca mencari "${a.query || a.title}". Susun bahan posting media sosial (${$('platform').value}) yang menjawabnya secara akurat dan terkini, HANYA berdasarkan BAHAN dari beberapa berita di bawah (rangkuman per ${today}).

ATURAN
1. ${n ? `Sajikan tepat ${n} item.` : 'Bila permintaan berupa daftar/rekomendasi, sajikan 3–5 item; bila berupa pertanyaan atau peristiwa, sajikan informasi terpenting secara ringkas.'} Utamakan yang paling sering atau paling kuat direkomendasikan lintas sumber; jangan ada item ganda.
2. Setiap item: nama lengkap, 1–2 kalimat keunggulan/informasi utama dengan angka atau spesifikasi PERSIS seperti di bahan, dan nama media sumbernya. Jangan mengarang harga, spesifikasi, tanggal, peringkat, atau klaim yang tidak ada di bahan.
3. "caption": paragraf pembuka singkat diawali "${dl} —" yang memberi konteks dan menyebut bahwa ini rangkuman per ${today}; lalu daftar bernomor (1., 2., …); lalu baris "Sumber: <nama-nama media>" dan ajakan singkat. Bukan iklan. Panjang mengikuti kebutuhan daftar (sekitar ${LEN[$('length').value]}).
4. "judul_gambar": maks. 12 kata, informatif (mis. "3 HP Terbaik Saat Ini Menurut Ulasan Media"), tanpa titik di akhir. "kicker": 1–2 kata huruf kapital (mis. GADGET, EKONOMI).
5. "hashtags": 3–6 tagar relevan tanpa spasi.
6. "items": [{"nama":"","ringkas":"","sumber":""}] sesuai daftar.
7. "w5h1": isi singkat bila relevan; bila tidak, tulis "tidak relevan".
8. "video": "hook" maks. 12 kata; "poin": satu kalimat lengkap pola SPOK (14–24 kata) per item, urut sesuai daftar (maks. 6); "penutup" maks. 8 kata; "footage": item pertama untuk hook (topik umum), lalu SATU per poin berisi {"id": nama item persis (mis. "Samsung Galaxy A16 5G"), "en": nama item atau objeknya dalam bahasa Inggris}.

Balas HANYA dengan JSON valid tanpa teks lain:
{"judul_gambar":"","kicker":"","w5h1":{"apa":"","siapa":"","kapan":"","di_mana":"","mengapa":"","bagaimana":""},"caption":"","hashtags":[""],"items":[{"nama":"","ringkas":"","sumber":""}],"video":{"hook":"","poin":[""],"penutup":"","footage":[{"id":"","en":""}]}}

BAHAN (beberapa berita terkini)
${(a.body || '').slice(0, 14000)}`;
  }
  function buildPrompt(a) {
    if (a.mode === 'research') return buildResearchPrompt(a);
    const s = S();
    const dl = (s.dateline || s.name).toUpperCase();
    const body = (a.body || a.description || '').slice(0, 9000);
    const vid = a.mode === 'video'; // bahan dari analisis video (YouTube/unggahan)
    const src = vid ? 'BAHAN VIDEO' : 'ARTIKEL';
    return `Anda adalah redaktur senior media daring Indonesia yang menulis dengan gaya Harian Kompas: lugas, berimbang, kalimat efektif, Bahasa Indonesia baku sesuai KBBI/PUEBI, tanpa sensasi dan tanpa emoji.

Tugas: dari ${src} di bawah, buat bahan posting media sosial (${$('platform').value}).

ATURAN JURNALISTIK
1. Gunakan unsur 5W+1H (apa, siapa, kapan, di mana, mengapa, bagaimana) dan struktur piramida terbalik.
2. Paragraf pertama adalah lead ringkas (maks. 40 kata) yang menjawab apa, siapa, kapan, dan di mana. Awali dengan dateline: "NAMA KOTA, ${dl} —" (kota tempat peristiwa; jika tidak jelas pakai JAKARTA).
3. Paragraf berikutnya menjelaskan mengapa dan bagaimana, lalu konteks/latar dan—bila ada—satu kutipan langsung dengan atribusi jelas ("kata ...", "ujar ...").
4. HANYA gunakan fakta yang ada di ${vid ? 'bahan video' : 'artikel'}. Jangan menambah angka, nama, atau klaim. Jika satu unsur 5W+1H tidak tersedia, tulis "tidak disebutkan" pada analisis dan jangan mengarang.
5. Hari/tanggal ditulis gaya Kompas, mis. "Senin (5/10/2026)". Tanggal ${vid ? 'video/peristiwa' : 'terbit artikel'}: ${a.date || 'tidak diketahui'}.
6. Panjang caption: ${LEN[$('length').value]}. Tutup dengan baris: "Sumber: ${a.site || 'media asal'}" dan ajakan singkat ${vid ? (a.url ? 'menonton video lengkapnya' : 'mengikuti akun kami') : 'membaca selengkapnya'} (tanpa menulis URL).
7. "judul_gambar": judul untuk ditaruh di foto, maks. 12 kata, informatif, aktif, bukan clickbait, tanpa titik di akhir.
8. "kicker": 1–2 kata rubrik dalam huruf kapital (mis. NASIONAL, EKONOMI, OLAHRAGA, PENDIDIKAN).
9. "hashtags": 3–6 tagar relevan dalam Bahasa Indonesia, tanpa spasi.
10. "video": naskah video pendek vertikal (TikTok/Reels/Shorts, 15–60 detik). "hook": kalimat pembuka yang membuat penonton berhenti menggulir, maks. 12 kata, tetap faktual, bukan clickbait. "poin": tepat 6 kalimat penjelasan, diurutkan dari yang terpenting (3 poin pertama harus sudah menjawab apa, siapa, kapan, di mana; berikutnya mengapa, bagaimana, dan konteks/dampak). Setiap poin adalah SATU kalimat lengkap Bahasa Indonesia baku dengan pola SPOK (Subjek, Predikat, Objek, Keterangan), 14–24 kata, berdiri sendiri tanpa label. "penutup": ajakan singkat maks. 8 kata (mis. "Baca selengkapnya di tautan bio"). "footage": tepat 7 item kata kunci pencarian foto untuk latar video (urutan: hook, lalu poin 1–6); setiap item {"id": kata kunci spesifik Bahasa Indonesia 2–4 kata berupa tempat, objek, atau peristiwa nyata yang bisa difoto (mis. "Stasiun Halim kereta cepat"), "en": kata kunci foto stok umum Bahasa Inggris 2–4 kata berupa objek visual tanpa nama orang (mis. "high speed train station")}.

Balas HANYA dengan JSON valid tanpa teks lain, dengan struktur:
{"judul_gambar":"","kicker":"","w5h1":{"apa":"","siapa":"","kapan":"","di_mana":"","mengapa":"","bagaimana":""},"caption":"","hashtags":[""],"video":{"hook":"","poin":["","","","","",""],"penutup":"","footage":[{"id":"","en":""}]}}

${src}
Judul: ${a.title}
Media: ${a.site}
Penulis: ${a.author || '-'}
Rubrik: ${a.section || '-'}
Ringkasan: ${a.description}
Isi:
${body}`;
  }
  function parseJson(txt) {
    let t = (txt || '').replace(/```json|```/g, '').trim();
    const i = t.indexOf('{'), j = t.lastIndexOf('}');
    if (i >= 0 && j > i) t = t.slice(i, j + 1);
    return JSON.parse(t);
  }
  function templateCaption(a) {
    const s = S();
    const dl = (s.dateline || s.name).toUpperCase();
    const paras = (a.body || '').split(/\n{2,}/).filter(Boolean);
    const lead = a.description || paras[0] || a.title;
    const rest = paras.filter((p) => p !== lead).slice(0, $('length').value === 'pendek' ? 1 : $('length').value === 'sedang' ? 2 : 4);
    const text = [`JAKARTA, ${dl} — ${lead}`, ...rest, `Sumber: ${a.site}. Baca selengkapnya di tautan pada bio.`].join('\n\n');
    const words = (t, n) => { const w = clean(t).split(' '); return w.length > n ? w.slice(0, n).join(' ') + '…' : w.join(' '); };
    // Kalimat utuh dari artikel (bukan dipotong) agar tetap SPOK; kalimat sangat panjang baru dipangkas
    const sentences = (a.body || a.description || '').split(/(?<=[.!?])\s+/).map(clean).filter((x) => x.length > 30);
    const video = {
      hook: words($('headline').value || a.title, 12),
      poin: sentences.slice(0, 6).map((x) => words(x, 32)),
      penutup: 'Baca selengkapnya di tautan bio'
    };
    video.footage = [video.hook, ...video.poin].map((t) => ({ id: photoKeywords(t), en: '' }));
    return { judul_gambar: a.title, kicker: a.section ? a.section.toUpperCase().split(/\s+/).slice(0, 2).join(' ') : '', w5h1: null, caption: text, hashtags: [], video };
  }
  function renderW5h1(w) {
    const el = $('w5h1'); el.innerHTML = '';
    // Sembunyikan bila tidak ada unsur yang terisi (mis. konten daftar di mode kata kunci)
    if (!w || Object.values(w).every((v) => !v || /^tidak (relevan|disebutkan)/i.test(String(v).trim()))) return;
    const L = { apa: 'Apa (What)', siapa: 'Siapa (Who)', kapan: 'Kapan (When)', di_mana: 'Di mana (Where)', mengapa: 'Mengapa (Why)', bagaimana: 'Bagaimana (How)' };
    Object.keys(L).forEach((k) => {
      const d = document.createElement('div');
      const b = document.createElement('b'); b.textContent = L[k];
      d.appendChild(b); d.appendChild(document.createTextNode(w[k] || 'tidak disebutkan'));
      el.appendChild(d);
    });
  }
  function countWords() { const n = $('caption').value.trim().split(/\s+/).filter(Boolean).length; $('wordCount').textContent = n ? n + ' kata' : ''; }

  async function makeCaption(updateHeadline) {
    const a = state.article;
    if (!a.title && !a.body) { status('Belum ada bahan artikel.', 'err'); return; }
    const engine = $('engine').value;
    const btn = $('btnCaption'); btn.disabled = true;
    const old = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>Menulis caption…';
    try {
      let out;
      let used = null, notes = [];
      if (engine === 'template') out = templateCaption(a);
      else {
        // Penyedia pilihan dulu, lalu cadangan otomatis (lihat ai.js); terakhir template
        try {
          const r = await window.BKAI.generate(buildPrompt(a), engine, {
            validate: parseJson,
            onStatus: (m) => status('<span class="spin"></span>' + escapeHtml(m))
          });
          out = r.data; used = r.providerName; notes = r.notes;
        } catch (e) { notes = e.notes || [e.message]; out = templateCaption(a); }
      }
      const tags = (out.hashtags || []).map((t) => '#' + String(t).replace(/^#/, '').replace(/\s+/g, '')).filter((t) => t.length > 1);
      $('caption').value = clean2(out.caption) + (tags.length ? '\n\n' + tags.join(' ') : '');
      renderW5h1(out.w5h1);
      if (updateHeadline && out.judul_gambar) $('headline').value = out.judul_gambar.replace(/\.$/, '');
      if (updateHeadline && out.kicker) $('kicker').value = out.kicker.toUpperCase();
      countWords(); draw();
      setVideoScript(out.video || templateCaption(a).video);
      const tried = notes.length ? `<br><span class="muted">Dicoba sebelumnya: ${escapeHtml(notes.join('; '))}</span>` : '';
      const setup = ' <button type="button" class="linkish" data-open-ai>Atur Mesin AI</button>';
      if (used) status(`Selesai dengan <b>${escapeHtml(used)}</b>. Periksa kembali fakta sebelum diunggah.${tried}`, 'ok');
      else if (engine === 'template') status('Caption template dibuat. Untuk caption 5W+1H yang utuh, pilih mesin AI.' + setup, 'ok');
      else status(`Belum ada mesin AI yang berhasil, jadi dipakai mode template.${setup}${tried}`, 'err');
    } catch (e) {
      status('Gagal membuat caption: ' + escapeHtml(e.message), 'err');
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  function setVideoScript(v) {
    state.video = v || null;
    if (window.BKVideo) window.BKVideo.setScript(state.video);
    // Cari footage per adegan di latar belakang (tidak menahan caption)
    if (window.BKFootage && state.video) window.BKFootage.autoFill(state.video.footage || [], state.article);
  }
  const clean2 = (s) => String(s || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Alur utama ----------
  function fillRaw(a) {
    $('artTitle').value = a.title; $('artSite').value = a.site; $('artDate').value = a.date; $('artImage').value = a.image; $('artBody').value = a.body;
  }
  function applyArticleToUi(a) {
    $('headline').value = a.title.replace(/\s+[-|–—]\s+[^|–—]*$/, (m) => (m.length < 32 ? '' : m)); // buang " - Kompas.com"
    $('kicker').value = a.section ? a.section.toUpperCase().split(/\s+/).slice(0, 2).join(' ') : '';
    $('credit').value = `Sumber: ${a.site}${a.date ? ' • ' + fmtDate(a.date, true) : ''}`;
  }
  // Tiga pilihan foto: Otomatis (dari link) · Pilih foto lain (galeri pencarian) · Unggah
  function photoUi(mode, note) {
    const info = $('photoInfo'), box = $('photoUpload'), picker = $('photoPicker');
    const tab = { ok: 'auto', auto: 'auto', picked: 'pick', pick: 'pick', manual: 'upload', upload: 'upload' }[mode] || '';
    document.querySelectorAll('#photoSeg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.pm === tab);
      b.classList.toggle('suggest', mode === 'fail' && b.dataset.pm === 'pick');
    });
    box.hidden = !(tab === 'upload' || mode === 'fail');
    if (tab !== 'pick') picker.hidden = true;
    if (mode === 'ok') info.textContent = 'Foto diambil dari sumber berita.';
    else if (mode === 'fail') info.textContent = 'Foto dari sumber tidak tersedia atau tidak bisa diambil. Pilih foto lain dari galeri atau unggah foto sendiri.';
    else if (mode === 'manual') info.textContent = 'Memakai foto unggahan Anda.';
    else if (mode === 'upload') info.textContent = 'Pilih file foto dari perangkat Anda.';
    else if (mode === 'pick') info.textContent = 'Klik foto di galeri untuk memakainya. Bisa cari dengan kata kunci sendiri.';
    else if (mode === 'picked') info.textContent = `Memakai foto dari ${note || 'galeri'}. Foto ini juga dipakai di Hook & Penutup video.`;
    else info.textContent = 'Foto diambil otomatis dari link berita.';
  }
  // Kata kunci foto dari teks: kata penting (utamakan berhuruf kapital), tanpa kata umum yang
  // menyesatkan pencarian foto (mis. "Pemerintah" cenderung memberi foto pejabat asing)
  const PHOTO_STOP = /^(yang|dan|di|ke|dari|untuk|pada|dengan|dalam|ini|itu|akan|telah|sudah|oleh|para|bagi|atas|secara|tersebut|adalah|menjadi|juga|karena|antara|hingga|serta|lebih|tidak|bisa|dapat|saat|setelah|sebelum|kata|ujar|menurut|tahun|hari|senin|selasa|rabu|kamis|jumat|sabtu|minggu|pemerintah|pihak|warga|masyarakat|tahap|pertama|kedua|ketiga|baru|resmi|terkait|sejumlah|berbagai|soal|usai|jelang|kini|bakal)$/i;
  function photoKeywords(t) {
    // buang juga kata kerja berakhiran -kan/-nya yang jarang berguna sebagai kata kunci foto
    const w = clean(t).replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((x) => x.length > 2 && !PHOTO_STOP.test(x) && !/(kan|nya)$/i.test(x));
    const caps = w.filter((x) => /^\p{Lu}/u.test(x));
    return (caps.length >= 2 ? caps : w).slice(0, 3).join(' ');
  }
  const baseCredit = () => { const a = state.article; return a.site ? `Sumber: ${a.site}${a.date ? ' • ' + fmtDate(a.date, true) : ''}` : ''; };
  function openPhotoPicker() {
    const picker = $('photoPicker');
    if (!window.BKFootage) return;
    photoUi('pick'); picker.hidden = false;
    const kw = state.video && state.video.footage && state.video.footage[0] && state.video.footage[0].id;
    const query = kw || photoKeywords($('headline').value || state.article.title || '');
    window.BKFootage.openPicker(picker, {
      query,
      onPick: (item, el) => {
        const fromArticle = item.source === 'Artikel';
        $('credit').value = [baseCredit(), fromArticle ? '' : 'Foto: ' + item.credit].filter(Boolean).join(' • ');
        state.photo = el; draw();
        photoUi('picked', fromArticle ? 'artikel' : item.source);
        picker.hidden = false;
      }
    });
  }
  async function setPhoto(url) {
    if (!url) { state.photo = null; draw(); photoUi('fail'); return false; }
    try { state.photo = await loadRemoteImage(url); draw(); photoUi('ok'); return true; }
    catch { state.photo = null; draw(); photoUi('fail'); return false; }
  }

  // Input berupa link (http… atau domain tanpa spasi) → mode link; selain itu → mode kata kunci
  const isLink = (v) => /^https?:\/\//i.test(v) || (!/\s/.test(v) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v));
  // Pakai satu artikel (dari link atau hasil riset) untuk mengisi gambar, foto, caption, dan video
  const clearUserVideo = () => { if (window.BKFootage && window.BKFootage.clearUserVideo) window.BKFootage.clearUserVideo(); };
  async function useArticle(a) {
    clearUserVideo();
    state.article = a; fillRaw(a); applyArticleToUi(a); draw();
    status('<span class="spin"></span>Mengambil foto…');
    // Coba foto utama, lalu foto lain dari artikel bila gagal
    const candidates = [a.image, ...(a.images || [])].filter((u, i, arr) => u && arr.indexOf(u) === i).slice(0, 4);
    let okPhoto = false;
    for (const u of candidates.length ? candidates : ['']) { okPhoto = await setPhoto(u); if (okPhoto) break; }
    if (!okPhoto) status('Foto tidak bisa diambil dari sumber — pilih foto lain atau unggah manual. Menulis caption…', 'err');
    else status('<span class="spin"></span>Menulis caption…');
    await makeCaption(true);
    if (!okPhoto) status('Caption selesai, tetapi foto perlu dipilih atau diunggah manual (kartu Gambar → Pilih foto lain / Unggah).', 'err');
    return okPhoto;
  }

  async function run() {
    let url = $('url').value.trim();
    if (!url) { status('Tempel link berita atau ketik kata kunci dulu.', 'err'); return; }
    if (!isLink(url) && window.BKResearch) return window.BKResearch.run(url);
    if (window.BKResearch) window.BKResearch.hide();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const btn = $('btnGo'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Memproses';
    try {
      status('<span class="spin"></span>Mengambil halaman berita…');
      let a = null;
      const jinaP = fetchJina(url); // dijalankan bersamaan sebagai cadangan
      const html = await fetchHtml(url);
      if (html) a = parseHtml(html, url);
      if (!a || !a.title || a.body.length < 200) {
        status('<span class="spin"></span>Mencoba pembaca cadangan…');
        const j = await jinaP;
        if (j) {
          const b = parseJina(j, url);
          a = a ? { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v)), body: (a.body.length > b.body.length ? a.body : b.body) } : b;
        }
      }
      if (!a || !a.title) {
        status('Halaman tidak bisa diambil (situs memblokir). Buka bagian "Bahan artikel", tempel judul & isi, lalu klik "Pakai bahan ini".', 'err');
        $('artTitle').value = ''; document.querySelector('.raw').open = true; return;
      }
      await useArticle(a);
    } catch (e) {
      status('Terjadi kesalahan: ' + escapeHtml(e.message), 'err');
    } finally { btn.disabled = false; btn.textContent = 'Proses'; }
  }

  // Mode teks: baris pertama yang pendek (tanpa titik di akhir) = judul, sisanya = isi
  function articleFromText(text, source) {
    const lines = text.replace(/\r/g, '').split('\n');
    const first = (lines.find((l) => l.trim()) || '').trim();
    const rest = text.slice(text.indexOf(first) + first.length).trim();
    const hasTitle = rest.length > 0 && first.length <= 160 && !/[.!?]["”']?$/.test(first);
    const body = hasTitle ? rest : text.trim();
    const title = hasTitle ? first : (body.match(/^[^.!?\n]+/) || [''])[0].split(/\s+/).slice(0, 14).join(' ');
    return {
      url: '', title, site: source || S().name || 'redaksi', date: '', image: '', images: [],
      section: '', body, description: body.split(/\n{2,}/)[0] || ''
    };
  }
  async function runText() {
    const text = $('newsText').value.trim();
    if (text.length < 80) { status('Tempel teks berita minimal beberapa kalimat (≥ 80 karakter).', 'err'); return; }
    if (window.BKResearch) window.BKResearch.hide();
    const btn = $('btnText'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Memproses';
    try {
      const a = articleFromText(text, $('newsSource').value.trim());
      clearUserVideo();
      state.article = a; fillRaw(a); applyArticleToUi(a);
      state.photo = null; draw();
      status('<span class="spin"></span>Menulis caption…');
      await makeCaption(true);
      openPhotoPicker(); // teks tidak membawa foto → langsung tampilkan galeri
    } catch (e) {
      status('Terjadi kesalahan: ' + escapeHtml(e.message), 'err');
    } finally { btn.disabled = false; btn.textContent = 'Proses teks'; }
  }
  function setInMode(m) {
    store.set('inMode', m);
    document.querySelectorAll('#inSeg button').forEach((b) => b.classList.toggle('on', b.dataset.in === m));
    $('linkBox').hidden = m !== 'link'; $('txtBox').hidden = m !== 'text'; $('vidBox').hidden = m !== 'video';
  }
  setInMode(['link', 'text', 'video'].includes(store.get('inMode')) ? store.get('inMode') : 'link');
  $('inSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setInMode(b.dataset.in); });
  $('btnText').addEventListener('click', runText);

  // ---------- Event ----------
  $('btnGo').addEventListener('click', run);
  $('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  $('btnCaption').addEventListener('click', () => makeCaption(false));
  ['headline', 'kicker', 'credit', 'style', 'fontScale', 'focusY'].forEach((id) => $(id).addEventListener('input', draw));
  $('style').addEventListener('change', () => { store.set('style', $('style').value); draw(); });
  ['engine', 'length', 'platform'].forEach((id) => $(id).addEventListener('change', () => store.set(id, $(id).value)));
  $('caption').addEventListener('input', countWords);
  $('fmtSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.fmt = b.dataset.fmt; store.set('fmt', state.fmt);
    document.querySelectorAll('#fmtSeg button').forEach((x) => x.classList.toggle('on', x === b)); draw();
  });
  $('photoSeg').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = b.dataset.pm;
    if (m === 'pick') openPhotoPicker();
    else if (m === 'upload') { photoUi('upload'); $('photoFile').click(); }
    else if (m === 'auto') {
      const url = state.article.image;
      if (!url) { photoUi('fail'); return; }
      $('photoInfo').innerHTML = '<span class="spin"></span>Memuat foto dari sumber berita…';
      const base = baseCredit(); if (base) $('credit').value = base;
      await setPhoto(url);
    }
  });
  $('photoFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    state.photo = await loadImage(URL.createObjectURL(f)); draw(); photoUi('manual');
  });
  $('btnDownload').addEventListener('click', () => {
    draw();
    try {
      const a = document.createElement('a');
      a.download = slug() + '.png'; a.href = cv.toDataURL('image/png'); a.click();
    } catch { status('Gambar tidak bisa diunduh karena foto dari server lain. Silakan unggah foto manual.', 'err'); photoUi('fail'); }
  });
  $('btnCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('caption').value); status('Caption tersalin.', 'ok'); }
    catch { $('caption').select(); document.execCommand('copy'); status('Caption tersalin.', 'ok'); }
  });
  $('btnApplyManual').addEventListener('click', async () => {
    const a = {
      ...state.article, url: $('url').value.trim(), title: $('artTitle').value.trim(), site: $('artSite').value.trim() || 'media asal',
      date: $('artDate').value.trim(), image: $('artImage').value.trim(), body: $('artBody').value.trim()
    };
    a.description = a.description || (a.body.split(/\n{2,}/)[0] || '');
    if (!a.title && !a.body) { status('Isi minimal judul atau isi artikel.', 'err'); return; }
    state.article = a; applyArticleToUi(a);
    await setPhoto(a.image);
    await makeCaption(true);
  });
  // Settings
  $('btnSettings').addEventListener('click', () => { $('dlg').showModal(); draw(); });
  $('dlg').addEventListener('close', () => { saveSettings(); draw(); });
  ['sName', 'sHandle', 'sAccent', 'sPanel', 'sFont', 'sLogoScale', ...FX_IDS].forEach((id) => {
    $(id).addEventListener('input', () => { applyAccent(); draw(); });
    $(id).addEventListener('change', () => { applyAccent(); draw(); });
  });
  $('btnResetFx').addEventListener('click', () => { FX_IDS.forEach((id) => { $(id).value = defaultOf($(id)); }); draw(); });
  // Preset
  $('presetSel').addEventListener('change', (e) => { if (e.target.value) applyPreset(e.target.value); });
  $('presetQuick').addEventListener('change', (e) => { if (e.target.value) applyPreset(e.target.value); });
  $('btnPresetNew').addEventListener('click', () => {
    const name = (prompt('Nama preset (mis. Kalawaca.com, Akun pribadi):', $('sName').value.trim()) || '').trim();
    if (!name) return;
    if (getPresets()[name] && !confirm(`Preset "${name}" sudah ada. Timpa?`)) return;
    if (writePreset(name, snapshot())) presetMsg(`Preset "${name}" tersimpan.`);
  });
  $('btnPresetSave').addEventListener('click', () => {
    const name = $('presetSel').value;
    if (!name) { presetMsg('Pilih preset dulu, atau klik "Simpan sebagai preset baru".', true); return; }
    if (writePreset(name, snapshot())) presetMsg(`Preset "${name}" diperbarui.`);
  });
  $('btnPresetDel').addEventListener('click', () => {
    const name = $('presetSel').value; if (!name) return;
    if (!confirm(`Hapus preset "${name}"?`)) return;
    const all = getPresets(); delete all[name]; store.set('presets', all);
    if (store.get('activePreset', '') === name) store.set('activePreset', '');
    renderPresets(); presetMsg(`Preset "${name}" dihapus.`);
  });
  // ---------- Ekspor/impor: preset + pengaturan aktif (+ API key opsional, bisa dikunci kata sandi) ----------
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  async function pwKey(pw, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptJson(obj, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await pwKey(pw, salt), new TextEncoder().encode(JSON.stringify(obj)));
    return { alg: 'AES-GCM/PBKDF2-SHA256', salt: b64(salt), iv: b64(iv), data: b64(data) };
  }
  async function decryptJson(enc, pw) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(enc.iv) }, await pwKey(pw, unb64(enc.salt)), unb64(enc.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function currentSettings() {
    saveSettings();
    const o = {}; settingIds.concat(optIds).forEach((id) => { if (id !== 'engine') o[id] = $(id).value; });
    o.logo = state.logoData; o.activePreset = store.get('activePreset', '');
    return o;
  }
  $('btnPresetExport').addEventListener('click', async () => {
    const payload = { app: 'berita-kilat', version: 2, exportedAt: new Date().toISOString(), presets: getPresets(), current: currentSettings() };
    let note = '';
    if ($('presetWithKeys').checked) {
      if (!confirm('File ekspor akan berisi API key dan kata sandi aplikasi WordPress Anda.\nSiapa pun yang memegang file ini bisa memakai akun tersebut. Simpan baik-baik dan jangan dibagikan.\n\nLanjutkan?')) return;
      const secrets = {}; SECRET_KEYS.forEach((k) => { const v = store.get(k, null); if (v !== null && v !== '') secrets[k] = v; });
      const pw = prompt('Kunci file dengan kata sandi (disarankan). Kata sandi ini diminta saat impor.\nKosongkan untuk menyimpan tanpa kunci.', '');
      if (pw === null) return;
      if (pw) { payload.secretsEnc = await encryptJson(secrets, pw); note = ' API key ikut tersimpan dan dikunci kata sandi.'; }
      else { payload.secrets = secrets; note = ' API key ikut tersimpan TANPA kunci — simpan file ini dengan aman.'; }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `berita-kilat-${payload.secrets || payload.secretsEnc ? 'lengkap' : 'preset'}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    presetMsg(`File diunduh (${Object.keys(payload.presets).length} preset + pengaturan aktif).${note} Impor file ini di browser/perangkat lain.`);
  });
  $('presetImport').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = '';
    let j;
    try { j = JSON.parse(await f.text()); if (!j || typeof j !== 'object' || (!j.presets && !j.current)) throw new Error(); }
    catch { presetMsg('File preset tidak valid.', true); return; }
    let secrets = j.secrets && typeof j.secrets === 'object' ? j.secrets : null;
    if (j.secretsEnc) {
      const pw = prompt('File ini berisi API key yang dikunci. Masukkan kata sandinya (kosongkan untuk melewati API key):', '');
      if (pw) {
        try { secrets = await decryptJson(j.secretsEnc, pw); }
        catch { presetMsg('Kata sandi salah — API key tidak diimpor. Coba impor lagi.', true); return; }
      }
    }
    const inc = j.presets && typeof j.presets === 'object' ? j.presets : {};
    if (!store.set('presets', { ...getPresets(), ...inc })) { presetMsg('Penyimpanan browser penuh, impor gagal.', true); return; }
    const cur = j.current && typeof j.current === 'object' ? j.current : null;
    const parts = [`${Object.keys(inc).length} preset`];
    let reload = false;
    if (cur && confirm('Terapkan juga pengaturan aktif dari file ini (nama media, logo, warna, gaya gambar & video)? Pengaturan di browser ini akan diganti.')) {
      settingIds.concat(optIds).forEach((id) => { if (id !== 'engine' && cur[id] != null) store.set(id, String(cur[id])); });
      if ('logo' in cur) store.set('logo', cur.logo || null);
      if (cur.activePreset) store.set('activePreset', cur.activePreset);
      parts.push('pengaturan aktif'); reload = true;
    }
    if (secrets && confirm('Impor API key & koneksi dari file ini? Key dengan nama penyedia yang sama akan diganti.')) {
      SECRET_KEYS.forEach((k) => {
        if (!(k in secrets)) return;
        const v = secrets[k];
        if (MERGE_KEYS.includes(k)) { if (v && typeof v === 'object') store.set(k, { ...(store.get(k, {}) || {}), ...v }); }
        else if (typeof v === 'string' || typeof v === 'boolean') store.set(k, v);
      });
      parts.push('API key & koneksi'); reload = true;
    }
    renderPresets();
    presetMsg(`Diimpor: ${parts.join(', ')}.${reload ? ' Memuat ulang halaman…' : ''}`);
    if (reload) setTimeout(() => location.reload(), 900);
  });
  $('brandSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    setBrandMode(b.dataset.mode); draw();
  });
  $('sLogo').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = await prepLogo(f);
      await setLogoData(data);
      if (!state.logo) throw new Error();
      if ($('sBrandMode').value === 'text') setBrandMode('logo');
      draw();
    } catch { alert('Logo tidak bisa dibaca. Coba file PNG atau JPG.'); }
  });
  $('btnClearLogo').addEventListener('click', () => {
    setLogoData(null); $('sLogo').value = ''; setBrandMode('text'); draw();
  });

  // ---------- API untuk video.js ----------
  window.BK = { state, S, store, status, withCtx, drawCover, fitText, wrap, roundRect, drawBrand, drawKicker, fmtDate, escapeHtml, loadRemoteImage, loadImage, parseJson, clean, slug, thumb, parseJina, useArticle, isLink, draw, makeCaption, setInMode, applyArticleToUi, fillRaw, openPhotoPicker, photoUi };

  // ---------- Init ----------
  loadSettings();
  document.querySelectorAll('#fmtSeg button').forEach((x) => x.classList.toggle('on', x.dataset.fmt === state.fmt));
  const params = new URLSearchParams(location.search);
  (document.fonts ? Promise.all([document.fonts.load('900 60px Inter'), document.fonts.load('900 60px Merriweather'), document.fonts.load('700 20px Inter')]) : Promise.resolve())
    .catch(() => {}).then(() => {
      draw();
      // ?url=LINK atau ?q=KATA+KUNCI langsung diproses
      const first = params.get('url') || params.get('q');
      if (first) { setInMode('link'); $('url').value = first; run(); }
    });
  if (!store.get('sName', null) || !window.BKAI.anyReady()) setTimeout(() => status('Langkah pertama: buka ⚙ Pengaturan untuk mengisi nama media dan logo, lalu setel <b>Mesin AI</b>. Paling mudah: Groq (gratis, daftar ±2 menit) atau Puter (tanpa API key). <button type="button" class="linkish" data-open-ai>Atur Mesin AI</button>'), 300);
})();
