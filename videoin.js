/* Berita Kilat — mode 🎬 Video: link YouTube atau video unggahan dianalisis Google Gemini menjadi bahan berita,
   lalu diolah alur yang sama dengan mode link (judul gambar, caption 5W+1H, naskah video, WordPress).
   Video unggahan sekaligus bisa dipakai sebagai latar Video Short (lihat footage.js & video.js). */
(() => {
  'use strict';
  const BK = window.BK;
  if (!BK) return;
  const $ = (id) => document.getElementById(id);
  const esc = BK.escapeHtml;
  let busy = false;

  // ID video dari berbagai bentuk link YouTube (watch, youtu.be, shorts, live, embed)
  const ytId = (u) => (String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:\S*&)?v=|shorts\/|live\/|embed\/))([\w-]{11})/) || [])[1] || '';
  const none = (v) => !v || /^tidak (disebutkan|diketahui|ada)/i.test(String(v).trim());

  function buildPrompt() {
    return `Anda adalah jurnalis senior media daring Indonesia. Tonton dan dengarkan VIDEO ini dengan teliti, lalu susun BAHAN BERITA faktual dalam Bahasa Indonesia baku (KBBI/PUEBI).

ATURAN
1. HANYA fakta yang benar-benar terdengar (ucapan) atau terlihat (teks di layar, tempat, peristiwa) di video. Jangan menambah dari pengetahuan luar. Unsur yang tidak ada → tulis "tidak disebutkan".
2. Nama orang, jabatan, lembaga, angka, dan tempat ditulis persis seperti di video (utamakan teks di layar). Bila ejaan nama tidak pasti, tambahkan "(ejaan belum pasti)".
3. "judul": maks. 14 kata, informatif, bukan clickbait.
4. "isi": 4–8 paragraf berita berstruktur piramida terbalik (terpenting dulu) yang mencakup apa, siapa, kapan, di mana, mengapa, bagaimana, dan konteks. Pisahkan paragraf dengan baris kosong.
5. "kutipan": 1–4 kutipan langsung terpenting (kata per kata, rapikan kata pengisi seperti "eee"), dengan nama/jabatan penutur dan detik mulai di video.
6. "cuplikan_mulai": detik ketika gambar paling representatif untuk dijadikan foto/latar (bukan layar hitam, logo, atau intro).
7. "jenis": wawancara / konferensi pers / liputan lapangan / pidato / lainnya. "kanal": nama kanal/penerbit bila terlihat, selain itu "".

Balas HANYA dengan JSON valid tanpa teks lain:
{"judul":"","ringkas":"","isi":"","w5h1":{"apa":"","siapa":"","kapan":"","di_mana":"","mengapa":"","bagaimana":""},"kutipan":[{"teks":"","tokoh":"","detik":0}],"lokasi":"","tanggal":"","jenis":"","kanal":"","cuplikan_mulai":0}`;
  }

  // Hasil analisis → objek artikel yang dipahami fitur lain
  // Kutipan ditulis sebagai paragraf berita biasa agar juga rapi di mode template (tanpa AI)
  function toArticle(d, o) {
    const quotes = (Array.isArray(d.kutipan) ? d.kutipan : []).filter((q) => q && q.teks)
      .map((q) => `"${String(q.teks).trim().replace(/^["“]|["”]$/g, '').replace(/[.!?]$/, '')}," kata ${q.tokoh || 'narasumber'}.`);
    const body = [String(d.isi || d.ringkas || '').trim(), ...quotes].filter(Boolean).join('\n\n');
    return {
      mode: 'video', url: o.url || '',
      title: String(d.judul || '').trim(),
      site: o.source || (o.url ? (d.kanal || 'YouTube') : BK.S().name || 'Video liputan'),
      date: none(d.tanggal) ? '' : String(d.tanggal), author: '', section: '',
      image: o.image || '', images: o.images || [],
      description: String(d.ringkas || '').trim() || (String(d.isi || '').split(/\n{2,}/)[0] || ''),
      body
    };
  }

  // Ambil satu frame video sebagai foto utama kartu Gambar
  function grabFrame(v, t) {
    return new Promise((res) => {
      const snap = () => {
        v.removeEventListener('seeked', snap);
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        try { c.getContext('2d').drawImage(v, 0, 0); res(c); } catch { res(null); }
      };
      v.pause();
      v.addEventListener('seeked', snap);
      setTimeout(snap, 4000);
      v.currentTime = Math.min(Math.max(0, t), Math.max(0, (v.duration || 1) - 0.2));
    });
  }

  async function run() {
    if (busy) return;
    const url = $('ytUrl').value.trim(), file = $('vidFile').files[0];
    if (!url && !file) { BK.status('Tempel link YouTube atau pilih file video dulu.', 'err'); return; }
    const id = file ? '' : ytId(url);
    if (!file && !id) { BK.status('Link YouTube tidak dikenali. Contoh: https://www.youtube.com/watch?v=… atau https://youtu.be/…', 'err'); return; }
    if (file && !/^video\//.test(file.type || 'video/')) { BK.status('File yang dipilih bukan video.', 'err'); return; }
    if (!window.BKAI || !window.BKAI.isReady('gemini')) {
      BK.status('Analisis video memakai <b>Google Gemini</b> (gratis). Isi API key Gemini dulu. <button type="button" class="linkish" data-open-ai="gemini">Atur Gemini</button>', 'err');
      return;
    }
    busy = true;
    const btn = $('btnVid'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Menganalisis';
    if (window.BKResearch) window.BKResearch.hide();
    try {
      const yt = id ? `https://www.youtube.com/watch?v=${id}` : '';
      const text = await window.BKAI.analyzeVideo(yt ? { youtubeUrl: yt } : { file }, buildPrompt(),
        (m) => BK.status('<span class="spin"></span>' + esc(m)));
      let d;
      try { d = BK.parseJson(text); } catch { throw new Error('jawaban Gemini tidak berformat benar, coba lagi'); }
      if (!d.judul && !d.isi) throw new Error('Gemini tidak menemukan isi berita di video ini');
      const source = $('vidSource').value.trim();
      const start = Math.max(0, Number(d.cuplikan_mulai) || 0);

      if (yt) {
        // Thumbnail YouTube sebagai foto utama (maxres tidak selalu ada → hq sebagai cadangan)
        const thumbs = [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`];
        await BK.useArticle(toArticle(d, { url: yt, source, image: thumbs[0], images: thumbs }));
        return;
      }

      // Video unggahan: latar Video Short (opsional) + frame terbaik sebagai foto utama
      const asBg = $('vidAsBg').checked;
      BK.status('<span class="spin"></span>Menyiapkan video…');
      let el;
      if (asBg) el = (await window.BKFootage.setUserVideo(file, start)).el;
      else { window.BKFootage.clearUserVideo(); el = await window.BKFootage.loadEl({ type: 'video', file }); }
      const a = toArticle(d, { source });
      BK.state.article = a; BK.fillRaw(a); BK.applyArticleToUi(a);
      const frame = await grabFrame(el, start + 0.5);
      BK.state.photo = frame; BK.draw();
      BK.photoUi(frame ? 'picked' : 'fail', 'cuplikan video');
      BK.status('<span class="spin"></span>Menulis caption…');
      await BK.makeCaption(true);
    } catch (e) {
      const msg = window.BKAI.friendlyError('gemini', e);
      const hint = e && e.status === 400 && /youtube|video|file_uri|uri/i.test(e.message || '')
        ? ' Pastikan video YouTube bersifat publik (bukan privat/unlisted terbatas usia) dan coba lagi.' : '';
      BK.status('Analisis video gagal: ' + esc(msg) + hint + ' <button type="button" class="linkish" data-open-ai="gemini">Atur Gemini</button>', 'err');
    } finally { busy = false; btn.disabled = false; btn.textContent = 'Analisis video'; }
  }

  // Link dan file saling menggantikan agar jelas mana yang dianalisis
  $('ytUrl').addEventListener('input', () => { if ($('ytUrl').value.trim() && $('vidFile').value) { $('vidFile').value = ''; $('vidAsBgBox').hidden = true; } });
  $('ytUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  $('vidFile').addEventListener('change', () => {
    const f = $('vidFile').files[0];
    $('vidAsBgBox').hidden = !f;
    if (f) $('ytUrl').value = '';
  });
  $('btnVid').addEventListener('click', run);

  window.BKVideoIn = { run, ytId, toArticle };
})();
