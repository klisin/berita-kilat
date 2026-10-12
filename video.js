/* Berita Kilat — video short 9:16 (maks. 15 detik) untuk TikTok, Reels, dan YouTube Shorts.
   Frame digambar di canvas lalu di-encode ke MP4 (H.264) dengan WebCodecs + mp4-muxer.
   Fallback: MediaRecorder (real-time) bila WebCodecs tidak tersedia. */
(() => {
  'use strict';
  const BK = window.BK;
  if (!BK) return;
  const $ = (id) => document.getElementById(id);
  const W = 1080, H = 1920, FPS = 30, SR = 48000;
  const PAD = 64, PAD_R = 140;           // safe zone kiri/kanan (ikon TikTok/Reels di kanan)
  const TEXT_W = W - PAD - PAD_R;
  const vcv = $('vcv'), vctx = vcv.getContext('2d');
  const music = { buf: null, name: '' };
  const bg = { it: null, buf: null };    // video latar unggahan (footage) + audio aslinya
  let player = null;                     // { raf, actx, srcs }
  let busy = false;
  let lastOut = null;                    // hasil render terakhir (dipakai menu Bagikan)
  const vStyle = () => $('vStyle').value || 'classic';
  const renderKey = () => JSON.stringify([getScript(), dur(), vStyle(), music.name, BK.S().name, bg.it && bg.it.credit, bg.it && bg.it.start, bgAudioOn()]);
  const bgAudioOn = () => !!(bg.it && bg.buf && $('vBgAudio').checked);
  const hasAudio = () => !!music.buf || bgAudioOn();

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const dur = () => parseInt($('vDur').value, 10) || 15;
  const slug = () => BK.slug('video-berita');

  // ---------- Naskah ----------
  const MAX_PTS = 6;
  const ptText = (p) => (typeof p === 'string' ? p : (p && p.teks) || '').trim();
  function setScript(v) {
    v = v || {};
    $('vHook').value = v.hook || '';
    $('vOutro').value = v.penutup || '';
    const box = $('vPoints');
    box.innerHTML = '<label class="lbl">Poin penjelasan (kalimat lengkap SPOK)</label>';
    const pts = Array.isArray(v.poin) ? v.poin : [];
    for (let i = 0; i < MAX_PTS; i++) {
      const ta = document.createElement('textarea');
      ta.id = `vTxt${i}`; ta.rows = 2; ta.className = 'vpt';
      ta.placeholder = `Poin ${i + 1}`; ta.setAttribute('aria-label', `Poin ${i + 1}`);
      ta.value = ptText(pts[i]);
      box.appendChild(ta);
    }
    box.insertAdjacentHTML('beforeend', '<p class="hint" id="vPtInfo"></p>');
    refresh();
  }
  function getScript() {
    const poin = [];
    for (let i = 0; i < MAX_PTS; i++) {
      const t = (($(`vTxt${i}`) || {}).value || '').trim();
      if (t) poin.push(t);
    }
    return {
      hook: $('vHook').value.trim() || $('headline').value.trim() || 'Tempel link berita untuk membuat video',
      poin,
      penutup: $('vOutro').value.trim() || 'Baca selengkapnya di tautan bio'
    };
  }

  // ---------- Timeline ----------
  // Hook di awal, poin di tengah, penutup di akhir. Jumlah poin menyesuaikan durasi
  // (min. ±3,2 dtk per poin) dan waktu tiap poin sebanding dengan panjang kalimatnya.
  function timeline(D, poin) {
    const hook = D >= 60 ? 4 : D >= 30 ? 3.5 : 2.5, outro = D >= 60 ? 4 : D >= 30 ? 3.5 : 2.5;
    const span = D - hook - outro;
    const pts = (poin || []).slice(0, Math.max(1, Math.floor(span / 3.2)));
    const n = pts.length;
    const sc = [{ type: 'hook', t0: 0, t1: n ? hook : D - outro }];
    if (n) {
      const wc = pts.map((p) => Math.max(6, p.split(/\s+/).length));
      const total = wc.reduce((a, b) => a + b, 0);
      let t = hook;
      pts.forEach((p, i) => {
        const len = i === n - 1 ? hook + span - t : span * wc[i] / total;
        sc.push({ type: 'point', i, n, t0: t, t1: t + len }); t += len;
      });
    }
    sc.push({ type: 'outro', t0: D - outro, t1: D });
    return sc;
  }

  // ---------- Merek (di-cache sebagai gambar agar cepat per frame) ----------
  // scale > 1 digambar langsung pada ukuran besar agar tetap tajam (dipakai di penutup)
  const brandCache = {};
  function brandImage(scale = 1) {
    const s = BK.S(), key = JSON.stringify(s), hit = brandCache[scale];
    if (hit && hit.key === key && hit.logo === BK.state.logo) return hit.img;
    const oc = document.createElement('canvas'); oc.width = Math.ceil(W * scale); oc.height = Math.ceil(360 * scale);
    const g = oc.getContext('2d');
    g.scale(scale, scale);
    BK.withCtx(g, () => BK.drawBrand(40, 40, true));
    g.setTransform(1, 0, 0, 1, 0, 0);
    let img = oc;
    try {
      const px = g.getImageData(0, 0, oc.width, oc.height).data;
      let x0 = oc.width, y0 = oc.height, x1 = -1, y1 = -1;
      for (let y = 0; y < oc.height; y++) for (let x = 0; x < oc.width; x++) {
        if (px[(y * oc.width + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 >= x0) {
        const m = Math.round(24 * scale); // ruang untuk bayangan/glow
        x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(oc.width - 1, x1 + m); y1 = Math.min(oc.height - 1, y1 + m);
        img = document.createElement('canvas'); img.width = x1 - x0 + 1; img.height = y1 - y0 + 1;
        img.getContext('2d').drawImage(oc, x0, y0, img.width, img.height, 0, 0, img.width, img.height);
        img.pad = m;
      }
    } catch {}
    brandCache[scale] = { key, logo: BK.state.logo, img };
    return img;
  }

  // Seperti BK.fitText, tetapi juga mengecilkan huruf bila ada kata panjang yang melebihi lebar
  function fit(c, text, font, weight, maxW, maxH, start, min, lh) {
    let f;
    for (let size = start; size >= min; size -= 2) {
      f = BK.fitText(text, font, weight, maxW, maxH, size, size, lh);
      c.font = `${weight} ${f.size}px "${font}"`;
      if (f.lines.every((l) => c.measureText(l).width <= maxW)) return f;
    }
    return f;
  }

  // ---------- Gambar satu frame ----------
  function textLines(c, lines, x, y, size, lh, local, align) {
    lines.forEach((l, i) => {
      const p = ease((local - 0.1 - i * 0.09) / 0.45);
      if (p <= 0) return;
      c.save(); c.globalAlpha *= p; c.translate(0, (1 - p) * 46);
      c.textAlign = align || 'left';
      c.fillText(l, x, y + i * size * lh);
      c.restore();
    });
  }
  // Gaya "Teks sorot": tiap baris diberi blok warna seperti caption TikTok/Reels
  function boxLines(c, lines, cx, y, size, lh, local, bg, fg, weight, font) {
    const rowH = size * lh, padX = size * 0.34;
    c.font = `${weight} ${size}px "${font}"`; c.textBaseline = 'middle'; c.textAlign = 'center';
    lines.forEach((l, i) => {
      const p = ease((local - 0.1 - i * 0.09) / 0.4);
      if (p <= 0) return;
      const w = c.measureText(l).width + padX * 2, k = 0.86 + 0.14 * p;
      c.save(); c.globalAlpha *= p; c.translate(cx, y + i * rowH + rowH / 2); c.scale(k, k);
      c.fillStyle = bg; BK.roundRect(-w / 2, -rowH / 2 + 3, w, rowH - 6, size * 0.2); c.fill();
      c.fillStyle = fg; c.fillText(l, 0, size * 0.04);
      c.restore();
    });
    c.textAlign = 'left'; c.textBaseline = 'top';
  }
  // ---------- Latar per adegan (footage) ----------
  const XF = 0.45; // lama crossfade antaradegan (detik)
  const sceneKey = (x) => (x.type === 'point' ? 'p' + x.i : x.type);
  const sceneIndex = (t, sc) => { const i = sc.findIndex((x) => t >= x.t0 && t < x.t1); return i < 0 ? sc.length - 1 : i; };
  function bgMedia(x) {
    const m = window.BKFootage && window.BKFootage.mediaFor(sceneKey(x));
    if (m) return { ...m, main: false };
    return BK.state.photo ? { el: BK.state.photo, type: 'photo', main: true } : null;
  }
  // Ken Burns berbeda tiap adegan: zoom masuk/keluar dan arah geser bergantian
  function drawBg(c, x, idx, t, D, s) {
    const m = bgMedia(x), k = clamp((t - x.t0) / (x.t1 - x.t0));
    if (!m) {
      const g = c.createLinearGradient(0, 0, W * (0.6 + 0.4 * t / D), H); g.addColorStop(0, s.panel); g.addColorStop(1, s.accent);
      c.fillStyle = g; c.fillRect(0, 0, W, H); return;
    }
    // Latar video bersambung: gerak kamera sangat halus agar tidak terasa goyang
    if (m.continuous) { const z = 1.02 + 0.02 * t / D; BK.drawCover(m.el, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z, 0.5); return; }
    const z = idx % 2 === 0 ? 1.06 + 0.12 * k : 1.18 - 0.12 * k;
    const dir = idx % 3 === 0 ? 1 : idx % 3 === 1 ? -1 : 0;
    const pw = W * z, ph = H * z;
    const dx = dir * (k - 0.5) * 60 + Math.sin(t * Math.PI * 2 / 14) * 20;
    const dy = (dir === 0 ? (k - 0.5) * 60 : 0) + Math.sin(t * Math.PI * 2 / 19) * 16;
    const fy = m.main ? (parseFloat($('focusY').value) || 0.35) : 0.4;
    BK.drawCover(m.el, (W - pw) / 2 + dx, (H - ph) / 2 + dy, pw, ph, fy);
  }
  // Ekspor: seek klip video ke waktu lokal adegan sebelum frame digambar
  function seekVideo(v, tt) {
    return new Promise((res) => {
      const target = v.duration ? tt % v.duration : 0;
      if (Math.abs(v.currentTime - target) < 0.002 && v.readyState >= 2) return res();
      let done = false;
      const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); res(); };
      v.addEventListener('seeked', fin);
      setTimeout(fin, 2000);
      v.currentTime = target;
    });
  }
  // Waktu klip: bersambung (global) untuk video pengguna, lokal per adegan untuk footage lain
  const clipTime = (m, x, t) => (m.continuous ? m.start + t : Math.max(0, t - x.t0));
  function activeScenes(t, sc) {
    const ci = sceneIndex(t, sc), list = [sc[ci]];
    if (ci > 0 && t - sc[ci].t0 < XF) list.push(sc[ci - 1]);
    return list;
  }
  async function prepareFrame(t, sc) {
    for (const x of activeScenes(t, sc)) {
      const m = bgMedia(x);
      if (m && m.type === 'video') { if (!m.el.paused) m.el.pause(); await seekVideo(m.el, clipTime(m, x, t)); }
    }
  }
  // Pratinjau & mode cadangan: klip diputar real-time
  const allVideos = () => (window.BKFootage ? window.BKFootage.activeItems() : []).filter((x) => x.type === 'video').map((x) => x.el);
  function syncPlayback(t, sc) {
    const live = new Set();
    activeScenes(t, sc).forEach((x) => {
      const m = bgMedia(x);
      if (!m || m.type !== 'video' || live.has(m.el)) return; // satu elemen bisa dipakai beberapa adegan aktif
      live.add(m.el);
      const target = clipTime(m, x, t) % (m.el.duration || 1);
      if (m.el.paused) { m.el.currentTime = target; m.el.play().catch(() => {}); }
      else if (m.continuous && Math.abs(m.el.currentTime - target) > 0.35) m.el.currentTime = target; // jaga sinkron dengan suara
    });
    allVideos().forEach((v) => { if (!live.has(v) && !v.paused) v.pause(); });
  }
  const pauseAll = () => allVideos().forEach((v) => { try { v.pause(); } catch {} });

  function renderFrame(c, t, D, sc, script) {
    BK.withCtx(c, () => {
      const s = BK.S();
      const font = s.font, lh = font === 'Merriweather' ? 1.25 : 1.1;
      c.save();
      c.clearRect(0, 0, W, H);
      // Latar adegan aktif + crossfade dari adegan sebelumnya
      const ci = sceneIndex(t, sc), lt = t - sc[ci].t0;
      const vs = vStyle(), panelled = vs === 'panel' || vs === 'frame';
      const FR = vs === 'frame' ? 30 : 0;          // tebal bingkai
      const PH = Math.round(H * 0.56);             // batas bawah foto pada gaya panel/bingkai
      // Gaya panel/bingkai: geser latar ke atas agar bagian tengah foto jatuh di area foto (penutup tetap penuh)
      const bgAt = (i) => {
        const dy = panelled && sc[i].type !== 'outro' ? -(H - PH) / 2 : 0;
        c.save(); c.translate(0, dy); drawBg(c, sc[i], i, t, D, s); c.restore();
      };
      if (ci > 0 && lt < XF) { bgAt(ci - 1); c.globalAlpha = ease(lt / XF); }
      bgAt(ci);
      c.globalAlpha = 1;
      const cur = sc.find((x) => t >= x.t0 && t < x.t1) || sc[sc.length - 1];
      const BOTTOM = H - 330;                      // di bawah ini tertutup keterangan TikTok/Reels
      // Gradasi agar teks terbaca (berbeda per gaya)
      let g = c.createLinearGradient(0, 0, 0, H);
      if (vs === 'classic') {
        g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.2, 'rgba(0,0,0,.08)');
        g.addColorStop(0.45, 'rgba(0,0,0,.25)'); g.addColorStop(0.8, 'rgba(0,0,0,.82)'); g.addColorStop(1, 'rgba(0,0,0,.92)');
      } else if (vs === 'pop') {
        g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.18, 'rgba(0,0,0,.12)');
        g.addColorStop(0.7, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
      } else {
        g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.16, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      }
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (panelled && cur.type !== 'outro') {
        c.fillStyle = s.panel; c.fillRect(0, PH, W, H - PH);
        c.fillStyle = s.accent; c.fillRect(0, PH, W, 12);
      }

      const local = t - cur.t0, len = cur.t1 - cur.t0;
      const last = cur === sc[sc.length - 1];
      const fade = last ? 1 : 1 - clamp((local - (len - 0.28)) / 0.28);

      // Bar progres ala story
      const gap = 10, bw = (W - PAD * 2 - gap * (sc.length - 1)) / sc.length;
      sc.forEach((x, i) => {
        const bx = PAD + i * (bw + gap), f = clamp((t - x.t0) / (x.t1 - x.t0));
        c.fillStyle = 'rgba(255,255,255,.3)'; BK.roundRect(bx, 150, bw, 8, 4); c.fill();
        if (f > 0) { c.fillStyle = '#fff'; BK.roundRect(bx, 150, Math.max(8, bw * f), 8, 4); c.fill(); }
      });

      c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 14;
      const brand = brandImage();
      if (cur.type !== 'outro') c.drawImage(brand, PAD - (brand.pad || 0), 190 - (brand.pad || 0));

      if (cur.type === 'hook' && panelled) {
        c.globalAlpha = fade; c.shadowBlur = 0;
        const kicker = $('kicker').value.trim(), top = PH + 74, kh = kicker ? 96 : 0;
        if (kicker) {
          const p = ease(local / 0.35);
          c.save(); c.globalAlpha *= p; c.translate(PAD - (1 - p) * 60, top); c.scale(1.3, 1.3);
          BK.drawKicker(kicker, 0, 0, s); c.restore();
        }
        const f = fit(c, script.hook, font, 900, TEXT_W, BOTTOM - top - kh - 40, 92, 44, lh);
        const y = top + kh, blockH = f.lines.length * f.size * lh;
        c.fillStyle = '#fff'; c.font = `900 ${f.size}px "${font}"`; c.textBaseline = 'top';
        textLines(c, f.lines, PAD, y, f.size, lh, local);
        const bp = ease((local - 0.5) / 0.5);
        c.fillStyle = s.accent; c.fillRect(PAD, y + blockH + 26, 160 * bp, 10);
      } else if (cur.type === 'hook' && vs === 'pop') {
        c.globalAlpha = fade; c.shadowBlur = 0;
        const cx = (PAD + W - PAD_R) / 2, rlh = 1.24;
        const f = fit(c, script.hook, font, 900, TEXT_W - 80, H * 0.34, 92, 46, rlh);
        const blockH = f.lines.length * f.size * rlh, y = H * 0.5 - blockH / 2;
        const kicker = $('kicker').value.trim();
        if (kicker) {
          const p = ease(local / 0.35);
          c.font = '800 26px Inter'; const kw = (c.measureText(kicker.toUpperCase()).width + 36) * 1.3;
          c.save(); c.globalAlpha *= p; c.translate(cx - kw / 2, y - 96 - (1 - p) * 30); c.scale(1.3, 1.3);
          BK.drawKicker(kicker, 0, 0, s); c.restore();
        }
        boxLines(c, f.lines, cx, y, f.size, rlh, local, s.accent, '#fff', 900, font);
      } else if (cur.type === 'hook') {
        c.globalAlpha = fade;
        const f = fit(c, script.hook, font, 900, TEXT_W, H * 0.3, 104, 52, lh);
        const blockH = f.lines.length * f.size * lh;
        const y = H * 0.71 - blockH;
        const kicker = $('kicker').value.trim();
        if (kicker) {
          const p = ease(local / 0.35);
          c.save(); c.globalAlpha *= p; c.shadowBlur = 0; c.translate(PAD - (1 - p) * 60, y - 100); c.scale(1.3, 1.3);
          BK.drawKicker(kicker, 0, 0, s); c.restore();
        }
        c.fillStyle = '#fff'; c.font = `900 ${f.size}px "${font}"`; c.textBaseline = 'top';
        textLines(c, f.lines, PAD, y, f.size, lh, local);
        const bp = ease((local - 0.5) / 0.5);
        c.shadowBlur = 0; c.fillStyle = s.accent; c.fillRect(PAD, y + blockH + 30, 160 * bp, 10);
      } else if (cur.type === 'point' && panelled) {
        const text = script.poin[cur.i], blh = 1.28;
        const inP = ease(local / 0.4);
        c.globalAlpha = fade; c.shadowBlur = 0;
        const top = PH + 70;
        const f = fit(c, text, font, 700, TEXT_W - 34, BOTTOM - top, 60, 34, blh);
        const blockH = f.lines.length * f.size * blh;
        c.fillStyle = s.accent; c.fillRect(PAD, top + 4, 10, blockH * inP);
        c.fillStyle = '#fff'; c.font = `700 ${f.size}px "${font}"`; c.textBaseline = 'top';
        textLines(c, f.lines, PAD + 36, top, f.size, blh, local);
      } else if (cur.type === 'point' && vs === 'pop') {
        const text = script.poin[cur.i], rlh = 1.26;
        c.globalAlpha = fade; c.shadowBlur = 0;
        const cx = (PAD + W - PAD_R) / 2;
        const f = fit(c, text, font, 800, TEXT_W - 90, H * 0.4, 58, 34, rlh);
        const blockH = f.lines.length * f.size * rlh;
        boxLines(c, f.lines, cx, Math.min(H * 0.6 - blockH / 2, BOTTOM - blockH), f.size, rlh, local, 'rgba(255,255,255,.96)', '#111', 800, font);
      } else if (cur.type === 'point') {
        // Kalimat penjelasan utuh (SPOK) di panel gelap, huruf lebih kecil agar muat lengkap
        const text = script.poin[cur.i];
        const inP = ease(local / 0.4), blh = 1.28;
        c.globalAlpha = fade * inP;
        const f = fit(c, text, font, 700, TEXT_W - 60, H * 0.36, 62, 36, blh);
        const blockH = f.lines.length * f.size * blh;
        const px = 40 - (1 - inP) * 80, pw = W - 40 - 110, top = H * 0.58 - blockH / 2 - 56;
        const ph = blockH + 112;
        c.shadowBlur = 30; c.shadowColor = 'rgba(0,0,0,.35)';
        c.fillStyle = 'rgba(10,14,22,.74)'; BK.roundRect(px, top, pw, ph, 26); c.fill();
        c.shadowBlur = 0;
        c.fillStyle = s.accent; c.fillRect(px, top + 30, 10, ph - 60);
        c.fillStyle = '#fff'; c.font = `700 ${f.size}px "${font}"`; c.textBaseline = 'top';
        textLines(c, f.lines, px + 54, top + 56, f.size, blh, local);
      } else {
        // Penutup: foto digelapkan, merek besar di tengah, ajakan + handle + sumber
        const p = ease(local / 0.5);
        c.shadowBlur = 0;
        c.fillStyle = `rgba(5,8,14,${0.35 + 0.45 * p})`; c.fillRect(0, 0, W, H);
        const big = brandImage(2.2);
        const sc2 = Math.min(1, (W * 0.75) / big.width);
        const bw2 = big.width * sc2, bh2 = big.height * sc2;
        c.globalAlpha = p;
        c.drawImage(big, (W - bw2) / 2, H * 0.36 - bh2 / 2 - (1 - p) * 40, bw2, bh2);
        c.fillStyle = '#fff'; c.textBaseline = 'top';
        const f = fit(c, script.penutup, 'Inter', 800, W - 200, 220, 64, 36, 1.2);
        c.font = `800 ${f.size}px Inter`;
        textLines(c, f.lines, W / 2, H * 0.36 + bh2 / 2 + 70, f.size, 1.2, local - 0.2, 'center');
        let y = H * 0.36 + bh2 / 2 + 90 + f.lines.length * f.size * 1.2;
        const q = ease((local - 0.6) / 0.4);
        c.globalAlpha = q;
        if (s.handle) {
          c.font = '800 40px Inter'; const tw = c.measureText(s.handle).width + 60;
          c.fillStyle = s.accent; BK.roundRect((W - tw) / 2, y + 20, tw, 72, 36); c.fill();
          c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.handle, W / 2, y + 57);
          y += 110;
        }
        const fsrc = window.BKFootage ? window.BKFootage.sourcesLine() : '';
        const credit = [$('credit').value.trim(), fsrc ? 'Foto: ' + fsrc : ''].filter(Boolean).join(' · ');
        if (credit) {
          const fc = fit(c, credit, 'Inter', 600, W - 160, 110, 28, 20, 1.3);
          c.font = `600 ${fc.size}px Inter`; c.fillStyle = 'rgba(255,255,255,.7)'; c.textAlign = 'center'; c.textBaseline = 'top';
          fc.lines.forEach((l, i) => c.fillText(l, W / 2, y + 30 + i * fc.size * 1.3));
        }
        c.textAlign = 'left';
      }
      if (FR) {
        c.globalAlpha = 1; c.shadowBlur = 0; c.fillStyle = s.accent;
        c.beginPath(); c.rect(0, 0, W, H); c.rect(FR, FR, W - FR * 2, H - FR * 2); c.fill('evenodd');
      }
      c.restore();
    });
  }

  // ---------- Pratinjau ----------
  let lastShown = -1;
  const shownPoints = () => timeline(dur(), getScript().poin).filter((x) => x.type === 'point').length;
  function renderStill() {
    const D = dur(), script = getScript(), sc = timeline(D, script.poin);
    const shown = sc.filter((x) => x.type === 'point').length, info = $('vPtInfo');
    // Panel footage menandai adegan yang tidak tampil pada durasi ini
    if (shown !== lastShown) { lastShown = shown; if (window.BKFootage) window.BKFootage.render(); }
    if (info) info.textContent = script.poin.length
      ? `Durasi ${D} detik menampilkan ${shown} dari ${script.poin.length} poin${shown < script.poin.length ? ' (pilih durasi lebih panjang untuk menampilkan semua)' : ''}.`
      : '';
    renderFrame(vctx, Math.min(1.6, sc[0].t1 - 0.3), D, sc, script);
  }
  let refreshPending = false;
  function refresh() {
    if (player || refreshPending) return;
    refreshPending = true;
    requestAnimationFrame(() => { refreshPending = false; if (!player) renderStill(); });
  }
  function stopPreview() {
    if (!player) return;
    cancelAnimationFrame(player.raf);
    (player.srcs || []).forEach((x) => { try { x.stop(); } catch {} });
    try { player.actx && player.actx.close(); } catch {}
    pauseAll();
    player = null; $('btnVPlay').textContent = '▶ Putar pratinjau';
    renderStill();
  }
  function musicGraph(actx, D, startAt, duck = 1) {
    const src = actx.createBufferSource(); src.buffer = music.buf;
    const gain = actx.createGain(), vol = (parseFloat($('vVol').value) || 0.7) * duck;
    gain.gain.setValueAtTime(vol, startAt); gain.gain.setValueAtTime(vol, startAt + Math.max(0, D - 1)); gain.gain.linearRampToValueAtTime(0, startAt + D);
    src.connect(gain);
    const off = Math.min(parseFloat($('vMusicStart').value) || 0, Math.max(0, music.buf.duration - 1));
    // Musik lebih pendek dari video → diulang dari titik mulai
    if (music.buf.duration - off < D) { src.loop = true; src.loopStart = off; src.loopEnd = music.buf.duration; }
    src.start(startAt, off, D);
    return { src, gain };
  }
  // Musik + suara asli video latar. Bila keduanya ada, musik diturunkan agar suara asli terdengar.
  function audioGraph(actx, D, startAt) {
    const out = actx.createGain(), srcs = [];
    const useBg = bgAudioOn();
    if (music.buf) { const m = musicGraph(actx, D, startAt, useBg ? 0.3 : 1); m.gain.connect(out); srcs.push(m.src); }
    if (useBg) {
      const src = actx.createBufferSource(); src.buffer = bg.buf;
      const g = actx.createGain();
      g.gain.setValueAtTime(1, startAt); g.gain.setValueAtTime(1, startAt + Math.max(0, D - 0.6)); g.gain.linearRampToValueAtTime(0, startAt + D);
      const off = (bg.it.start || 0) % bg.buf.duration;
      if (bg.buf.duration - off < D) { src.loop = true; src.loopStart = 0; src.loopEnd = bg.buf.duration; } // berulang seperti videonya
      src.connect(g); g.connect(out); src.start(startAt, off, D); srcs.push(src);
    }
    return { out, srcs };
  }
  function playPreview() {
    if (player) return stopPreview();
    const D = dur(), script = getScript(), sc = timeline(D, script.poin);
    player = { raf: 0, actx: null, srcs: [] };
    if (hasAudio()) {
      try {
        const actx = new AudioContext(); const a = audioGraph(actx, D, actx.currentTime + 0.05);
        a.out.connect(actx.destination); player.actx = actx; player.srcs = a.srcs;
      } catch {}
    }
    $('btnVPlay').textContent = '■ Hentikan';
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= D) { stopPreview(); return; }
      syncPlayback(t, sc);
      renderFrame(vctx, t, D, sc, script);
      player.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  // ---------- Audio untuk ekspor ----------
  async function renderAudio(D) {
    const oac = new OfflineAudioContext(2, Math.ceil(D * SR), SR);
    const a = audioGraph(oac, D, 0); a.out.connect(oac.destination);
    return oac.startRendering();
  }
  async function pickAudioCodec() {
    if (typeof AudioEncoder === 'undefined') return null;
    for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: SR, numberOfChannels: 2, bitrate: 128000 };
      try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, mux }; } catch {}
    }
    return null;
  }
  async function pickVideoConfig() {
    if (typeof VideoEncoder === 'undefined' || !window.Mp4Muxer) return null;
    for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
      for (const hw of ['prefer-hardware', 'no-preference', 'prefer-software']) {
        const cfg = { codec, width: W, height: H, bitrate: 6_000_000, framerate: FPS, avc: { format: 'avc' }, hardwareAcceleration: hw };
        try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch {}
      }
    }
    return null;
  }

  // ---------- Ekspor: WebCodecs → MP4 ----------
  async function exportWebCodecs(vcfg, D, script, sc, onProg) {
    const acodec = hasAudio() ? await pickAudioCodec() : null;
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: FPS },
      audio: acodec ? { codec: acodec.mux, numberOfChannels: 2, sampleRate: SR } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    });
    let err = null;
    const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { err = e; } });
    enc.configure(vcfg);
    const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
    const r2 = rc.getContext('2d');
    const N = Math.round(D * FPS);
    for (let f = 0; f < N; f++) {
      if (err) throw err;
      await prepareFrame(f / FPS, sc);
      renderFrame(r2, f / FPS, D, sc, script);
      const frame = new VideoFrame(rc, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
      frame.close();
      while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
      if (f % 6 === 0) { onProg(f / N * (acodec ? 0.9 : 1)); await new Promise((r) => setTimeout(r, 0)); }
    }
    await enc.flush(); enc.close();
    if (err) throw err;
    if (acodec) {
      const ab = await renderAudio(D);
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: (e) => { err = e; } });
      aenc.configure(acodec.cfg);
      const L = ab.getChannelData(0), R = ab.getChannelData(1), step = 1024;
      for (let i = 0; i < ab.length; i += step) {
        const n = Math.min(step, ab.length - i), data = new Float32Array(n * 2);
        data.set(L.subarray(i, i + n), 0); data.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / SR), data });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
      if (err) throw err;
    }
    muxer.finalize();
    onProg(1);
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', label: 'MP4 H.264' + (acodec ? ' + ' + acodec.mux.toUpperCase() : '') };
  }

  // ---------- Ekspor cadangan: MediaRecorder (real-time) ----------
  async function exportRecorder(D, script, sc, onProg) {
    if (typeof MediaRecorder === 'undefined') throw new Error('Browser ini tidak mendukung pembuatan video. Gunakan Chrome atau Edge terbaru.');
    const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
    const r2 = rc.getContext('2d');
    renderFrame(r2, 0, D, sc, script);
    const stream = rc.captureStream(FPS);
    let actx = null;
    if (hasAudio()) {
      actx = new AudioContext(); const dest = actx.createMediaStreamDestination();
      const a = audioGraph(actx, D, actx.currentTime + 0.05); a.out.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mime = types.find((x) => MediaRecorder.isTypeSupported(x)) || '';
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 6_000_000 });
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start(250);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= D) return resolve();
        syncPlayback(t, sc); renderFrame(r2, t, D, sc, script); onProg(t / D);
        setTimeout(tick, 1000 / FPS);
      };
      tick();
    });
    rec.stop(); await done;
    if (actx) actx.close();
    pauseAll();
    const type = rec.mimeType || mime || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    onProg(1);
    return { blob: new Blob(parts, { type }), ext, label: ext.toUpperCase() + ' (mode cadangan)' };
  }

  async function render(opts = {}) {
    if (busy) return null;
    stopPreview();
    busy = true;
    const btn = $('btnVRender'), prog = $('vProg'), bar = $('vProgBar'), info = $('vInfo');
    btn.disabled = true; prog.hidden = false; bar.style.width = '0%';
    const onProg = (p) => { bar.style.width = Math.round(p * 100) + '%'; btn.innerHTML = `<span class="spin"></span>Merender ${Math.round(p * 100)}%`; };
    try {
      await (document.fonts ? document.fonts.ready : Promise.resolve());
      const D = dur(), script = getScript(), sc = timeline(D, script.poin);
      const vcfg = opts.forceRecorder ? null : await pickVideoConfig();
      const out = vcfg ? await exportWebCodecs(vcfg, D, script, sc, onProg) : await exportRecorder(D, script, sc, onProg);
      lastOut = { ...out, key: renderKey() };
      info.textContent = `${out.label} · 1080×1920 · ${D} detik · ${(out.blob.size / 1048576).toFixed(1)} MB${music.buf && bgAudioOn() ? ' · musik + suara asli' : music.buf ? ' · dengan musik' : bgAudioOn() ? ' · suara asli video' : ' · tanpa suara'}`;
      if (!opts.noDownload) {
        const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = slug() + '.' + out.ext; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      BK.status('Video selesai dibuat. Periksa kembali teks sebelum diunggah.', 'ok');
      return out;
    } catch (e) {
      const msg = e && e.name === 'SecurityError' ? 'Foto berasal dari server lain sehingga tidak bisa dijadikan video. Unggah foto manual.' : (e && e.message) || String(e);
      info.textContent = 'Gagal membuat video: ' + msg;
      BK.status('Gagal membuat video: ' + BK.escapeHtml(msg), 'err');
      return null;
    } finally {
      busy = false; btn.disabled = false; btn.innerHTML = '⬇ Render &amp; unduh video';
      setTimeout(() => { prog.hidden = true; }, 1200);
    }
  }

  // ---------- Musik ----------
  $('vMusic').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const actx = new AudioContext();
      music.buf = await actx.decodeAudioData(await f.arrayBuffer());
      actx.close();
      music.name = f.name;
      $('vMusicStart').max = String(Math.max(0, Math.floor(music.buf.duration - 3)));
      $('vMusicStart').value = '0';
      $('vMusicName').textContent = `♪ ${f.name} (${Math.round(music.buf.duration)} dtk)`;
      $('vMusicCtl').hidden = false; $('vMusicInfo').hidden = false;
    } catch {
      music.buf = null; e.target.value = '';
      BK.status('File musik tidak bisa dibaca. Coba MP3, M4A, atau WAV.', 'err');
    }
  });
  $('btnVMusicClear').addEventListener('click', () => {
    music.buf = null; music.name = ''; $('vMusic').value = '';
    $('vMusicCtl').hidden = true; $('vMusicInfo').hidden = true;
  });

  // ---------- Video latar unggahan (dari mode 🎬 Video) ----------
  async function onUserVideo(it) {
    stopPreview();
    bg.it = it; bg.buf = null;
    $('vBgCtl').hidden = !it;
    if (!it) { refresh(); return; }
    const d = Math.floor(it.el.duration || 0), cb = $('vBgAudio'), info = $('vBgInfo');
    const head = `🎬 ${it.credit} (${d} dtk) dipakai sebagai latar semua adegan.`;
    $('vBgStart').max = String(Math.max(0, d - 3));
    $('vBgStart').value = String(Math.min(it.start || 0, Math.max(0, d - 3)));
    it.start = parseFloat($('vBgStart').value) || 0;
    info.textContent = head + ' Membaca suara…';
    try {
      if (it.file.size > 300 * 1048576) throw new Error('terlalu besar');
      const actx = new AudioContext();
      const buf = await actx.decodeAudioData(await it.file.arrayBuffer());
      actx.close();
      if (bg.it !== it) return;
      bg.buf = buf; cb.disabled = false;
      info.textContent = head + ' Centang "Pakai suara asli video" untuk menyertakan suaranya.';
    } catch {
      if (bg.it !== it) return;
      cb.checked = false; cb.disabled = true;
      info.textContent = head + ' Suara asli tidak bisa dibaca (video tanpa suara atau lebih dari 300 MB).';
    }
    refresh();
  }
  $('vBgStart').addEventListener('input', () => { if (bg.it) { bg.it.start = parseFloat($('vBgStart').value) || 0; refresh(); } });
  $('vBgAudio').addEventListener('change', refresh);

  // ---------- Event ----------
  $('btnVPlay').addEventListener('click', playPreview);
  $('btnVRender').addEventListener('click', () => render());
  $('videoCard').addEventListener('input', (e) => { if (!/vVol|vMusic/.test(e.target.id) && !e.target.closest('#footBox')) refresh(); });
  $('vDur').addEventListener('change', refresh);
  $('vStyle').value = BK.store.get('vStyle', 'classic');
  $('vStyle').addEventListener('change', () => { BK.store.set('vStyle', $('vStyle').value); refresh(); });

  // Hasil render terakhir hanya dipakai bila naskah/durasi/musik belum berubah
  const lastOutput = () => (lastOut && lastOut.key === renderKey() ? lastOut : null);
  window.BKVideo = { setScript, onUserVideo, refresh, render, renderFrame, timeline, getScript, shownPoints, lastOutput };
  setScript(BK.state.video || null);
})();
