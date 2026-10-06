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
  const settingIds = ['sName', 'sHandle', 'sAccent', 'sPanel', 'sFont', 'sDateline', 'sBrandMode', 'sLogoScale', ...FX_IDS, 'gKey', 'gModel', 'cKey', 'cModel', 'sProxy'];
  const optIds = ['engine', 'length', 'platform', 'style'];
  // Isi preset akun media (API key sengaja tidak ikut)
  const PRESET_IDS = ['sName', 'sHandle', 'sAccent', 'sPanel', 'sFont', 'sDateline', 'sBrandMode', 'sLogoScale', ...FX_IDS, 'style', 'platform'];
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
  async function fetchHtml(url) {
    for (const p of proxies()) {
      try {
        const r = await fetchWithTimeout(p(url));
        if (!r.ok) continue;
        const txt = await r.text();
        if (txt && txt.length > 500 && /<html|<meta|<title/i.test(txt)) return txt;
      } catch {}
    }
    return null;
  }
  async function fetchJina(url) {
    try {
      const r = await fetchWithTimeout('https://r.jina.ai/' + url, { headers: { 'Accept': 'text/plain' } }, 25000);
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
  function bodyFromDom(doc) {
    const sels = ['[itemprop="articleBody"]', '.read__content', '.detail__body-text', '.detail-text', '.post-content', '.entry-content',
      '.article-content', '.article__content', '.content-detail', '.itp_bodycontent', '.txt-article', '.detail_text', 'article', 'main'];
    let root = null;
    for (const s of sels) { const el = doc.querySelector(s); if (el && el.querySelectorAll('p').length >= 2) { root = el; break; } }
    root = root || doc.body;
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
      section: meta(doc, 'article:section', 'content_category', 'section') || (ld && clean([].concat(ld.articleSection || [])[0])) || ''
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
      image: img, description: paras[0] || '', body: paras.join('\n\n'), author: '', section: ''
    };
  }

  // ---------- Gambar ----------
  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
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
  const cv = $('cv'), ctx = cv.getContext('2d');
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
      const lw = Math.min(cv.width * (s.mode === 'both' ? 0.35 : 0.55), h * ratio);
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
  function buildPrompt(a) {
    const s = S();
    const dl = (s.dateline || s.name).toUpperCase();
    const body = (a.body || a.description || '').slice(0, 9000);
    return `Anda adalah redaktur senior media daring Indonesia yang menulis dengan gaya Harian Kompas: lugas, berimbang, kalimat efektif, Bahasa Indonesia baku sesuai KBBI/PUEBI, tanpa sensasi dan tanpa emoji.

Tugas: dari ARTIKEL di bawah, buat bahan posting media sosial (${$('platform').value}).

ATURAN JURNALISTIK
1. Gunakan unsur 5W+1H (apa, siapa, kapan, di mana, mengapa, bagaimana) dan struktur piramida terbalik.
2. Paragraf pertama adalah lead ringkas (maks. 40 kata) yang menjawab apa, siapa, kapan, dan di mana. Awali dengan dateline: "NAMA KOTA, ${dl} —" (kota tempat peristiwa; jika tidak jelas pakai JAKARTA).
3. Paragraf berikutnya menjelaskan mengapa dan bagaimana, lalu konteks/latar dan—bila ada—satu kutipan langsung dengan atribusi jelas ("kata ...", "ujar ...").
4. HANYA gunakan fakta yang ada di artikel. Jangan menambah angka, nama, atau klaim. Jika satu unsur 5W+1H tidak tersedia, tulis "tidak disebutkan" pada analisis dan jangan mengarang.
5. Hari/tanggal ditulis gaya Kompas, mis. "Senin (5/10/2026)". Tanggal terbit artikel: ${a.date || 'tidak diketahui'}.
6. Panjang caption: ${LEN[$('length').value]}. Tutup dengan baris: "Sumber: ${a.site || 'media asal'}" dan ajakan singkat membaca selengkapnya (tanpa menulis URL).
7. "judul_gambar": judul untuk ditaruh di foto, maks. 12 kata, informatif, aktif, bukan clickbait, tanpa titik di akhir.
8. "kicker": 1–2 kata rubrik dalam huruf kapital (mis. NASIONAL, EKONOMI, OLAHRAGA, PENDIDIKAN).
9. "hashtags": 3–6 tagar relevan dalam Bahasa Indonesia, tanpa spasi.

Balas HANYA dengan JSON valid tanpa teks lain, dengan struktur:
{"judul_gambar":"","kicker":"","w5h1":{"apa":"","siapa":"","kapan":"","di_mana":"","mengapa":"","bagaimana":""},"caption":"","hashtags":[""]}

ARTIKEL
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
  async function callGemini(prompt) {
    const key = $('gKey').value.trim();
    if (!key) throw new Error('API key Gemini belum diisi di Pengaturan.');
    const model = $('gModel').value.trim() || 'gemini-2.5-flash';
    const r = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } })
    }, 90000);
    const j = await r.json();
    if (!r.ok) throw new Error('Gemini: ' + ((j.error && j.error.message) || r.status));
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    return parts.map((p) => p.text || '').join('');
  }
  async function callClaude(prompt) {
    const key = $('cKey').value.trim();
    if (!key) throw new Error('API key Claude belum diisi di Pengaturan.');
    const r = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: $('cModel').value.trim() || 'claude-sonnet-4-5', max_tokens: 2000, temperature: 0.4, messages: [{ role: 'user', content: prompt }] })
    }, 90000);
    const j = await r.json();
    if (!r.ok) throw new Error('Claude: ' + ((j.error && j.error.message) || r.status));
    return (j.content || []).map((c) => c.text || '').join('');
  }
  function templateCaption(a) {
    const s = S();
    const dl = (s.dateline || s.name).toUpperCase();
    const paras = (a.body || '').split(/\n{2,}/).filter(Boolean);
    const lead = a.description || paras[0] || a.title;
    const rest = paras.filter((p) => p !== lead).slice(0, $('length').value === 'pendek' ? 1 : $('length').value === 'sedang' ? 2 : 4);
    const text = [`JAKARTA, ${dl} — ${lead}`, ...rest, `Sumber: ${a.site}. Baca selengkapnya di tautan pada bio.`].join('\n\n');
    return { judul_gambar: a.title, kicker: a.section ? a.section.toUpperCase().split(/\s+/).slice(0, 2).join(' ') : '', w5h1: null, caption: text, hashtags: [] };
  }
  function renderW5h1(w) {
    const el = $('w5h1'); el.innerHTML = '';
    if (!w) return;
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
      if (engine === 'template') out = templateCaption(a);
      else {
        const raw = engine === 'gemini' ? await callGemini(buildPrompt(a)) : await callClaude(buildPrompt(a));
        out = parseJson(raw);
      }
      const tags = (out.hashtags || []).map((t) => '#' + String(t).replace(/^#/, '').replace(/\s+/g, '')).filter((t) => t.length > 1);
      $('caption').value = clean2(out.caption) + (tags.length ? '\n\n' + tags.join(' ') : '');
      renderW5h1(out.w5h1);
      if (updateHeadline && out.judul_gambar) $('headline').value = out.judul_gambar.replace(/\.$/, '');
      if (updateHeadline && out.kicker) $('kicker').value = out.kicker.toUpperCase();
      countWords(); draw();
      status(engine === 'template' ? 'Caption template dibuat. Untuk hasil 5W+1H yang utuh, pilih Gemini atau Claude.' : 'Selesai. Periksa kembali fakta sebelum diunggah.', 'ok');
    } catch (e) {
      status('Gagal membuat caption: ' + escapeHtml(e.message) + (engine !== 'template' ? ' — mencoba mode template.' : ''), 'err');
      if (engine !== 'template') { const out = templateCaption(a); $('caption').value = out.caption; renderW5h1(null); countWords(); }
    } finally { btn.disabled = false; btn.innerHTML = old; }
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
  // Foto default diambil dari link; unggah manual hanya muncul bila foto tidak ada/gagal
  function photoUi(mode) {
    const info = $('photoInfo'), box = $('photoUpload');
    if (mode === 'ok') {
      info.innerHTML = 'Foto diambil dari sumber berita. <button type="button" class="linkish" id="btnShowUpload">Foto kurang cocok? Unggah sendiri</button>';
      $('btnShowUpload').addEventListener('click', () => photoUi('fail'));
      box.hidden = true;
    } else if (mode === 'fail') {
      info.textContent = 'Foto dari sumber tidak tersedia atau tidak bisa diambil. Silakan unggah foto manual.';
      box.hidden = false;
    } else if (mode === 'manual') {
      info.textContent = 'Memakai foto unggahan Anda.';
      box.hidden = false;
    } else {
      info.textContent = 'Foto diambil otomatis dari link berita.';
      box.hidden = true;
    }
  }
  async function setPhoto(url) {
    if (!url) { state.photo = null; draw(); photoUi('fail'); return false; }
    try { state.photo = await loadRemoteImage(url); draw(); photoUi('ok'); return true; }
    catch { state.photo = null; draw(); photoUi('fail'); return false; }
  }

  async function run() {
    let url = $('url').value.trim();
    if (!url) { status('Tempel link berita dulu.', 'err'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const btn = $('btnGo'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Memproses';
    try {
      status('<span class="spin"></span>Mengambil halaman berita…');
      let a = null;
      const html = await fetchHtml(url);
      if (html) a = parseHtml(html, url);
      if (!a || !a.title || a.body.length < 200) {
        status('<span class="spin"></span>Mencoba pembaca cadangan…');
        const j = await fetchJina(url);
        if (j) {
          const b = parseJina(j, url);
          a = a ? { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v)), body: (a.body.length > b.body.length ? a.body : b.body) } : b;
        }
      }
      if (!a || !a.title) {
        status('Halaman tidak bisa diambil (situs memblokir). Buka bagian "Bahan artikel", tempel judul & isi, lalu klik "Pakai bahan ini".', 'err');
        $('artTitle').value = ''; document.querySelector('.raw').open = true; return;
      }
      state.article = a; fillRaw(a); applyArticleToUi(a); draw();
      status('<span class="spin"></span>Mengambil foto…');
      const okPhoto = await setPhoto(a.image);
      if (!okPhoto) status('Foto tidak bisa diambil dari sumber — silakan unggah foto manual. Menulis caption…', 'err');
      else status('<span class="spin"></span>Menulis caption 5W+1H…');
      await makeCaption(true);
      if (!okPhoto) status('Caption selesai, tetapi foto perlu diunggah manual (kotak "Unggah foto manual" di bawah gambar).', 'err');
    } catch (e) {
      status('Terjadi kesalahan: ' + escapeHtml(e.message), 'err');
    } finally { btn.disabled = false; btn.textContent = 'Proses'; }
  }

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
  $('photoFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    state.photo = await loadImage(URL.createObjectURL(f)); draw(); photoUi('manual');
  });
  $('btnDownload').addEventListener('click', () => {
    draw();
    try {
      const a = document.createElement('a');
      const slug = ($('headline').value || 'posting').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/-$/, '');
      a.download = slug + '.png'; a.href = cv.toDataURL('image/png'); a.click();
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
  $('btnPresetExport').addEventListener('click', () => {
    const all = getPresets();
    if (!Object.keys(all).length) { presetMsg('Belum ada preset untuk diekspor.', true); return; }
    const blob = new Blob([JSON.stringify({ app: 'berita-kilat', version: 1, presets: all }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'berita-kilat-preset.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    presetMsg('File preset diunduh. Impor file ini di browser/perangkat lain.');
  });
  $('presetImport').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const inc = j && j.presets && typeof j.presets === 'object' ? j.presets : null;
      if (!inc) throw new Error();
      const all = { ...getPresets(), ...inc };
      if (!store.set('presets', all)) { presetMsg('Penyimpanan browser penuh, impor gagal.', true); return; }
      renderPresets(); presetMsg(`${Object.keys(inc).length} preset diimpor.`);
    } catch { presetMsg('File preset tidak valid.', true); }
    e.target.value = '';
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

  // ---------- Init ----------
  loadSettings();
  document.querySelectorAll('#fmtSeg button').forEach((x) => x.classList.toggle('on', x.dataset.fmt === state.fmt));
  const params = new URLSearchParams(location.search);
  (document.fonts ? Promise.all([document.fonts.load('900 60px Inter'), document.fonts.load('900 60px Merriweather'), document.fonts.load('700 20px Inter')]) : Promise.resolve())
    .catch(() => {}).then(() => {
      draw();
      if (params.get('url')) { $('url').value = params.get('url'); run(); }
    });
  if (!store.get('sName', null)) setTimeout(() => status('Langkah pertama: buka ⚙ Pengaturan untuk mengisi nama media, logo, warna, dan API key.'), 300);
})();
