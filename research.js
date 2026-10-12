/* Berita Kilat — mode kata kunci: cari berita terkini lalu rangkum dari beberapa sumber.
   Pencarian memakai RSS Google News (berbahasa Indonesia), dibaca lewat r.jina.ai yang mengizinkan CORS
   dan sekaligus mengikuti tautan Google News ke artikel aslinya. */
(() => {
  'use strict';
  const BK = window.BK;
  if (!BK) return;
  const $ = (id) => document.getElementById(id);
  const esc = BK.escapeHtml;
  const RANGE = { '7d': 'when:7d', '30d': 'when:30d', '1y': 'when:1y' };
  const st = { query: '', results: [], read: {}, busy: false };

  // API key Jina opsional (gratis): tanpa key, Jina kadang memblokir akses anonim ke domain tertentu
  const jinaKey = () => (BK.store.get('jinaKey', '') || '').trim();
  async function jina(url, ms = 25000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    const headers = { Accept: 'text/plain' };
    if (jinaKey()) headers.Authorization = 'Bearer ' + jinaKey();
    try {
      const r = await fetch('https://r.jina.ai/' + url, { headers, signal: ctl.signal });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw Object.assign(new Error('HTTP ' + r.status), { status: r.status, blocked: /AbuseAlleviation|blocked/i.test(body) });
      }
      return await r.text();
    } finally { clearTimeout(t); }
  }
  const safeHref = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
  const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const siteOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  // Item RSS dirender Jina sebagai: ### [Judul](link)
  const items = (txt) => [...txt.matchAll(/^#{2,4}\s*\[(.+?)\]\((https?:\/\/[^)\s]+)\)/gm)].map((m) => [m[1].replace(/\\([[\]])/g, '$1').trim(), m[2]]);

  // ---------- Cari ----------
  // Google Berita: judul berformat "Judul - Media", link lewat news.google.com
  async function searchGoogle(q, range) {
    const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' ' + (RANGE[range] || RANGE['30d']))}&hl=id&gl=ID&ceid=ID:id`;
    return items(await jina(rss)).map(([full, url]) => {
      const cut = full.lastIndexOf(' - ');
      return { title: cut > 10 ? full.slice(0, cut).trim() : full, site: cut > 10 ? full.slice(cut + 3).trim() : '', url };
    });
  }
  // Bing Berita: link apiclick berisi URL artikel asli (parameter url=), jadi pembacaan tidak lewat Google
  async function searchBing(q, range) {
    const interval = { '7d': '8', '30d': '9' }[range];
    const rss = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=id&cc=ID${interval ? '&qft=' + encodeURIComponent(`interval="${interval}"`) : ''}`;
    return items(await jina(rss)).map(([title, link]) => {
      let url = link;
      try { const real = new URL(link).searchParams.get('url'); if (real) url = real; } catch {}
      return { title, site: siteOf(url), url };
    }).filter((x) => !/bing\.com/.test(siteOf(x.url)));
  }
  // Relevansi judul terhadap kata kunci (dengan sinonim umum), agar berita yang tidak nyambung
  // (mis. "waktu terbaik minum protein" untuk "handphone terbaik") tidak ikut dirangkum
  const SYN = [['handphone', 'hp', 'ponsel', 'smartphone', 'gawai'], ['laptop', 'notebook'], ['mobil', 'kendaraan'], ['motor', 'sepeda motor'], ['harga', 'rp']];
  const WEAK = /^(terbaik|terbaru|bagus|murah|rekomendasi|daftar|pilihan|top)$/;
  const STOP = /^(saat|ini|yang|dan|di|ke|dari|untuk|pada|dengan|apa|apakah|bagaimana|berapa|sekarang|tahun|\d+)$/;
  function relevance(q, title) {
    const t = ' ' + norm(title) + ' ';
    let score = 0;
    norm(q).split(' ').filter((w) => w && !STOP.test(w)).forEach((w) => {
      const group = SYN.find((g) => g.includes(w)) || [w];
      const hit = group.some((s) => t.includes(' ' + s + ' ') || (s.length > 4 && t.includes(s)));
      if (hit) score += WEAK.test(w) ? 0.3 : 1;
    });
    return score;
  }
  // Kedua sumber dicari bersamaan; bila salah satu diblokir/gagal, yang lain tetap dipakai
  async function search(q, range) {
    const [g, b] = await Promise.allSettled([searchGoogle(q, range), searchBing(q, range)]);
    const lists = [g, b].filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (!lists.length) throw (g.reason && g.reason.blocked) || (b.reason && b.reason.blocked) ? Object.assign(new Error('blocked'), { blocked: true }) : (g.reason || b.reason);
    const out = [], seen = new Set();
    // Selang-seling hasil kedua sumber agar beragam; buang judul ganda
    for (let i = 0; i < 12 && out.length < 10; i++) {
      for (const list of lists) {
        const it = list[i]; if (!it || !it.title) continue;
        const key = norm(it.title).slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key); out.push(it);
      }
    }
    // Urutkan menurut relevansi (urutan asli dipertahankan bila sama); yang tidak relevan tidak dicentang otomatis
    return out.map((it, i) => ({ ...it, score: relevance(q, it.title), i }))
      .sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 10);
  }

  // ---------- Baca sumber ----------
  async function readSource(item) {
    const txt = await jina(item.url, 30000);
    const a = BK.parseJina(txt, item.url);
    // Buang gambar milik Google News (placeholder/logo), simpan foto dari artikel asli
    const imgs = (a.images || []).filter((u) => !/news\.google\.com|gstatic\.com|googleusercontent/.test(u));
    const body = (a.body || '').slice(0, 3000);
    if (body.length < 300) throw new Error('isi terlalu pendek');
    return { ...item, date: a.date || '', body, images: imgs, image: imgs[0] || '' };
  }
  async function pool(items, size, fn) {
    const out = new Array(items.length); let i = 0;
    const worker = async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: e }; } } };
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
    return out;
  }

  // ---------- Gabungkan jadi satu "artikel" untuk fitur lain (gambar, caption, video, WordPress) ----------
  function buildArticle(q, read) {
    const names = [...new Set(read.map((s) => s.site).filter(Boolean))];
    const images = [...new Set(read.flatMap((s) => s.images))].slice(0, 16);
    return {
      mode: 'research', query: q,
      url: read[0].url,
      title: q.charAt(0).toUpperCase() + q.slice(1),
      site: names.slice(0, 3).join(', ') + (names.length > 3 ? ' dkk.' : ''),
      date: new Date().toISOString(),
      image: images[0] || '', images,
      description: read[0].body.split(/\n{2,}/)[0] || '',
      body: read.map((s, i) => `[Sumber ${i + 1}: ${s.site || 'media'} — ${s.title}${s.date ? ' (' + s.date + ')' : ''}]\n${s.body}`).join('\n\n'),
      author: '', section: '',
      sources: read.map((s) => ({ title: s.title, site: s.site, url: s.url, date: s.date }))
    };
  }

  // ---------- UI ----------
  // Centang bawaan: N teratas yang relevan (skor ≥ 1); bila tak ada yang relevan, N teratas apa adanya
  function isOn(r, i) {
    if (r.checked !== undefined) return r.checked;
    const n = parseInt($('kwN').value, 10) || 4;
    const anyRelevant = st.results.some((x) => x.score >= 1);
    const pool = anyRelevant ? st.results.filter((x) => x.score >= 1) : st.results;
    return pool.indexOf(r) > -1 && pool.indexOf(r) < n;
  }
  function renderPanel() {
    const box = $('srcPanel');
    if (!st.results.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div class="src-h"><b>Sumber ditemukan</b> <span class="muted">untuk "${esc(st.query)}" · Google Berita &amp; Bing Berita</span></div>
      <ol class="src-list">${st.results.map((r, i) => {
        const rd = st.read[r.url];
        const state = !rd ? '' : rd.error ? '<span class="err-text">✗ gagal dibaca</span>' : '<span class="ok-text">✓ terbaca</span>';
        const on = isOn(r, i);
        return `<li><label><input type="checkbox" data-src="${i}"${on ? ' checked' : ''}>
          <span><a href="${esc(safeHref(r.url))}" target="_blank" rel="noopener">${esc(r.title)}</a>
          <span class="muted">${esc(r.site)}</span> ${state}</span></label></li>`;
      }).join('')}</ol>
      <div class="row gap"><button type="button" class="secondary small" data-src-act="redo">↻ Rangkum ulang dari sumber terpilih</button></div>`;
  }
  function updateMode() {
    const v = $('url').value.trim();
    const kw = v && !BK.isLink(v);
    $('kwOpts').hidden = !kw;
    $('inMode').textContent = !v ? '' : kw ? '· mode kata kunci 🔍' : '· mode link 🔗';
  }
  function hide() { st.results = []; $('srcPanel').hidden = true; }

  function aiReady() {
    const engine = $('engine').value;
    if (engine === 'template' || !window.BKAI) return false;
    return window.BKAI.PROVIDERS.some((p) => window.BKAI.isReady(p.id));
  }

  async function summarize() {
    const picked = st.results.filter(isOn);
    if (!picked.length) { BK.status('Centang minimal satu sumber.', 'err'); return; }
    BK.status(`<span class="spin"></span>Membaca ${picked.length} sumber berita…`);
    const res = await pool(picked, 3, async (it) => (st.read[it.url] && !st.read[it.url].error ? st.read[it.url] : readSource(it)));
    picked.forEach((it, i) => { st.read[it.url] = res[i]; });
    renderPanel();
    const read = res.filter((x) => x && !x.error);
    if (!read.length) { BK.status('Semua sumber gagal dibaca. Coba kata kunci lain, centang sumber lain, atau tempel link berita langsung.', 'err'); return; }
    if (!aiReady()) {
      // Tanpa AI, rangkuman lintas sumber tidak bisa dibuat: olah sumber teratas seperti mode link
      const top = read[0];
      await BK.useArticle({ url: top.url, title: top.title, site: top.site, date: top.date, image: top.image, images: top.images,
        description: top.body.split(/\n{2,}/)[0] || '', body: top.body, author: '', section: '' });
      BK.status('Tanpa Mesin AI, app memakai sumber teratas saja. Untuk rangkuman lintas sumber (mis. daftar 3 HP terbaik), setel Mesin AI. <button type="button" class="linkish" data-open-ai>Atur Mesin AI</button>', 'err');
      return;
    }
    await BK.useArticle(buildArticle(st.query, read));
  }

  async function run(q) {
    if (st.busy) return;
    st.busy = true;
    const btn = $('btnGo'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Mencari';
    try {
      st.query = q; st.read = {}; st.results = [];
      BK.status(`<span class="spin"></span>Mencari berita terkini tentang "${esc(q)}"…`);
      let results = [];
      try { results = await search(q, $('kwRange').value); }
      catch (e) {
        BK.status(e.blocked
          ? 'Layanan pembaca berita (r.jina.ai) sedang membatasi akses tanpa key. Coba lagi beberapa saat lagi, atau isi <b>Jina API key</b> gratis di Pengaturan agar tidak terkena pembatasan. <button type="button" class="linkish" data-open-jina>Atur sekarang</button>'
          : 'Pencarian gagal (' + esc(e.message) + '). Coba lagi sebentar lagi.', 'err');
        return;
      }
      if (!results.length) { BK.status('Tidak ada berita yang cocok. Coba kata kunci lain atau perluas rentang waktu.', 'err'); hide(); return; }
      st.results = results; renderPanel();
      await summarize();
    } catch (e) {
      BK.status('Terjadi kesalahan: ' + esc(e.message), 'err');
    } finally { st.busy = false; btn.disabled = false; btn.textContent = 'Proses'; }
  }

  document.addEventListener('change', (e) => {
    const i = e.target.dataset && e.target.dataset.src;
    if (i !== undefined && st.results[i]) st.results[i].checked = e.target.checked;
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-src-act="redo"]'); if (!b || st.busy) return;
    st.busy = true; b.disabled = true;
    try { await summarize(); } finally { st.busy = false; b.disabled = false; }
  });
  $('url').addEventListener('input', updateMode);

  // Pengaturan: Jina API key (opsional)
  function renderKeyBox() {
    const box = $('jinaBox'); if (!box) return;
    box.innerHTML = `<h3>Pencarian & pembaca berita (Jina)</h3>
      <p class="hint">Mode kata kunci dan pembaca cadangan memakai layanan r.jina.ai. Tanpa key sudah bisa dipakai, tetapi saat ramai Jina kadang membatasi akses anonim. Isi <b>API key gratis</b> agar lebih stabil.</p>
      <ol class="ai-steps"><li>Klik <b>Buka halaman API key</b>, lalu daftar/masuk (bisa dengan Google).</li><li>Salin API key (diawali <code>jina_</code>) dan tempel di bawah.</li></ol>
      <div class="row gap"><a class="ghost small btn-like" href="https://jina.ai/reader/#apiform" target="_blank" rel="noopener">Buka halaman API key ↗</a></div>
      <label class="lbl" for="jinaKey">Jina API key (opsional)</label>
      <div class="row"><input id="jinaKey" type="password" value="${esc(jinaKey())}" placeholder="jina_…" autocomplete="off"><button type="button" class="secondary small" data-jina="test">Tes</button></div>
      <p class="hint"><span class="ai-msg" id="jinaMsg"></span></p>`;
  }
  document.addEventListener('change', (e) => { if (e.target.id === 'jinaKey') BK.store.set('jinaKey', e.target.value.trim()); });
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-open-jina]')) { $('dlg').showModal(); $('jinaBox').scrollIntoView({ block: 'center' }); return; }
    if (!e.target.closest('[data-jina="test"]')) return;
    BK.store.set('jinaKey', $('jinaKey').value.trim());
    const m = $('jinaMsg'); m.textContent = 'Mengetes…'; m.className = 'ai-msg';
    try { await jina('https://example.com', 20000); m.textContent = '✓ Terhubung'; m.className = 'ai-msg ok'; }
    catch (err) { m.textContent = err.status === 401 || err.status === 403 ? 'API key salah atau ditolak' : 'Gagal terhubung ke Jina'; m.className = 'ai-msg err'; }
  });
  renderKeyBox();

  window.BKResearch = { run, search, readSource, buildArticle, hide };
  updateMode();
})();
