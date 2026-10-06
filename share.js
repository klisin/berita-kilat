/* Berita Kilat — menu "Bagikan" ke media sosial.
   Tanpa API/izin: memakai daftar aplikasi bawaan perangkat (Web Share API), tautan "intent"
   tiap platform untuk teks + link, dan jalan pintas unggah (salin caption + unduh file + buka halaman unggah). */
(() => {
  'use strict';
  const BK = window.BK;
  if (!BK) return;
  const $ = (id) => document.getElementById(id);
  const esc = BK.escapeHtml;
  const enc = encodeURIComponent;
  const st = { kind: 'image', file: null, fileUrl: '', link: '', note: '' };
  const KIND_LABEL = { image: 'gambar', video: 'video', text: 'caption', article: 'artikel' };

  // Platform yang menerima file: tidak punya "intent" web, jadi salin caption + unduh file + buka halaman unggah
  const UPLOAD = [
    { id: 'instagram', name: 'Instagram', icon: '📸', url: 'https://www.instagram.com/', kinds: ['image', 'video'], how: 'Klik ＋ Buat → pilih file yang baru terunduh → tempel caption.' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', url: 'https://www.tiktok.com/tiktokstudio/upload', kinds: ['video'], how: 'Pilih file video yang baru terunduh → tempel caption.' },
    { id: 'youtube', name: 'YouTube Shorts', icon: '▶️', url: 'https://www.youtube.com/upload', kinds: ['video'], how: 'Pilih file video (≤ 60 detik, vertikal otomatis jadi Shorts) → tempel caption di deskripsi.' },
    { id: 'facebook-file', name: 'Facebook', icon: '📘', url: 'https://www.facebook.com/', kinds: ['image', 'video'], how: 'Buat postingan → Foto/video → pilih file → tempel caption.' }
  ];
  // Platform berbasis tautan: kirim teks + link (tanpa file)
  const LINKS = [
    { id: 'whatsapp', name: 'WhatsApp', icon: '💬', make: (t, l) => `https://wa.me/?text=${enc(join(t, l))}` },
    { id: 'telegram', name: 'Telegram', icon: '✈️', make: (t, l) => (l ? `https://t.me/share/url?url=${enc(l)}&text=${enc(t)}` : `https://t.me/share/url?url=${enc(t)}`) },
    { id: 'x', name: 'X (Twitter)', icon: '𝕏', make: (t, l) => `https://x.com/intent/post?text=${enc(fit(t, 280 - (l ? 24 : 0)))}${l ? '&url=' + enc(l) : ''}` },
    { id: 'threads', name: 'Threads', icon: '🧵', make: (t, l) => `https://www.threads.net/intent/post?text=${enc(fit(join(t, l), 500))}` },
    { id: 'facebook', name: 'Facebook', icon: '📘', needLink: true, make: (t, l) => `https://www.facebook.com/sharer/sharer.php?u=${enc(l)}` },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', needLink: true, make: (t, l) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(l)}` },
    { id: 'email', name: 'Email', icon: '✉️', make: (t, l) => `mailto:?subject=${enc(title())}&body=${enc(join(t, l))}` }
  ];

  const join = (t, l) => [t, l].filter(Boolean).join('\n\n');
  // Pangkas di batas kata, sisakan ruang untuk elipsis
  function fit(s, max) {
    if (s.length <= max) return s;
    const cut = s.slice(0, max - 1); const i = cut.lastIndexOf(' ');
    return (i > max * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,.;:—-]+$/, '') + '…';
  }
  const slug = () => ($('headline').value || 'posting').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/^-|-$/g, '') || 'posting';
  const title = () => $('headline').value.trim() || (BK.state.article && BK.state.article.title) || 'Berita';
  // Link bawaan: pos WordPress (artikel, atau yang sudah terbit) → URL berita sumber
  function defaultLink(kind) {
    const p = window.BKWP && window.BKWP.lastPost && window.BKWP.lastPost();
    if (p && (kind === 'article' || p.status === 'publish')) return p.link;
    return (BK.state.article && BK.state.article.url) || '';
  }
  const withCap = () => !$('shCap') || $('shCap').checked;
  const withLink = () => !$('shLinkOn') || $('shLinkOn').checked;
  const link = () => (withLink() ? ($('shLink') ? $('shLink').value.trim() : st.link) : '');
  function text() {
    const cap = $('caption').value.trim();
    if (st.kind === 'article') return title();
    return withCap() && cap ? cap : title();
  }

  // ---------- Menyiapkan file ----------
  function imageFile() {
    return new Promise((res) => {
      try { $('cv').toBlob((b) => res(b ? new File([b], slug() + '.png', { type: 'image/png' }) : null), 'image/png'); }
      catch { res(null); }
    });
  }
  function videoFile() {
    const out = window.BKVideo && window.BKVideo.lastOutput && window.BKVideo.lastOutput();
    if (!out) return null;
    return new File([out.blob], slug() + '.' + out.ext, { type: out.blob.type.split(';')[0] || 'video/mp4' });
  }
  const canShareFile = (f) => { try { return !!(f && navigator.canShare && navigator.canShare({ files: [f] })); } catch { return false; } };

  // ---------- Dialog ----------
  async function open(kind) {
    st.kind = kind; st.note = '';
    if (st.fileUrl) { URL.revokeObjectURL(st.fileUrl); st.fileUrl = ''; }
    st.file = kind === 'image' ? await imageFile() : kind === 'video' ? videoFile() : null;
    if (st.file) st.fileUrl = URL.createObjectURL(st.file);
    st.link = defaultLink(kind);
    render();
    const dlg = $('shareDlg'); if (!dlg.open) dlg.showModal();
  }
  function render() {
    const kind = st.kind, f = st.file;
    const needRender = kind === 'video' && !f;
    const shareable = f ? canShareFile(f) : !!navigator.share;
    const p = window.BKWP && window.BKWP.lastPost && window.BKWP.lastPost();
    const draftNote = kind === 'article' && p && p.status !== 'publish'
      ? '<p class="hint warn-text">Pos masih berstatus draf/terjadwal: tautannya belum bisa dibuka publik. Bagikan setelah terbit.</p>' : '';
    const cap = $('caption').value.trim();
    const thumb = !f ? '' : f.type.startsWith('video')
      ? `<video src="${st.fileUrl}" muted playsinline></video>` : `<img src="${st.fileUrl}" alt="">`;
    const uploads = UPLOAD.filter((u) => u.kinds.includes(kind));
    $('shareBox').innerHTML = `
      <div class="card-h"><h2>Bagikan ${KIND_LABEL[kind]}</h2><button type="button" class="ghost small" data-sh="close">✕</button></div>
      ${needRender ? `<div class="sh-render"><p>Video belum dirender (atau naskah/durasi/musik berubah sejak render terakhir).</p>
          <button type="button" class="primary" data-sh="render">🎬 Render video dulu</button><span class="hint" id="shRenderMsg"></span></div>` : ''}
      <div class="sh-prev">${thumb ? `<div class="sh-th">${thumb}</div>` : ''}
        <div class="sh-cap">${cap ? esc(fit(cap, 260)).replace(/\n/g, '<br>') : '<span class="muted">Caption belum ada. Buat caption di kartu Caption.</span>'}</div></div>
      ${draftNote}
      <label class="lbl" for="shLink">Link yang dibagikan</label>
      <input id="shLink" type="url" value="${esc(st.link)}" placeholder="(opsional) link berita atau artikel Anda">
      <div class="row gap" style="flex-wrap:wrap">
        ${kind === 'article' ? '' : `<label class="ft-opt"><input type="checkbox" id="shCap" checked> Sertakan caption</label>`}
        <label class="ft-opt"><input type="checkbox" id="shLinkOn" checked> Sertakan link</label>
      </div>
      ${needRender ? '' : shareable
        ? `<button type="button" class="primary block sh-main" data-sh="native">📱 Bagikan via aplikasi…</button>
           <p class="hint">Membuka daftar aplikasi di perangkat Anda (Instagram, TikTok, WhatsApp, Facebook, X, dll.)${f ? ' dengan file dan caption' : ''}.</p>`
        : `<p class="hint">Browser ini belum mendukung berbagi ${f ? 'file' : ''} langsung ke aplikasi. Di HP (Chrome Android/Safari iPhone) tombol <b>Bagikan via aplikasi</b> akan muncul. Gunakan tombol di bawah.</p>`}
      ${f && uploads.length ? `<h3>Unggah ${KIND_LABEL[kind]} ke platform</h3>
        <p class="hint">Satu klik: caption tersalin, file terunduh, dan halaman unggah terbuka.</p>
        <div class="sh-grid">${uploads.map((u) => `<button type="button" class="sh-btn sh-${u.id}" data-sh="upload" data-p="${u.id}"><span>${u.icon}</span>${u.name}</button>`).join('')}</div>` : ''}
      <h3>Kirim teks${kind === 'article' ? '' : ' + link'}</h3>
      ${f ? '<p class="hint">File tidak ikut terkirim lewat tombol ini (batasan platform), hanya teks dan link.</p>' : ''}
      <div class="sh-grid">${LINKS.map((l) => `<button type="button" class="sh-btn sh-${l.id}" data-sh="link" data-p="${l.id}"${l.needLink ? ' data-needlink="1"' : ''}><span>${l.icon}</span>${l.name}</button>`).join('')}</div>
      <div class="row gap" style="flex-wrap:wrap">
        <button type="button" class="ghost small" data-sh="copycap">Salin caption</button>
        <button type="button" class="ghost small" data-sh="copylink">Salin link</button>
        ${f ? `<button type="button" class="ghost small" data-sh="download">⬇ Unduh ${f.type.startsWith('video') ? 'video' : 'gambar'}</button>` : ''}
      </div>
      <p class="hint" id="shMsg"></p>`;
    syncLinkButtons();
  }
  function syncLinkButtons() {
    const has = !!link();
    document.querySelectorAll('#shareBox [data-needlink]').forEach((b) => { b.disabled = !has; b.title = has ? '' : 'Butuh link (isi kolom Link)'; });
  }
  function msg(t, ok) { const el = $('shMsg'); if (el) { el.textContent = t; el.className = 'hint ' + (ok === false ? 'err-text' : ok ? 'ok-text' : ''); } }
  function copy(t) {
    try { return navigator.clipboard.writeText(t).then(() => true, () => false); } catch { return Promise.resolve(false); }
  }
  function download() {
    if (!st.file) return;
    const a = document.createElement('a'); a.href = st.fileUrl; a.download = st.file.name; document.body.appendChild(a); a.click(); a.remove();
  }

  document.addEventListener('click', async (e) => {
    const opener = e.target.closest('[data-share]');
    if (opener) { e.preventDefault(); open(opener.dataset.share); return; }
    const b = e.target.closest('#shareBox [data-sh]'); if (!b) return;
    const act = b.dataset.sh;
    if (act === 'close') { $('shareDlg').close(); return; }
    if (act === 'render') {
      b.disabled = true; $('shRenderMsg').textContent = ' Merender… (beberapa detik)';
      const out = await window.BKVideo.render({ noDownload: true });
      if (out) open('video'); else { b.disabled = false; $('shRenderMsg').textContent = ' Gagal merender. Lihat pesan di kartu Video.'; }
      return;
    }
    if (act === 'native') {
      const t = text(), l = link();
      const data = { title: title(), text: join(t, l) };
      if (st.file) data.files = [st.file];
      try { await navigator.share(data); msg('✓ Dibagikan.', true); }
      catch (err) { if (err && err.name !== 'AbortError') msg('Gagal membagikan: ' + (err.message || err.name), false); }
      return;
    }
    if (act === 'upload') {
      const u = UPLOAD.find((x) => x.id === b.dataset.p);
      // Semua langkah dijalankan langsung di dalam klik agar tidak diblokir browser
      const copied = copy(join(text(), link()));
      download();
      window.open(u.url, '_blank', 'noopener');
      msg(`${(await copied) ? '✓ Caption tersalin' : 'Caption tidak bisa disalin otomatis'} · ✓ ${st.file.name} terunduh · halaman ${u.name} dibuka. ${u.how}`, true);
      return;
    }
    if (act === 'link') {
      const p = LINKS.find((x) => x.id === b.dataset.p), url = p.make(text(), link());
      if (url.startsWith('mailto:')) location.href = url; else window.open(url, '_blank', 'noopener');
      msg(`Membuka ${p.name}…`, true);
      return;
    }
    if (act === 'copycap') { msg((await copy(join(text(), link()))) ? '✓ Caption tersalin.' : 'Gagal menyalin.', true); return; }
    if (act === 'copylink') { const l = link(); if (!l) { msg('Belum ada link.', false); return; } msg((await copy(l)) ? '✓ Link tersalin.' : 'Gagal menyalin.', true); return; }
    if (act === 'download') { download(); msg('✓ File diunduh.', true); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'shLink') syncLinkButtons(); });
  document.addEventListener('change', (e) => { if (e.target.id === 'shLinkOn') syncLinkButtons(); });
  $('shareDlg').addEventListener('click', (e) => { if (e.target === $('shareDlg')) $('shareDlg').close(); });

  window.BKShare = { open, fit };
})();
