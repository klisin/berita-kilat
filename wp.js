/* Berita Kilat — terhubung ke WordPress dan memposting artikel otomatis.
   Login memakai Application Passwords (bawaan WordPress 5.6+), tanpa server perantara.
   Kolom Yoast SEO ditulis lewat plugin kecil "Berita Kilat Connector" (folder wp-plugin/). */
(() => {
  'use strict';
  const BK = window.BK;
  if (!BK) return;
  const $ = (id) => document.getElementById(id);
  const esc = BK.escapeHtml;
  const APP_ID = '6f1c2a9e-4b7d-4e2a-9c51-3a8d0b7e1f42';
  const st = { cats: {}, catsFor: '', plugin: null, mediaId: 0, mediaPhoto: null, mediaFocus: null, postId: 0, postLink: '', busy: false, aiCats: [], feat: null, skipMedia: false };

  // ---------- Situs & kredensial ----------
  const sites = () => BK.store.get('wpSites', {}) || {};
  function normUrl(u) {
    u = (u || '').trim(); if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/+$/, ''); } catch { return ''; }
  }
  const activeUrl = () => normUrl($('wpSite').value);
  const conn = () => sites()[activeUrl()] || null;
  function saveSite(url, data) { const s = sites(); s[url] = { ...(s[url] || {}), ...data }; BK.store.set('wpSites', s); }
  function setActive(url) { $('wpSite').value = url; BK.store.set('wpSite', url); st.catsFor = ''; st.plugin = null; resetPost(); }
  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

  async function wpFetch(path, opts = {}, url = activeUrl(), c = conn()) {
    if (!url) throw Object.assign(new Error('nosite'), { code: 'nosite' });
    if (!c) throw Object.assign(new Error('noauth'), { code: 'noauth' });
    // Mode "x": hosting membuang header Authorization → kirim lewat X-BK-Auth (dibaca plugin v1.1)
    const cred = 'Basic ' + b64(c.user + ':' + c.pass);
    const headers = { ...(c.mode === 'x' ? { 'X-BK-Auth': cred } : { Authorization: cred }), ...(opts.headers || {}) };
    let r;
    try { r = await fetch(url + '/wp-json' + path, { ...opts, headers }); }
    catch { throw Object.assign(new Error('network'), { code: 'network' }); }
    const txt = await r.text(); let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) { const e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; e.wpcode = j && j.code; throw e; }
    return j;
  }
  function friendly(e) {
    if (!e) return 'Gagal';
    if (e.code === 'nosite') return 'Alamat website belum diisi. Buka Pengaturan → Website WordPress.';
    if (e.code === 'noauth') return 'Belum terhubung ke WordPress. Buka Pengaturan → Website WordPress lalu klik "Hubungkan".';
    if (e.code === 'network') return 'Tidak bisa terhubung ke website. Cek alamat & internet, atau plugin keamanan yang memblokir REST API.';
    if (e.code === 'stripped') return 'Hosting/CDN website Anda menghapus header login (umum di LiteSpeed/Hostinger), sehingga WordPress tidak membaca Application Password. Pasang atau perbarui plugin Berita Kilat Connector ke versi 1.1 (Pengaturan → Website WordPress → Unduh plugin), lalu klik Tes koneksi.';
    if (e.code === 'mediablocked') return 'Unggah gambar diblokir server (biasanya firewall hosting/CDN atau batas ukuran unggahan). Anda bisa mengirim tanpa gambar unggulan lalu memasangnya manual di WordPress.';
    if (e.status === 401) return 'Login ditolak: Application Password salah atau sudah dicabut. Hubungkan ulang di Pengaturan.';
    if (e.status === 403) return 'Akun ini tidak punya izin untuk tindakan ini (perlu peran Penulis/Editor/Administrator).';
    if (e.status === 404) return 'REST API WordPress tidak ditemukan di alamat ini.';
    if (e.status === 413) return 'Gambar terlalu besar untuk server.';
    return e.message || 'Gagal';
  }

  // ---------- Hubungkan (Authorize Application) ----------
  function connect() {
    const url = normUrl($('wpUrl').value);
    if (!url) { setMsg('wpMsg', 'Isi alamat website dulu, mis. kalawaca.com', false); return; }
    BK.store.set('wpPending', url);
    if (location.protocol !== 'https:') {
      // Alur otomatis butuh alamat https (mis. GitHub Pages). Saat dibuka lokal, pakai cara manual.
      $('wpManual').open = true;
      setMsg('wpMsg', 'Saat app dibuka dari file lokal, gunakan cara manual di bawah (buat Application Password di WordPress → Profil).', false);
      return;
    }
    const back = location.origin + location.pathname;
    location.href = `${url}/wp-admin/authorize-application.php?app_name=${encodeURIComponent('Berita Kilat')}&app_id=${APP_ID}` +
      `&success_url=${encodeURIComponent(back)}&reject_url=${encodeURIComponent(back + '?wp_rejected=1')}`;
  }
  let returnNote = '';
  (function handleReturn() {
    const p = new URLSearchParams(location.search);
    if (p.get('user_login') && p.get('password')) {
      const url = normUrl(p.get('site_url') || BK.store.get('wpPending', ''));
      if (url) { saveSite(url, { user: p.get('user_login'), pass: p.get('password'), mode: '', verified: false }); setActive(url); returnNote = 'ok'; }
      history.replaceState(null, '', location.pathname);
    } else if (p.get('wp_rejected') || p.get('success') === 'false') {
      returnNote = 'rejected'; history.replaceState(null, '', location.pathname);
    }
  })();
  function saveManual() {
    const url = normUrl($('wpUrl').value), user = $('wpUser').value.trim(), pass = $('wpPass').value.trim();
    if (!url || !user || !pass) { setMsg('wpMsg', 'Isi alamat website, username, dan Application Password.', false); return; }
    saveSite(url, { user, pass, mode: '', verified: false }); setActive(url); renderBox(); test();
  }
  // Pastikan login benar-benar terbaca WordPress. Bila hosting membuang header Authorization
  // (WordPress menjawab "belum log masuk" walau kredensial dikirim), pindah ke jalur X-BK-Auth.
  async function ensureAuth(force) {
    const url = activeUrl(), c = conn();
    if (!c) throw Object.assign(new Error('noauth'), { code: url ? 'noauth' : 'nosite' });
    if (c.verified && !force) return c.me || null;
    const me = () => wpFetch('/wp/v2/users/me?context=edit&_fields=name,roles,capabilities');
    try {
      const r = await me(); saveSite(url, { verified: true, me: { name: r.name } }); return r;
    } catch (e) {
      if (!(e.status === 401 && e.wpcode === 'rest_not_logged_in' && c.mode !== 'x')) throw e;
      const ping = await fetch(url + '/wp-json/berita-kilat/v1/ping').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!ping) throw Object.assign(new Error('stripped'), { code: 'stripped' });
      saveSite(url, { mode: 'x' });
      const r = await me().catch((e2) => { if (e2.status === 401 && e2.wpcode === 'rest_not_logged_in') throw Object.assign(new Error('stripped'), { code: 'stripped' }); throw e2; });
      saveSite(url, { verified: true, me: { name: r.name } }); return r;
    }
  }
  async function test() {
    const url = activeUrl();
    setMsg('wpMsg', 'Mengetes koneksi…');
    try {
      const me = await ensureAuth(true);
      let name = '';
      try { const root = await (await fetch(url + '/wp-json/?_fields=name')).json(); name = root.name || ''; } catch {}
      saveSite(url, { name: name || new URL(url).hostname, display: me.name });
      const canPublish = !me.capabilities || me.capabilities.publish_posts !== false;
      const via = conn().mode === 'x' ? ' (lewat jalur cadangan plugin, karena hosting menghapus header login)' : '';
      setMsg('wpMsg', `✓ Terhubung ke ${name || url} sebagai ${me.name}${canPublish ? '' : ' (akun ini hanya bisa membuat draf)'}${via}`, true);
      await detectPlugin(true);
      renderBox(); renderCard();
    } catch (e) { setMsg('wpMsg', friendly(e), false); }
  }
  async function detectPlugin(force) {
    if (st.plugin !== null && !force) return st.plugin;
    try {
      const j = await wpFetch('/wp/v2/posts', { method: 'OPTIONS' });
      const props = j && j.schema && j.schema.properties && j.schema.properties.meta && j.schema.properties.meta.properties;
      st.plugin = !!(props && props._yoast_wpseo_metadesc);
    } catch { st.plugin = false; }
    return st.plugin;
  }
  async function categories() {
    const url = activeUrl();
    if (st.catsFor === url && st.cats[url]) return st.cats[url];
    const all = [];
    for (let page = 1; page <= 5; page++) {
      const list = await wpFetch(`/wp/v2/categories?per_page=100&page=${page}&_fields=id,name,parent,count&orderby=count&order=desc`);
      all.push(...list);
      if (list.length < 100) break;
    }
    st.cats[url] = all; st.catsFor = url;
    return all;
  }

  // ---------- HTML aman (dipakai pratinjau & isi yang dikirim) ----------
  const ALLOWED = new Set(['P', 'H2', 'H3', 'BLOCKQUOTE', 'STRONG', 'EM', 'B', 'I', 'A', 'BR', 'UL', 'OL', 'LI']);
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 1) {
          if (!ALLOWED.has(n.tagName)) { walk(n); n.replaceWith(...n.childNodes); return; }
          [...n.attributes].forEach((a) => {
            const keep = n.tagName === 'A' && (a.name === 'href' ? /^https?:\/\//i.test(a.value) : a.name === 'target' || a.name === 'rel');
            if (!keep) n.removeAttribute(a.name);
          });
          walk(n);
        } else if (n.nodeType !== 3) n.remove();
      });
    };
    const root = doc.body.firstChild; walk(root);
    return root.innerHTML.trim();
  }
  const strip = (h) => new DOMParser().parseFromString(h || '', 'text/html').body.textContent || '';
  const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 10).join('-');

  // ---------- Penulisan artikel ----------
  const LEN = { pendek: '300–400 kata', sedang: '500–700 kata', panjang: '800–1.000 kata' };
  function buildArticlePrompt(a, catNames, len) {
    const s = BK.S(), dl = (s.dateline || s.name).toUpperCase();
    const siteName = (conn() && conn().name) || s.name;
    const body = (a.body || a.description || '').slice(0, 12000);
    return `Anda adalah redaktur senior media daring Indonesia yang menulis dengan gaya Harian Kompas: lugas, akurat, berimbang, kalimat efektif, Bahasa Indonesia baku sesuai KBBI/PUEBI, tanpa sensasi dan tanpa emoji.

TUGAS: tulis ulang ARTIKEL SUMBER menjadi artikel berita orisinal untuk dipublikasikan di situs ${siteName}.

ATURAN PENULISAN
1. Struktur piramida terbalik. Paragraf pertama (lead, maks. 40 kata) menjawab apa, siapa, kapan, dan di mana, diawali dateline "NAMA KOTA, ${dl} —" (kota tempat peristiwa; jika tidak jelas pakai JAKARTA).
2. Paragraf berikutnya menjelaskan mengapa dan bagaimana, lalu konteks/latar dan dampak. Setiap paragraf 2–4 kalimat.
3. Setiap klaim dan kutipan diberi atribusi jelas ("kata …", "ujar …", "menurut …"). Kutipan langsung hanya boleh dipakai bila ada di artikel sumber dan ditulis persis.
4. WAJIB ditulis ulang dengan kalimat sendiri: jangan menyalin kalimat dari sumber kecuali kutipan langsung narasumber. Jangan menambah fakta, angka, nama, jabatan, atau tanggal yang tidak ada di sumber.
5. Hari/tanggal gaya Kompas, mis. "Senin (5/10/2026)". Tanggal terbit sumber: ${a.date || 'tidak diketahui'}.
6. Panjang ${LEN[len] || LEN.sedang}. Bila lebih dari 500 kata, gunakan 1–3 subjudul <h2> singkat.
7. "isi_html" hanya memakai tag <p>, <h2>, <blockquote>, <strong>, <em>. Jangan sertakan judul, daftar referensi, atau "Baca juga" (ditambahkan sistem).
8. "judul": judul berita informatif ≤ 70 karakter, memuat focus keyphrase, bukan clickbait, tanpa titik di akhir.
9. "kategori": pilih 1–2 nama PERSIS dari DAFTAR KATEGORI berikut (yang pertama = kategori utama): ${catNames.join(', ') || '(tidak ada daftar; kosongkan)'}.
10. "tag": 4–8 tag berupa nama tempat, tokoh, lembaga, atau topik.
11. "yoast": "focus_keyphrase" 2–4 kata yang paling mungkin dicari pembaca; "seo_title" ≤ 60 karakter memuat keyphrase; "meta_description" 120–155 karakter memuat keyphrase dan mengajak membaca secara halus.
12. "slug": huruf kecil, kata dipisah tanda hubung, maks. 8 kata, memuat keyphrase.
13. "ringkasan": 1–2 kalimat (≤ 160 karakter) untuk kutipan/excerpt.
14. "alt_gambar": deskripsi singkat foto utama yang relevan (≤ 120 karakter).

Balas HANYA dengan JSON valid tanpa teks lain:
{"judul":"","slug":"","isi_html":"","ringkasan":"","kategori":[""],"tag":[""],"yoast":{"focus_keyphrase":"","seo_title":"","meta_description":""},"alt_gambar":""}

ARTIKEL SUMBER
Judul: ${a.title}
Media: ${a.site}
URL: ${a.url || '-'}
Penulis: ${a.author || '-'}
Isi:
${body}`;
  }
  function templateArticle(a) {
    const s = BK.S(), dl = (s.dateline || s.name).toUpperCase();
    const paras = (a.body || a.description || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const html = paras.map((p, i) => `<p>${i === 0 ? `JAKARTA, ${esc(dl)} — ` : ''}${esc(p)}</p>`).join('\n');
    const kw = (a.title || '').split(/\s+/).slice(0, 4).join(' ');
    return { judul: a.title, slug: slugify(a.title), isi_html: html, ringkasan: (a.description || paras[0] || '').slice(0, 160),
      kategori: a.section ? [a.section] : [], tag: [], yoast: { focus_keyphrase: kw, seo_title: (a.title || '').slice(0, 60), meta_description: (a.description || paras[0] || '').slice(0, 155) }, alt_gambar: a.title };
  }
  // Tambah "Baca juga" (pos terkait di situs sendiri) dan paragraf referensi sumber
  async function decorate(html, out, a) {
    let related = [];
    const q = (out.yoast && out.yoast.focus_keyphrase) || (out.tag || [])[0] || '';
    if (q && conn()) {
      try { related = await wpFetch(`/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=3&_fields=id,title,link`); } catch {}
    }
    let body = html;
    if (related.length) {
      const baca = `<p><strong>Baca juga:</strong> ${related.map((r) => `<a href="${esc(r.link)}">${esc(strip(r.title && r.title.rendered))}</a>`).join(' | ')}</p>`;
      const parts = body.split('</p>');
      if (parts.length > 4) { parts.splice(3, 0, ''); body = parts.slice(0, 3).join('</p>') + '</p>\n' + baca + parts.slice(3).join('</p>'); }
      else body += '\n' + baca;
    }
    if (a.url) {
      const tgl = a.date ? ', ' + BK.fmtDate(a.date) : '';
      body += `\n<p><em>Artikel ini disusun berdasarkan pemberitaan <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a> (${esc(a.site || 'media asal')}${esc(tgl)}).</em></p>`;
    }
    return body;
  }

  async function writeArticle() {
    const a = BK.state.article;
    if (!a || (!a.title && !a.body)) { setMsg('wpCardMsg', 'Proses link berita dulu (atau isi Bahan artikel).', false); return; }
    const btn = $('wpWrite'); btn.disabled = true; const old = btn.innerHTML;
    btn.innerHTML = '<span class="spin"></span>Menulis artikel…';
    try {
      let catNames = [];
      if (conn()) { try { catNames = (await categories()).filter((c) => c.name !== 'Uncategorized').map((c) => c.name); } catch {} }
      const engine = $('engine').value;
      let out, used = '';
      if (engine === 'template' || !window.BKAI) out = templateArticle(a);
      else {
        try {
          const r = await window.BKAI.generate(buildArticlePrompt(a, catNames, $('wpLen').value), engine, {
            validate: (t) => { const j = BK.parseJson(t); if (!j.isi_html) throw new Error('kosong'); return j; },
            onStatus: (m) => setMsg('wpCardMsg', m)
          });
          out = r.data; used = r.providerName;
        } catch (e) { out = templateArticle(a); setMsg('wpCardMsg', 'AI gagal (' + (e.notes || [e.message]).join('; ') + '), dipakai isi artikel apa adanya. Atur Mesin AI untuk hasil terbaik.', false); }
      }
      const html = await decorate(sanitize(out.isi_html), out, a);
      $('wpTitle').value = (out.judul || a.title || '').replace(/\.$/, '');
      $('wpSlug').value = slugify(out.slug || out.judul || a.title);
      $('wpContent').value = html;
      $('wpExcerpt').value = out.ringkasan || '';
      $('wpTags').value = (out.tag || []).join(', ');
      $('wpKw').value = (out.yoast && out.yoast.focus_keyphrase) || '';
      $('wpSeoTitle').value = (out.yoast && out.yoast.seo_title) || '';
      $('wpMeta').value = (out.yoast && out.yoast.meta_description) || '';
      $('wpAlt').value = out.alt_gambar || $('wpTitle').value;
      if (!st.feat) $('wpCaption').value = $('credit').value;
      st.aiCats = out.kategori || [];
      resetPost(true);
      await renderCats();
      counters(); preview();
      if (used) setMsg('wpCardMsg', `Artikel ditulis dengan ${used}. Periksa fakta, lalu kirim ke WordPress.`, true);
    } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  // ---------- Kirim ----------
  // Sumber gambar unggulan: foto kartu Gambar (bawaan), foto pilihan galeri, atau unggahan sendiri
  const featPhoto = () => (st.feat && st.feat.el) || BK.state.photo;
  const featFocus = () => (st.feat ? 0.45 : parseFloat($('focusY').value) || 0.35);
  function featuredBlob(w = 1200, q = 0.88) {
    return new Promise((res, rej) => {
      const photo = featPhoto();
      if (!photo) { rej(new Error('Belum ada foto. Pilih foto lain atau unggah foto untuk gambar unggulan.')); return; }
      const h = Math.round(w * 9 / 16);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      BK.withCtx(g, () => BK.drawCover(photo, 0, 0, w, h, featFocus()));
      try { c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar'))), 'image/jpeg', q); }
      catch { rej(new Error('Foto berasal dari server lain sehingga tidak bisa diunggah. Pilih foto lain atau unggah manual.')); }
    });
  }
  // Unggah sebagai multipart/form-data (lebih bersahabat dengan firewall hosting daripada biner mentah).
  // Bila diblokir, coba sekali lagi dengan ukuran lebih kecil.
  async function uploadFeatured(slug, title) {
    const fields = { alt_text: $('wpAlt').value.trim(), caption: $('wpCaption').value.trim(), title };
    let lastErr = null;
    for (const [w, q] of [[1200, 0.88], [960, 0.78]]) {
      const fd = new FormData();
      fd.append('file', await featuredBlob(w, q), slug + '.jpg');
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      try { return await wpFetch('/wp/v2/media', { method: 'POST', body: fd }); }
      catch (e) {
        lastErr = e;
        if (!(e.code === 'network' || e.status === 413 || (e.status === 403 && !/rest_/.test(e.wpcode || '')))) throw e;
      }
    }
    throw Object.assign(new Error('mediablocked'), { code: 'mediablocked', cause: lastErr });
  }
  async function tagIds(names) {
    const ids = [];
    for (const name of names) {
      const found = await wpFetch(`/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=20&_fields=id,name`);
      const hit = found.find((t) => strip(t.name).toLowerCase() === name.toLowerCase());
      if (hit) { ids.push(hit.id); continue; }
      try { const t = await wpFetch('/wp/v2/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); ids.push(t.id); }
      catch (e) { if (e.wpcode === 'term_exists' && e.status === 400) { /* dibuat bersamaan; lewati */ } else throw e; }
    }
    return ids;
  }
  function step(i, state, text) {
    const li = document.querySelectorAll('#wpSteps li')[i];
    if (li) { li.className = state; if (text) li.dataset.note = text; li.querySelector('span').textContent = text || ''; }
  }
  async function send() {
    if (st.busy) return;
    const title = $('wpTitle').value.trim(), content = sanitize($('wpContent').value);
    if (!conn()) { setMsg('wpCardMsg', friendly({ code: activeUrl() ? 'noauth' : 'nosite' }), false); return; }
    if (!title || !strip(content).trim()) { setMsg('wpCardMsg', 'Judul dan isi artikel belum ada. Klik "Tulis artikel dengan AI" dulu.', false); return; }
    const status = document.querySelector('input[name="wpStatus"]:checked').value;
    let date = null;
    if (status === 'future') {
      const v = $('wpDate').value;
      if (!v || new Date(v) <= new Date()) { setMsg('wpCardMsg', 'Isi tanggal & jam terbit di masa depan.', false); return; }
      date = v.length === 16 ? v + ':00' : v;
    }
    st.busy = true; const btn = $('wpSend'); btn.disabled = true;
    $('wpSteps').hidden = false; [0, 1, 2].forEach((i) => step(i, '', ''));
    $('wpDone').innerHTML = '';
    const skipMedia = st.skipMedia; st.skipMedia = false;
    try {
      await ensureAuth();
      const plugin = await detectPlugin();
      // 1. Gambar unggulan (dipakai ulang bila foto tidak berubah)
      if (skipMedia) step(0, 'ok', 'dilewati — pasang manual di WordPress');
      else {
        step(0, 'run', 'Mengunggah…');
        const focus = featFocus();
        if (!st.mediaId || st.mediaPhoto !== featPhoto() || st.mediaFocus !== focus) {
          const m = await uploadFeatured(slugify($('wpSlug').value || title) || 'berita', title);
          st.mediaId = m.id; st.mediaPhoto = featPhoto(); st.mediaFocus = focus;
        } else {
          await wpFetch(`/wp/v2/media/${st.mediaId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alt_text: $('wpAlt').value.trim(), caption: $('wpCaption').value.trim(), title }) });
        }
        step(0, 'ok', `ID ${st.mediaId}`);
      }
      // 2. Tag
      step(1, 'run', 'Mencari/membuat tag…');
      const names = [...new Set($('wpTags').value.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 12);
      const tags = await tagIds(names);
      step(1, 'ok', `${tags.length} tag`);
      // 3. Pos
      step(2, 'run', st.postId ? 'Memperbarui pos…' : 'Membuat pos…');
      const cats = [...document.querySelectorAll('#wpCats input:checked')].map((x) => parseInt(x.value, 10));
      const primary = parseInt($('wpPrimary').value, 10) || cats[0] || 0;
      const body = { title, content, excerpt: $('wpExcerpt').value.trim(), slug: slugify($('wpSlug').value || title), status, categories: cats, tags, featured_media: st.mediaId };
      if (date) body.date = date;
      const meta = {};
      if (plugin) {
        meta._yoast_wpseo_focuskw = $('wpKw').value.trim();
        meta._yoast_wpseo_title = $('wpSeoTitle').value.trim();
        meta._yoast_wpseo_metadesc = $('wpMeta').value.trim();
        if (primary) meta._yoast_wpseo_primary_category = primary;
      }
      if ($('wpNoEmail').checked) meta._jetpack_dont_email_post_to_subs = true;
      if (Object.keys(meta).length) body.meta = meta;
      const post = await wpFetch(st.postId ? `/wp/v2/posts/${st.postId}` : '/wp/v2/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      st.postId = post.id; st.postLink = post.link; st.postStatus = post.status;
      step(2, 'ok', `#${post.id} (${{ draft: 'draf', publish: 'terbit', future: 'terjadwal', pending: 'menunggu tinjauan' }[post.status] || post.status})`);
      const edit = `${activeUrl()}/wp-admin/post.php?post=${post.id}&action=edit`;
      $('wpDone').innerHTML = `✓ Berhasil. <a href="${esc(edit)}" target="_blank" rel="noopener">Edit di WordPress ↗</a> · <a href="${esc(post.link)}" target="_blank" rel="noopener">${post.status === 'publish' ? 'Lihat pos' : 'Pratinjau'} ↗</a>` +
        ` <button type="button" class="secondary small" data-share="article">📤 Bagikan tautan artikel</button>` +
        (plugin ? '' : '<br><span class="err-text">Plugin Berita Kilat Connector belum aktif, jadi kolom Yoast belum terisi. Salin data Yoast di atas ke editor, atau pasang plugin (Pengaturan → Website WordPress).</span>');
      btn.textContent = 'Perbarui pos di WordPress';
      setMsg('wpCardMsg', '', true);
    } catch (e) {
      const i = [...document.querySelectorAll('#wpSteps li')].findIndex((li) => li.className === 'run');
      if (i >= 0) step(i, 'err', friendly(e));
      setMsg('wpCardMsg', 'Gagal: ' + friendly(e), false);
      if (e.code === 'mediablocked') {
        $('wpDone').innerHTML = '<button type="button" class="secondary small" data-wp="sendnoimg">Kirim tanpa gambar unggulan</button> <span class="muted">atau pilih/unggah foto lain yang lebih kecil.</span>';
      }
    } finally { st.busy = false; btn.disabled = false; }
  }
  function resetPost(keepMedia) {
    st.postId = 0; st.postLink = '';
    if (!keepMedia) { st.mediaId = 0; st.mediaPhoto = null; }
    if ($('wpSend')) $('wpSend').textContent = 'Kirim ke WordPress';
    if ($('wpDone')) $('wpDone').innerHTML = '';
    if ($('wpSteps')) $('wpSteps').hidden = true;
  }

  // ---------- UI ----------
  function setMsg(id, text, ok) { const el = $(id); if (!el) return; el.textContent = text || ''; el.className = 'hint ' + (ok === true ? 'ok-text' : ok === false ? 'err-text' : ''); }
  function renderBox() {
    const box = $('wpBox'); if (!box) return;
    const url = activeUrl(), c = conn(), all = sites();
    const others = Object.keys(all);
    box.innerHTML = `<h3>Website WordPress</h3>
      <p class="hint">Hubungkan website berita Anda (mis. kalawaca.com) agar artikel bisa diposting langsung dari app: lengkap dengan kategori, tag, gambar unggulan, dan Yoast SEO. Setiap preset akun media bisa terhubung ke website berbeda.</p>
      ${others.length > 1 ? `<label class="lbl" for="wpSiteSel">Website aktif</label><select id="wpSiteSel">${others.map((u) => `<option value="${esc(u)}"${u === url ? ' selected' : ''}>${esc((all[u].name || u) + ' — ' + u)}</option>`).join('')}</select>` : ''}
      <label class="lbl" for="wpUrl">Alamat website</label>
      <div class="row"><input id="wpUrl" type="url" value="${esc(url)}" placeholder="kalawaca.com" autocomplete="off"><button type="button" class="primary" data-wp="connect">Hubungkan</button></div>
      <p class="hint" id="wpMsg">${c ? `✓ Tersimpan: ${esc(c.display || c.user)} @ ${esc(c.name || url)}` : 'Belum terhubung. Klik "Hubungkan", login ke WordPress, lalu klik "Yes, I approve of this connection".'}</p>
      ${c ? '<div class="row gap"><button type="button" class="secondary small" data-wp="test">Tes koneksi</button><button type="button" class="ghost small" data-wp="disconnect">Putuskan</button></div>' : ''}
      <details id="wpManual" class="ai-adv"><summary>Cara manual (Application Password)</summary>
        <ol class="ai-steps"><li>Di WordPress buka <b>Pengguna → Profil</b>, gulir ke <b>Application Passwords</b>.</li><li>Isi nama "Berita Kilat", klik <b>Add New Application Password</b>, salin kode yang muncul.</li><li>Isi username WordPress dan tempel kode di bawah, lalu <b>Simpan</b>.</li></ol>
        <div class="two"><div><label class="lbl" for="wpUser">Username WordPress</label><input id="wpUser" type="text" autocomplete="off"></div>
        <div><label class="lbl" for="wpPass">Application Password</label><input id="wpPass" type="password" autocomplete="off" placeholder="xxxx xxxx xxxx xxxx"></div></div>
        <div class="row gap"><button type="button" class="secondary small" data-wp="manual">Simpan & tes</button></div>
      </details>
      <div class="wp-plugin">
        <b>Plugin Yoast (wajib untuk mengisi Yoast SEO):</b> <span id="wpPluginState">${st.plugin === true ? '<span class="ok-text">✓ aktif</span>' : st.plugin === false ? '<span class="err-text">✗ belum aktif</span>' : '<span class="muted">belum dicek</span>'}</span>
        <ol class="ai-steps"><li><a href="wp-plugin/berita-kilat-connector.zip" download>Unduh plugin (.zip)</a></li><li>WordPress → <b>Plugin → Tambah Baru → Unggah Plugin</b> → pilih file zip → <b>Pasang</b> → <b>Aktifkan</b>.</li><li>Kembali ke sini, klik <b>Tes koneksi</b>.</li></ol>
      </div>`;
  }
  async function renderCats() {
    const box = $('wpCats'), sel = $('wpPrimary');
    if (!conn()) { box.innerHTML = '<span class="muted">Hubungkan website untuk memuat kategori.</span>'; sel.innerHTML = ''; return; }
    // Pertahankan centang yang sudah dipilih pengguna saat daftar dimuat ulang
    const checked = new Set([...box.querySelectorAll('input:checked')].map((x) => parseInt(x.value, 10)));
    box.innerHTML = '<span class="muted"><span class="spin"></span>Memuat kategori…</span>';
    try {
      const cats = await categories();
      const want = st.aiCats.map((x) => String(x).toLowerCase().trim());
      box.innerHTML = cats.map((c) => {
        const on = want.includes(strip(c.name).toLowerCase()) || checked.has(c.id);
        return `<label class="wp-cat"><input type="checkbox" value="${c.id}"${on ? ' checked' : ''}> ${esc(strip(c.name))}</label>`;
      }).join('');
      syncPrimary(want);
    } catch (e) { box.innerHTML = `<span class="err-text">${esc(friendly(e))}</span>`; }
  }
  function syncPrimary(order) {
    const sel = $('wpPrimary'), cur = sel.value;
    const on = [...document.querySelectorAll('#wpCats input:checked')].map((x) => ({ id: x.value, name: x.parentNode.textContent.trim() }));
    if (order && order.length) on.sort((a, b) => (order.indexOf(a.name.toLowerCase()) + 99) % 99 - (order.indexOf(b.name.toLowerCase()) + 99) % 99);
    sel.innerHTML = on.length ? on.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">—</option>';
    if (on.some((c) => c.id === cur)) sel.value = cur;
  }
  function counters() {
    const set = (id, n, ok) => { const el = $(id); el.textContent = n + ' karakter'; el.className = 'wp-count ' + (ok ? 'ok-text' : 'warn-text'); };
    const t = $('wpSeoTitle').value.length, m = $('wpMeta').value.length, h = $('wpTitle').value.length;
    set('wpTitleN', h, h > 0 && h <= 70); set('wpSeoTitleN', t, t > 0 && t <= 60); set('wpMetaN', m, m >= 120 && m <= 155);
  }
  function preview() {
    $('wpPreview').innerHTML = `<h1>${esc($('wpTitle').value)}</h1>` + sanitize($('wpContent').value);
    const w = strip(sanitize($('wpContent').value)).trim().split(/\s+/).filter(Boolean).length;
    $('wpWords').textContent = w ? w + ' kata' : '';
  }
  function featuredPreview() {
    const c = $('wpFeat'); if (!c) return;
    const g = c.getContext('2d'); g.fillStyle = '#1e293b'; g.fillRect(0, 0, c.width, c.height);
    const photo = featPhoto();
    if (photo) BK.withCtx(g, () => BK.drawCover(photo, 0, 0, c.width, c.height, featFocus()));
    else { g.fillStyle = '#94a3b8'; g.font = '600 18px Inter'; g.textAlign = 'center'; g.fillText('Belum ada foto', c.width / 2, c.height / 2); }
  }
  // Pilihan sumber gambar unggulan (seperti kartu Gambar dan footage video)
  function featSource(mode) {
    document.querySelectorAll('#wpFeatSeg button').forEach((b) => b.classList.toggle('on', b.dataset.fs === mode));
    const picker = $('wpFeatPicker');
    if (mode === 'card') {
      st.feat = null; picker.hidden = true;
      $('wpCaption').value = $('credit').value;
      featuredPreview();
    } else if (mode === 'pick') {
      picker.hidden = false;
      if (!window.BKFootage) return;
      const a = BK.state.article || {};
      const q = $('wpKw').value.trim() || (BK.state.video && BK.state.video.footage && BK.state.video.footage[0] && BK.state.video.footage[0].id) || (a.title || '').split(/\s+/).slice(0, 4).join(' ');
      window.BKFootage.openPicker(picker, {
        query: q,
        onPick: (item, el) => {
          st.feat = { el, credit: item.credit, source: item.source };
          const base = a.site ? `Sumber: ${a.site}` : '';
          $('wpCaption').value = item.source === 'Artikel' ? (base || item.credit) : [base, 'Foto: ' + item.credit].filter(Boolean).join(' • ');
          featuredPreview();
        }
      });
    } else if (mode === 'upload') {
      picker.hidden = true;
      $('wpFeatFile').click();
    }
  }
  function renderCard() {
    const s = conn();
    $('wpTarget').innerHTML = s
      ? `Website: <b>${esc(s.name || activeUrl())}</b> · sebagai ${esc(s.display || s.user)}`
      : `<span class="err-text">Belum terhubung ke WordPress.</span> <button type="button" class="linkish" data-wp="open">Atur di Pengaturan</button>`;
    featuredPreview();
    if (s && !$('wpCats').children.length) renderCats();
  }

  document.addEventListener('click', (e) => {
    const fs = e.target.closest('#wpFeatSeg [data-fs]');
    if (fs) { featSource(fs.dataset.fs); return; }
    const b = e.target.closest('[data-wp]'); if (!b) return;
    const act = b.dataset.wp;
    if (act === 'connect') connect();
    else if (act === 'manual') saveManual();
    else if (act === 'test') test();
    else if (act === 'disconnect') { const s = sites(); delete s[activeUrl()]; BK.store.set('wpSites', s); st.plugin = null; renderBox(); renderCard(); $('wpCats').innerHTML = ''; }
    else if (act === 'open') { $('dlg').showModal(); $('wpBox').scrollIntoView({ block: 'start' }); }
    else if (act === 'write') writeArticle();
    else if (act === 'send') send();
    else if (act === 'preview') { const p = $('wpPreview'); p.hidden = !p.hidden; b.textContent = p.hidden ? 'Pratinjau' : 'Tutup pratinjau'; preview(); }
    else if (act === 'sendnoimg') { st.skipMedia = true; send(); }
    else if (act === 'copyseo') {
      const txt = `Focus keyphrase: ${$('wpKw').value}\nJudul SEO: ${$('wpSeoTitle').value}\nMeta description: ${$('wpMeta').value}`;
      navigator.clipboard.writeText(txt).then(() => setMsg('wpCardMsg', 'Data Yoast tersalin.', true), () => {});
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'wpSiteSel') { setActive(t.value); renderBox(); renderCard(); renderCats(); }
    if (t.closest && t.closest('#wpCats')) syncPrimary();
    if (t.name === 'wpStatus') { $('wpDateBox').hidden = t.value !== 'future'; $('wpNoEmailBox').hidden = t.value === 'draft'; }
    if (t.id === 'wpFeatFile' && t.files[0]) {
      BK.loadImage(URL.createObjectURL(t.files[0])).then((el) => {
        st.feat = { el, credit: '', source: 'Unggahan' };
        document.querySelectorAll('#wpFeatSeg button').forEach((b) => b.classList.toggle('on', b.dataset.fs === 'upload'));
        featuredPreview();
      });
      t.value = '';
    }
  });
  document.addEventListener('input', (e) => {
    const id = e.target.id;
    if (['wpTitle', 'wpSeoTitle', 'wpMeta'].includes(id)) counters();
    if (id === 'wpContent' || id === 'wpTitle') preview();
    if (id === 'focusY' && !st.feat) featuredPreview();
  });

  // Dipanggil app.js saat preset akun media berganti, dan dari draw() untuk pratinjau gambar
  function refresh() { st.catsFor = ''; st.plugin = null; resetPost(); renderBox(); renderCard(); $('wpCats').innerHTML = ''; if (conn()) renderCats(); }
  const lastPost = () => (st.postId ? { id: st.postId, link: st.postLink, status: st.postStatus } : null);
  window.BKWP = { refresh, featuredPreview, sanitize, buildArticlePrompt, send, writeArticle, lastPost };

  if (!$('wpSite').value) $('wpSite').value = BK.store.get('wpSite', '');
  renderBox(); renderCard(); counters();
  if (returnNote === 'ok') setTimeout(() => { $('dlg').showModal(); $('wpBox').scrollIntoView({ block: 'start' }); test(); }, 400);
  else if (returnNote === 'rejected') setTimeout(() => BK.status('Koneksi ke WordPress dibatalkan.', 'err'), 400);
})();
