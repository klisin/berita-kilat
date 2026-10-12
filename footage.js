/* Berita Kilat — footage per adegan untuk Video Short.
   Sumber: foto lain di artikel, Wikimedia Commons, Openverse (tanpa key), dan Pixabay / Pexels (foto stok + klip video, key gratis).
   Semua sumber mengizinkan CORS sehingga bisa digambar ke canvas dan di-encode. */
(() => {
  'use strict';
  const BK = window.BK;
  if (!BK) return;
  const $ = (id) => document.getElementById(id);
  const esc = BK.escapeHtml;
  const SCENES = ['hook', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'outro'];
  const LABEL = { hook: 'Hook', outro: 'Penutup' };
  for (let i = 0; i < 6; i++) LABEL['p' + i] = 'Poin ' + (i + 1);
  const MAIN = { main: true, type: 'photo', source: 'Foto utama' };

  const st = {
    scenes: {},      // key → item ({main} | {type,url,thumb,credit,source,el})
    results: {},     // key → hasil pencarian terakhir (untuk galeri)
    keywords: [],    // [{id,en}] dari naskah AI (hook, poin 1–6)
    busy: false, msg: '', open: null,
    userVideo: null  // video unggahan pengguna (mode 🎬 Video) → latar semua adegan, diputar bersambung
  };
  let runId = 0;
  const pexelsKey = () => (BK.store.get('pexelsKey', '') || '').trim();
  const pixabayKey = () => (BK.store.get('pixabayKey', '') || '').trim();
  const hasStock = () => !!(pixabayKey() || pexelsKey());
  const stockNames = () => [pixabayKey() && 'Pixabay', pexelsKey() && 'Pexels'].filter(Boolean).join(', ');
  const preferVideo = () => !!BK.store.get('fPreferVideo', false) && hasStock();

  // ---------- Pencarian ----------
  async function getJson(url, opts = {}, ms = 15000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { ...opts, signal: ctl.signal });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return await r.json();
    } finally { clearTimeout(t); }
  }
  const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const thumbOf = (u) => 'https://images.weserv.nl/?url=' + encodeURIComponent(u.replace(/^https?:\/\//, '')) + '&w=240&h=240&fit=cover&output=jpg';

  async function searchWikimedia(q, n = 12) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6' +
      `&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrlimit=${n}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1280`;
    const j = await getJson(url);
    const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
    return pages.map((p) => {
      const ii = (p.imageinfo || [])[0]; if (!ii || !/jpeg|png|webp/.test(ii.mime || '') || (ii.width || 0) < 600) return null;
      const md = ii.extmetadata || {};
      const who = stripHtml(md.Artist && md.Artist.value).slice(0, 60) || 'Wikimedia';
      const lic = stripHtml(md.LicenseShortName && md.LicenseShortName.value);
      return { type: 'photo', url: ii.thumburl || ii.url, thumb: ii.thumburl || ii.url, w: ii.width, h: ii.height,
        credit: `${who} / Wikimedia Commons${lic ? ' (' + lic + ')' : ''}`, source: 'Wikimedia Commons' };
    }).filter(Boolean);
  }
  async function searchOpenverse(q, n = 12) {
    const j = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&mature=false`);
    return (j.results || []).filter((r) => r.url && (r.width || 1000) >= 600).map((r) => ({
      type: 'photo', url: r.url, thumb: r.thumbnail || thumbOf(r.url), w: r.width, h: r.height,
      credit: `${(r.creator || 'Anonim').slice(0, 50)} / ${r.source || 'Openverse'}${r.license ? ' (CC ' + String(r.license).toUpperCase() + (r.license_version ? ' ' + r.license_version : '') + ')' : ''}`,
      source: r.source === 'wikimedia' ? 'Wikimedia Commons' : 'Openverse'
    }));
  }
  async function searchPexelsPhotos(q, n = 12) {
    const j = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait&locale=id-ID`, { headers: { Authorization: pexelsKey() } });
    return (j.photos || []).map((p) => ({ type: 'photo', url: p.src.large2x || p.src.portrait || p.src.original, thumb: p.src.tiny || p.src.small,
      w: p.width, h: p.height, credit: `${p.photographer} / Pexels`, source: 'Pexels' }));
  }
  async function searchPexelsVideos(q, n = 8) {
    const j = await getJson(`https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait&locale=id-ID`, { headers: { Authorization: pexelsKey() } });
    return (j.videos || []).map((v) => {
      // File MP4 dengan tinggi ±1280: cukup tajam, unduhan tidak terlalu besar
      const files = (v.video_files || []).filter((f) => /mp4/.test(f.file_type || '') && f.height >= 720)
        .sort((a, b) => Math.abs(a.height - 1280) - Math.abs(b.height - 1280));
      const f = files[0]; if (!f) return null;
      return { type: 'video', url: f.link, thumb: v.image, w: f.width, h: f.height, duration: v.duration,
        credit: `${(v.user && v.user.name) || 'Pexels'} / Pexels`, source: 'Pexels' };
    }).filter(Boolean);
  }
  // Pixabay: foto & klip video, CORS terbuka (API dan CDN)
  async function searchPixabayPhotos(q, n = 12) {
    const j = await getJson(`https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey())}&q=${encodeURIComponent(q.slice(0, 100))}&image_type=photo&per_page=${Math.max(3, n)}&safesearch=true&min_width=800`);
    return (j.hits || []).map((h) => ({ type: 'photo', url: h.largeImageURL || h.webformatURL, thumb: h.previewURL || h.webformatURL,
      w: h.imageWidth, h: h.imageHeight, credit: `${h.user || 'Pixabay'} / Pixabay`, source: 'Pixabay' }));
  }
  async function searchPixabayVideos(q, n = 8) {
    const j = await getJson(`https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabayKey())}&q=${encodeURIComponent(q.slice(0, 100))}&per_page=${Math.max(3, n)}&safesearch=true`);
    return (j.hits || []).map((h) => {
      // Ukuran dengan sisi terpendek ±720: cukup tajam, unduhan tidak terlalu besar
      const files = Object.values(h.videos || {}).filter((f) => f && f.url && Math.min(f.width, f.height) >= 540)
        .sort((a, b) => Math.abs(Math.min(a.width, a.height) - 720) - Math.abs(Math.min(b.width, b.height) - 720));
      const f = files[0]; if (!f) return null;
      const thumb = f.thumbnail || (h.videos.tiny && h.videos.tiny.thumbnail) || '';
      return { type: 'video', url: f.url, thumb, w: f.width, h: f.height, duration: h.duration,
        credit: `${h.user || 'Pixabay'} / Pixabay`, source: 'Pixabay' };
    }).filter((x) => x && x.thumb);
  }
  const settle = (p) => p.then((x) => x, () => []);
  async function searchAll(kw, opts = {}) {
    const q = (kw && kw.id) || '', en = (kw && kw.en) || q;
    const key = !!pexelsKey();
    // Sumber gratis: bila kata kunci panjang tidak memberi hasil, persingkat bertahap
    const free = async (query) => {
      const words = query.split(/\s+/).filter(Boolean);
      for (let n = words.length; n >= Math.min(2, words.length) && n > 0; n--) {
        const qq = words.slice(0, n).join(' ');
        const [a, b] = await Promise.all([settle(searchWikimedia(qq)), settle(searchOpenverse(qq))]);
        if (a.length + b.length >= 3 || n <= 2) return [a, b];
      }
      return [[], []];
    };
    const pxb = !!pixabayKey();
    const [vids, pp, xv, xp, [wm, ov]] = await Promise.all([
      key && opts.video ? settle(searchPexelsVideos(en)) : [],
      key ? settle(searchPexelsPhotos(en)) : [],
      pxb && opts.video ? settle(searchPixabayVideos(en)) : [],
      pxb ? settle(searchPixabayPhotos(en)) : [],
      q ? free(q) : [[], []]
    ]);
    const seen = new Set(), out = [];
    const base = (u) => { try { return decodeURIComponent((u || '').split('?')[0].split('/').pop() || '').toLowerCase(); } catch { return u; } };
    [...xv, ...vids, ...wm, ...ov, ...xp, ...pp].forEach((it) => { const b = base(it.url); if (!seen.has(b)) { seen.add(b); out.push(it); } });
    return out;
  }

  // ---------- Memuat media ----------
  function loadImgCors(url) {
    return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = url; });
  }
  function videoFromSrc(src) {
    return new Promise((res, rej) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = true; v.crossOrigin = 'anonymous';
      const to = setTimeout(() => rej(new Error('timeout')), 30000);
      v.onloadeddata = async () => {
        clearTimeout(to); v.width = v.videoWidth; v.height = v.videoHeight;
        // WebM dari perekam browser/HP sering tanpa durasi (Infinity): paksa browser menghitungnya
        if (!isFinite(v.duration)) {
          await new Promise((ok) => { const d = () => { if (isFinite(v.duration)) { v.removeEventListener('durationchange', d); ok(); } }; v.addEventListener('durationchange', d); setTimeout(ok, 5000); v.currentTime = 1e101; });
          v.currentTime = 0;
        }
        res(v);
      };
      v.onerror = () => { clearTimeout(to); rej(new Error('video')); };
      v.src = src;
    });
  }
  async function loadEl(it) {
    if (it.el) return it.el;
    if (it.file) {
      const u = URL.createObjectURL(it.file);
      it.el = it.type === 'video' ? await videoFromSrc(u) : await BK.loadImage(u);
      return it.el;
    }
    if (it.type === 'video') {
      const r = await fetch(it.url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = await r.blob();
      if (b.size > 80 * 1048576) throw new Error('klip terlalu besar');
      it.el = await videoFromSrc(URL.createObjectURL(b));
      return it.el;
    }
    try { it.el = await loadImgCors(it.url); } catch { it.el = await BK.loadRemoteImage(it.url); }
    return it.el;
  }

  // ---------- Isi otomatis ----------
  async function autoFill(keywords, article) {
    const my = ++runId;
    st.keywords = Array.isArray(keywords) ? keywords : [];
    st.results = {};
    // Video pengguna diutamakan: jangan ditimpa pencarian otomatis (galeri "Tukar" tetap bisa dipakai)
    if (st.userVideo) {
      SCENES.forEach((k) => { st.scenes[k] = st.userVideo; });
      st.busy = false; st.msg = 'Semua adegan memakai video Anda. Klik "Tukar" untuk mengganti adegan tertentu.';
      render(); refreshVideo(); return;
    }
    st.scenes = { hook: MAIN, outro: MAIN };
    st.busy = true; st.msg = 'Mencari footage untuk tiap adegan…'; render();
    const a = article || BK.state.article || {};
    const pool = (a.images || []).filter((u) => u && u !== a.image).map((u) => ({ type: 'photo', url: u, thumb: thumbOf(u), credit: a.site || 'Artikel', source: 'Artikel' }));
    const fallbackKw = { id: (a.title || '').split(/\s+/).slice(0, 4).join(' '), en: '' };
    const video = preferVideo();
    // Cari paralel untuk semua adegan poin, lalu bagi hasil tanpa duplikat
    const lists = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => searchAll(st.keywords[i + 1] || st.keywords[0] || fallbackKw, { video })));
    if (my !== runId) return;
    const used = new Set([a.image]);
    const tasks = [];
    for (let i = 0; i < 6; i++) {
      const key = 'p' + i;
      st.results[key] = lists[i];
      const cands = [];
      if (video) cands.push(...lists[i].filter((x) => x.type === 'video'));
      // Mode kata kunci: foto artikel bercampur dari banyak berita, jadi utamakan hasil pencarian
      // per item (mis. nama produk); mode link: foto lain di artikel lebih relevan
      const research = a.mode === 'research';
      if (pool.length && !research) cands.push(pool.shift());
      cands.push(...lists[i].filter((x) => x.type === 'photo'));
      if (pool.length && research) cands.push(pool.shift());
      tasks.push((async () => {
        for (const c of cands) {
          if (!c || used.has(c.url)) continue;
          used.add(c.url);
          try { await loadEl(c); if (my !== runId) return; st.scenes[key] = c; render(); refreshVideo(); return; }
          catch { /* coba kandidat berikutnya */ }
        }
      })());
    }
    await Promise.all(tasks);
    if (my !== runId) return;
    const n = SCENES.filter((k) => st.scenes[k] && !st.scenes[k].main).length;
    st.busy = false;
    st.msg = n ? `${n} adegan memakai footage alternatif. Klik "Tukar" untuk mengganti.` : 'Footage alternatif tidak ditemukan; semua adegan memakai foto utama. Coba "Tukar" dengan kata kunci lain.';
    render(); refreshVideo();
  }

  async function setScene(key, it) {
    st.open = null;
    if (!it || it.main) { st.scenes[key] = MAIN; render(); refreshVideo(); return; }
    st.msg = 'Memuat footage…'; render();
    try { await loadEl(it); st.scenes[key] = it; st.msg = `${LABEL[key]}: footage diganti.`; }
    catch { st.msg = 'Footage tidak bisa dimuat. Pilih yang lain.'; }
    render(); refreshVideo();
  }

  // Video unggahan sebagai latar seluruh Video Short (satu elemen dipakai semua adegan)
  async function setUserVideo(file, start = 0) {
    runId++; // batalkan pencarian otomatis yang sedang berjalan
    const it = { type: 'video', file, source: 'Unggahan', credit: file.name, continuous: true, start: Math.max(0, start || 0) };
    await loadEl(it);
    st.userVideo = it; st.open = null; st.busy = false;
    SCENES.forEach((k) => { st.scenes[k] = it; });
    st.msg = 'Semua adegan memakai video Anda. Klik "Tukar" untuk mengganti adegan tertentu.';
    render();
    if (window.BKVideo && window.BKVideo.onUserVideo) window.BKVideo.onUserVideo(it);
    refreshVideo();
    return it;
  }
  function clearUserVideo() {
    if (!st.userVideo) return;
    const it = st.userVideo; st.userVideo = null;
    try { it.el.pause(); URL.revokeObjectURL(it.el.src); } catch {}
    SCENES.forEach((k) => { if (st.scenes[k] === it) st.scenes[k] = MAIN; });
    if (window.BKVideo && window.BKVideo.onUserVideo) window.BKVideo.onUserVideo(null);
    render(); refreshVideo();
  }

  // ---------- API untuk video.js ----------
  function mediaFor(key) {
    const it = st.scenes[key];
    if (!it || it.main || !it.el) return null;
    return { el: it.el, type: it.type, continuous: !!it.continuous, start: it.start || 0 };
  }
  function activeItems() { return [...new Set(SCENES.map((k) => st.scenes[k]).filter((x) => x && !x.main && x.el))]; }
  function sourcesLine() {
    const s = [...new Set(activeItems().filter((x) => x.source !== 'Unggahan').map((x) => x.source === 'Artikel' ? (BK.state.article.site || 'Artikel') : x.source))];
    return s.join(', ');
  }
  function credits() {
    const site = BK.state.article.site;
    const lines = [];
    if (site) lines.push(`Foto utama: ${site}`);
    SCENES.forEach((k) => { const it = st.scenes[k]; if (it && !it.main && it.source !== 'Unggahan' && it.source !== 'Artikel') lines.push(`${LABEL[k]}: ${it.credit}`); });
    return lines;
  }
  const refreshVideo = () => { if (window.BKVideo) window.BKVideo.refresh(); };

  // ---------- UI: Footage per adegan ----------
  function rowHtml(key, shown) {
    const it = st.scenes[key] || MAIN;
    // Foto utama & unggahan memakai thumbnail canvas (URL blob aslinya sudah dilepas)
    const thumb = it.main ? BK.thumb(BK.state.photo) : (it.file ? BK.thumb(it.el) : it.thumb);
    const media = thumb
      ? `<img src="${esc(thumb)}" alt="" loading="lazy">`
      : '<span class="muted">—</span>';
    const label = it.main ? 'Foto utama berita' : `${esc(it.source)} · ${esc(it.credit || '')}`;
    let html = `<div class="ft-row${shown ? '' : ' dim'}" data-key="${key}">
      <div class="ft-th">${media}${it.type === 'video' && !it.main ? '<span class="ft-play">▶</span>' : ''}</div>
      <div class="ft-info"><b>${LABEL[key]}</b>${shown ? '' : ' <span class="muted">(tidak tampil di durasi ini)</span>'}<br><span class="muted">${label}</span></div>
      <div class="ft-act">
        <button type="button" class="ghost small" data-ft="swap">Tukar</button>
        <label class="ghost small btn-like" title="Unggah foto/klip sendiri">⬆<input type="file" accept="image/*,video/*" data-ft="upload" hidden></label>
        ${it.main ? '' : '<button type="button" class="ghost small" data-ft="main" title="Kembali ke foto utama">↺</button>'}
      </div></div>`;
    if (st.open === key) {
      const kw = key === 'hook' ? st.keywords[0] : key === 'outro' ? st.keywords[0] : st.keywords[parseInt(key.slice(1), 10) + 1];
      const q = (st.gq && st.gq[key]) || (kw && kw.id) || (BK.state.article.title || '').split(/\s+/).slice(0, 4).join(' ');
      const list = st.results[key] || [];
      const pool = (BK.state.article.images || []).map((u) => ({ type: 'photo', url: u, thumb: thumbOf(u), credit: BK.state.article.site || 'Artikel', source: 'Artikel' }));
      const all = [...pool, ...list];
      html += `<div class="ft-gal" data-key="${key}">
        <div class="row"><input type="text" data-ft="q" value="${esc(q)}" placeholder="Kata kunci, mis. stasiun kereta cepat"><button type="button" class="secondary small" data-ft="search">Cari</button></div>
        <p class="hint">${st.searching === key ? '<span class="spin"></span>Mencari…' : `${all.length} hasil · Artikel, Wikimedia Commons, Openverse${hasStock() ? ', ' + stockNames() : ' (isi API key Pixabay di Pengaturan untuk foto stok & klip video)'}`}</p>
        <div class="ft-grid">${all.map((x, i) => `<button type="button" class="ft-cell" data-ft="pick" data-i="${i}" title="${esc(x.credit)}"><img src="${esc(x.thumb)}" alt="" loading="lazy">${x.type === 'video' ? '<span class="ft-play">▶</span>' : ''}<span class="ft-src">${esc(x.source)}</span></button>`).join('')}</div>
      </div>`;
      st.galItems = all;
    }
    return html;
  }
  function render() {
    const box = $('footBox'); if (!box) return;
    const shown = window.BKVideo && window.BKVideo.shownPoints ? window.BKVideo.shownPoints() : 6;
    const has = hasStock();
    box.innerHTML = `<div class="card-h"><h2 style="font-size:15px">Footage per adegan</h2>
        <div class="row" style="gap:8px">
          <button type="button" class="ghost small" data-ft="credits">Salin kredit foto</button>
          <button type="button" class="secondary small" data-ft="auto">↻ Cari ulang otomatis</button>
        </div></div>
      <label class="ft-opt"><input type="checkbox" data-ft="prefer" ${BK.store.get('fPreferVideo', false) ? 'checked' : ''} ${has ? '' : 'disabled'}>
        Utamakan klip video (${has ? stockNames() : 'Pixabay'})${has ? '' : ' <span class="muted">— isi API key Pixabay (gratis) di <button type="button" class="linkish" data-ft="settings">Pengaturan</button></span>'}</label>
      <p class="hint">${st.busy ? '<span class="spin"></span>' : ''}${esc(st.msg || 'Footage dicari otomatis setelah naskah video dibuat.')}</p>
      <div class="ft-list">${SCENES.map((k) => rowHtml(k, !/^p\d$/.test(k) || parseInt(k.slice(1), 10) < shown)).join('')}</div>`;
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('#footBox [data-ft], #footKeyBox [data-ft]'); if (!b) return;
    const act = b.dataset.ft, row = b.closest('[data-key]'), key = row && row.dataset.key;
    if (act === 'swap') {
      st.open = st.open === key ? null : key; render();
      if (st.open && !(st.results[key] || []).length) doSearch(key);
    } else if (act === 'main') setScene(key, MAIN);
    else if (act === 'search') doSearch(key);
    else if (act === 'pick') setScene(key, st.galItems[parseInt(b.dataset.i, 10)]);
    else if (act === 'auto') autoFill(st.keywords, BK.state.article);
    else if (act === 'settings') { $('dlg').showModal(); $('footKeyBox').scrollIntoView({ block: 'center' }); }
    else if (act === 'credits') {
      const txt = 'Kredit foto:\n' + credits().join('\n');
      try { await navigator.clipboard.writeText(txt); BK.status('Kredit foto tersalin. Tempel di akhir caption.', 'ok'); }
      catch { BK.status(esc(txt).replace(/\n/g, '<br>'), 'ok'); }
    } else if (act === 'xtest') {
      BK.store.set('pixabayKey', $('pixKey').value.trim());
      const msg = $('pixMsg'); msg.textContent = 'Mengetes…'; msg.className = 'ai-msg';
      try { const r = await searchPixabayPhotos('city', 3); msg.textContent = r.length ? '✓ Terhubung' : '✓ Terhubung (tanpa hasil)'; msg.className = 'ai-msg ok'; render(); }
      catch (err) { msg.textContent = err.status === 400 || err.status === 401 || err.status === 403 ? 'API key Pixabay salah' : err.status === 429 ? 'Terlalu sering, coba lagi sebentar' : 'Gagal terhubung ke Pixabay'; msg.className = 'ai-msg err'; }
    } else if (act === 'ptest') {
      const msg = $('pexMsg'); msg.textContent = 'Mengetes…';
      try { const r = await searchPexelsPhotos('city', 1); msg.textContent = r.length ? '✓ Terhubung' : '✓ Terhubung (tanpa hasil)'; msg.className = 'ai-msg ok'; }
      catch (err) { msg.textContent = err.status === 401 || err.status === 403 ? 'API key Pexels salah' : 'Gagal terhubung ke Pexels'; msg.className = 'ai-msg err'; }
    }
  });
  async function doSearch(key) {
    const inp = document.querySelector(`#footBox .ft-gal[data-key="${key}"] [data-ft="q"]`);
    const q = inp ? inp.value.trim() : '';
    st.gq = st.gq || {}; if (q) st.gq[key] = q;
    st.searching = key; render();
    st.results[key] = await searchAll({ id: q, en: q }, { video: hasStock() });
    st.searching = null; render();
  }
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('#footBox [data-ft="prefer"]')) { BK.store.set('fPreferVideo', t.checked); return; }
    if (t.matches('#footBox [data-ft="upload"]')) {
      const f = t.files[0]; const key = t.closest('[data-key]').dataset.key;
      if (f) setScene(key, { type: f.type.startsWith('video') ? 'video' : 'photo', file: f, source: 'Unggahan', credit: f.name });
      return;
    }
    if (t.id === 'pexKey') { BK.store.set('pexelsKey', t.value.trim()); render(); }
    if (t.id === 'pixKey') { BK.store.set('pixabayKey', t.value.trim()); render(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('#footBox [data-ft="q"]')) { e.preventDefault(); doSearch(e.target.closest('[data-key]').dataset.key); }
  });

  // Thumbnail galeri yang gagal dimuat disembunyikan (tanpa handler inline, agar sesuai CSP)
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (im && im.tagName === 'IMG' && im.closest && im.closest('.ft-cell')) im.closest('.ft-cell').style.display = 'none';
  }, true);

  // Pengaturan: API key Pixabay (utama) & Pexels (bagi yang sudah punya key)
  function renderKeyBox() {
    const box = $('footKeyBox'); if (!box) return;
    box.innerHTML = `<h3>Sumber footage video</h3>
      <p class="hint">Tanpa pengaturan apa pun, footage dicari dari foto di artikel, Wikimedia Commons, dan Openverse.
      Tambahkan API key <b>Pixabay</b> (gratis, langsung jadi) untuk foto stok berkualitas dan <b>klip video</b>.</p>
      <ol class="ai-steps"><li>Klik <b>Buka halaman API key</b>, lalu daftar/masuk (bisa dengan Google).</li><li>Setelah masuk, buka lagi halaman itu dan gulir ke bagian <b>Parameters → key</b>: API key Anda tertulis di sana (huruf hijau).</li><li>Salin key lalu tempel di kolom di bawah, klik <b>Tes</b>.</li></ol>
      <div class="row gap"><a class="ghost small btn-like" href="https://pixabay.com/api/docs/#api_search_images" target="_blank" rel="noopener">Buka halaman API key ↗</a></div>
      <label class="lbl" for="pixKey">API key Pixabay</label>
      <div class="row"><input id="pixKey" type="password" value="${esc(pixabayKey())}" placeholder="Tempel API key Pixabay" autocomplete="off">
      <button type="button" class="secondary small" data-ft="xtest">Tes</button></div>
      <p class="hint"><span class="ai-msg" id="pixMsg"></span></p>
      <details class="raw"><summary>Pexels (hanya bila sudah punya key)</summary>
        <p class="hint">Pendaftaran API key baru Pexels sedang ditutup oleh Pexels. Key lama tetap bisa dipakai bersamaan dengan Pixabay.</p>
        <label class="lbl" for="pexKey">API key Pexels</label>
        <div class="row"><input id="pexKey" type="password" value="${esc(pexelsKey())}" placeholder="Tempel API key Pexels" autocomplete="off">
        <button type="button" class="secondary small" data-ft="ptest">Tes</button></div>
        <p class="hint"><span class="ai-msg" id="pexMsg"></span></p>
      </details>`;
  }

  // Galeri pemilih foto tunggal (dipakai kartu Gambar): foto artikel + hasil pencarian, tanpa klip video
  function openPicker(box, opts = {}) {
    const pk = { q: opts.query || '', items: [], busy: false, msg: '' };
    const draw = () => {
      box.innerHTML = `<div class="ft-gal">
        <div class="row"><input type="text" data-pk="q" value="${esc(pk.q)}" placeholder="Kata kunci foto, mis. stasiun kereta cepat"><button type="button" class="secondary small" data-pk="search">Cari</button></div>
        <p class="hint">${pk.busy ? '<span class="spin"></span>Mencari foto…' : esc(pk.msg)}</p>
        <div class="ft-grid">${pk.items.map((x, i) => `<button type="button" class="ft-cell" data-pk="pick" data-i="${i}" title="${esc(x.credit)}"><img src="${esc(x.thumb)}" alt="" loading="lazy"><span class="ft-src">${esc(x.source)}</span></button>`).join('')}</div>
      </div>`;
    };
    const search = async () => {
      pk.busy = true; draw();
      const a = BK.state.article || {};
      const art = (a.images || []).map((u) => ({ type: 'photo', url: u, thumb: thumbOf(u), credit: a.site || 'Artikel', source: 'Artikel' }));
      const res = pk.q ? (await searchAll({ id: pk.q, en: pk.q }, { video: false })).filter((x) => x.type === 'photo') : [];
      pk.items = [...art, ...res];
      pk.busy = false;
      pk.msg = pk.items.length ? `${pk.items.length} foto · Artikel, Wikimedia Commons, Openverse${hasStock() ? ', ' + stockNames() : ''}. Klik untuk memakai.` : 'Tidak ada hasil. Coba kata kunci lain.';
      draw();
    };
    box.onclick = async (e) => {
      const b = e.target.closest('[data-pk]'); if (!b) return;
      if (b.dataset.pk === 'search') { pk.q = box.querySelector('[data-pk="q"]').value.trim(); search(); return; }
      if (b.dataset.pk === 'pick') {
        const it = pk.items[parseInt(b.dataset.i, 10)];
        pk.msg = 'Memuat foto…'; draw();
        try { const el = await loadEl(it); if (opts.onPick) opts.onPick(it, el); pk.msg = 'Dipakai: ' + it.credit; }
        catch { pk.msg = 'Foto tidak bisa dimuat. Pilih yang lain.'; }
        draw();
      }
    };
    box.onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-pk="q"]')) { e.preventDefault(); pk.q = e.target.value.trim(); search(); }
    };
    draw(); search();
  }

  window.BKFootage = { autoFill, setUserVideo, clearUserVideo, userVideo: () => st.userVideo, mediaFor, sourcesLine, credits, render, setScene, searchAll, activeItems, openPicker, loadEl };
  st.scenes = { hook: MAIN, outro: MAIN };
  renderKeyBox(); render();
})();
