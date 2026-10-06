/* Berita Kilat — Mesin AI: banyak penyedia, pengaturan mudah, cadangan otomatis.
   Semua penyedia di sini bisa dipanggil langsung dari browser (CORS diizinkan).
   API key hanya disimpan di localStorage browser pengguna. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('bk_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('bk_' + k, JSON.stringify(v)); return true; } catch { return false; } }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Registri penyedia ----------
  // tier A = tanpa API key, B = gratis dengan API key, C = berbayar
  const PROVIDERS = [
    {
      id: 'puter', name: 'Puter', tier: 'A', type: 'puter', badges: ['Tanpa API key'],
      desc: 'Cukup login akun Puter (gratis) sekali. Bisa memakai model GPT, Claude, atau Gemini. Kuota gratis per akun terbatas.',
      model: '', models: ['openai/gpt-5.4-nano', 'google/gemini-3.1-pro-preview', 'anthropic/claude-sonnet-5'],
      steps: ['Klik tombol <b>Hubungkan akun Puter</b> di bawah.', 'Di jendela yang muncul, buat akun atau masuk (bisa dengan Google).', 'Selesai. Status berubah menjadi "Terhubung".']
    },
    {
      id: 'groq', name: 'Groq', tier: 'B', type: 'openai', recommended: true, badges: ['Gratis', 'Sangat cepat'],
      url: 'https://api.groq.com/openai/v1/chat/completions', modelsUrl: 'https://api.groq.com/openai/v1/models',
      keyUrl: 'https://console.groq.com/keys', prefix: ['gsk_'], json: true,
      model: 'llama-3.3-70b-versatile', models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
      prefer: /70b|120b/,
      desc: 'Gratis tanpa kartu kredit (±1.000 caption per hari). Pilihan paling mudah untuk mulai.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah.', 'Masuk dengan akun Google, GitHub, atau email.', 'Klik <b>Create API Key</b>, beri nama bebas (mis. berita-kilat), lalu <b>Submit</b>.', 'Salin key (diawali <code>gsk_</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'gemini', name: 'Google Gemini', tier: 'B', type: 'gemini', badges: ['Gratis'],
      keyUrl: 'https://aistudio.google.com/apikey', prefix: ['AIza'],
      model: 'gemini-flash-latest', models: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'],
      prefer: /flash/,
      desc: 'Gratis dengan akun Google. Bahasa Indonesia sangat baik.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah.', 'Masuk dengan akun Google Anda.', 'Klik <b>Create API key</b> (bila diminta, pilih atau buat project).', 'Salin key (diawali <code>AIza</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'openrouter', name: 'OpenRouter', tier: 'B', type: 'openai', badges: ['Gratis (model :free)'],
      url: 'https://openrouter.ai/api/v1/chat/completions', modelsUrl: 'https://openrouter.ai/api/v1/models',
      keyUrl: 'https://openrouter.ai/settings/keys', prefix: ['sk-or-'], json: false, freeOnly: true,
      model: 'google/gemma-4-31b-it:free', models: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-26b-a4b-it:free'],
      prefer: /gemma|nemotron-3-super|llama/,
      desc: 'Satu key untuk banyak model. Model berakhiran ":free" gratis (±50 permintaan per hari).',
      steps: ['Klik <b>Buka halaman API key</b> di bawah.', 'Daftar/masuk (bisa dengan Google).', 'Klik <b>Create API Key</b>, beri nama, lalu <b>Create</b>.', 'Salin key (diawali <code>sk-or-</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'cerebras', name: 'Cerebras', tier: 'B', type: 'openai', badges: ['Gratis', 'Sangat cepat'],
      url: 'https://api.cerebras.ai/v1/chat/completions', modelsUrl: 'https://api.cerebras.ai/v1/models',
      keyUrl: 'https://cloud.cerebras.ai/', prefix: ['csk-'], json: true,
      model: 'gpt-oss-120b', models: ['gpt-oss-120b', 'qwen-3.8-27b'], prefer: /120b|qwen/,
      desc: 'Paket Free Trial gratis tanpa kartu kredit.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu daftar/masuk.', 'Buka menu <b>API Keys</b> di sisi kiri.', 'Klik <b>Generate API Key</b>.', 'Salin key (diawali <code>csk-</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'mistral', name: 'Mistral', tier: 'B', type: 'openai', badges: ['Gratis (paket Experiment)'],
      url: 'https://api.mistral.ai/v1/chat/completions', modelsUrl: 'https://api.mistral.ai/v1/models',
      keyUrl: 'https://console.mistral.ai/api-keys', prefix: [], json: true,
      model: 'mistral-small-latest', models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'], prefer: /small|medium/,
      desc: 'Paket gratis "Experiment" (perlu verifikasi nomor HP).',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu daftar/masuk.', 'Saat ditanya paket, pilih <b>Experiment</b> (gratis) dan verifikasi nomor HP.', 'Klik <b>Create new key</b>.', 'Salin key lalu tempel di kolom di bawah.']
    },
    {
      id: 'huggingface', name: 'Hugging Face', tier: 'B', type: 'openai', badges: ['Kredit gratis bulanan'],
      url: 'https://router.huggingface.co/v1/chat/completions', modelsUrl: 'https://router.huggingface.co/v1/models',
      keyUrl: 'https://huggingface.co/settings/tokens/new?tokenType=fineGrained', prefix: ['hf_'], json: false,
      model: 'meta-llama/Llama-3.3-70B-Instruct', models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'], prefer: /70B|72B/i,
      desc: 'Kredit gratis kecil setiap bulan, banyak pilihan model terbuka.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu daftar/masuk.', 'Beri nama token, lalu centang <b>Make calls to Inference Providers</b>.', 'Klik <b>Create token</b>.', 'Salin token (diawali <code>hf_</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'pollinations', name: 'Pollinations', tier: 'B', type: 'openai', badges: ['Kuota harian gratis'],
      url: 'https://gen.pollinations.ai/v1/chat/completions', modelsUrl: 'https://gen.pollinations.ai/v1/models',
      keyUrl: 'https://enter.pollinations.ai/keys', prefix: ['sk_', 'pk_'], json: false,
      model: 'openai', models: ['openai', 'mistral', 'gemini'], prefer: /openai|gpt|gemini|mistral/,
      desc: 'Daftar gratis, dapat kuota harian ("pollen") untuk banyak model.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu masuk (bisa dengan GitHub/Google).', 'Buat key baru dengan tipe <b>Secret</b>.', 'Salin key (diawali <code>sk_</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'claude', name: 'Claude (Anthropic)', tier: 'C', type: 'claude', badges: ['Berbayar', 'Kualitas tinggi'],
      keyUrl: 'https://console.anthropic.com/settings/keys', prefix: ['sk-ant-'],
      model: 'claude-opus-5-5', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'],
      desc: 'Penulisan sangat rapi dan teliti. Perlu saldo di akun Anthropic.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu daftar/masuk.', 'Isi saldo di menu <b>Billing</b>.', 'Klik <b>Create Key</b>.', 'Salin key (diawali <code>sk-ant-</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'openai', name: 'OpenAI (ChatGPT)', tier: 'C', type: 'openai', badges: ['Berbayar'],
      url: 'https://api.openai.com/v1/chat/completions', modelsUrl: 'https://api.openai.com/v1/models',
      keyUrl: 'https://platform.openai.com/api-keys', prefix: ['sk-proj-', 'sk-svcacct-'], json: true, noTemp: true,
      model: 'gpt-5-mini', models: ['gpt-5-mini', 'gpt-5-nano', 'gpt-5'], prefer: /gpt-5.*mini|gpt-5/,
      desc: 'Model ChatGPT lewat API (terpisah dari langganan ChatGPT Plus). Perlu saldo.',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu masuk.', 'Isi saldo di <b>Settings → Billing</b>.', 'Klik <b>Create new secret key</b>.', 'Salin key (diawali <code>sk-</code>) lalu tempel di kolom di bawah.']
    },
    {
      id: 'deepseek', name: 'DeepSeek', tier: 'C', type: 'openai', badges: ['Berbayar', 'Sangat murah'],
      url: 'https://api.deepseek.com/chat/completions', modelsUrl: 'https://api.deepseek.com/models',
      keyUrl: 'https://platform.deepseek.com/api_keys', prefix: [], json: true,
      model: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-reasoner'], prefer: /chat/,
      desc: 'Harga sangat murah (isi saldo mulai beberapa dolar).',
      steps: ['Klik <b>Buka halaman API key</b> di bawah, lalu daftar/masuk.', 'Isi saldo di menu <b>Top up</b>.', 'Klik <b>Create new API key</b>.', 'Salin key (diawali <code>sk-</code>) lalu tempel di kolom di bawah.']
    }
  ];
  const P = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
  const TIERS = { A: 'Tanpa API key (cukup login)', B: 'Gratis dengan API key (daftar ±2 menit)', C: 'Berbayar (kualitas tertinggi)' };
  // Urutan cadangan otomatis: gratis ber-key → berbayar → tanpa key
  const AUTO_ORDER = ['groq', 'gemini', 'cerebras', 'openrouter', 'mistral', 'huggingface', 'pollinations', 'claude', 'openai', 'deepseek', 'puter'];

  // ---------- Penyimpanan key & model (dengan migrasi dari versi lama) ----------
  const keys = () => store.get('aiKeys', {}) || {};
  const models = () => store.get('aiModels', {}) || {};
  const keyOf = (id) => (keys()[id] || '').trim();
  const modelOf = (id) => (models()[id] || P[id].model || '').trim();
  function setKey(id, v) { const k = keys(); if (v) k[id] = v.trim(); else delete k[id]; store.set('aiKeys', k); }
  function setModel(id, v) { const m = models(); if (v && v !== P[id].model) m[id] = v.trim(); else delete m[id]; store.set('aiModels', m); }
  (function migrate() {
    if (store.get('aiMigrated', false)) return;
    const g = store.get('gKey', ''), c = store.get('cKey', ''), gm = store.get('gModel', ''), cm = store.get('cModel', '');
    if (g) setKey('gemini', g);
    if (c) setKey('claude', c);
    if (gm && gm !== 'gemini-2.5-flash') setModel('gemini', gm);
    if (cm && cm !== 'claude-sonnet-4-5') setModel('claude', cm);
    store.set('aiMigrated', true);
  })();
  const isReady = (id) => {
    const p = P[id];
    if (p.type === 'puter') return !!store.get('aiPuterUser', '');
    return p.noKey || !!keyOf(id);
  };
  // Pilihan mesin lama tanpa key (mis. "claude" kosong) → Otomatis, agar tidak langsung gagal
  (function fixEngine() {
    const e = store.get('engine', null);
    if (!e || e === 'template' || e === 'auto') return;
    if (!P[e] || !isReady(e)) store.set('engine', 'auto');
  })();

  // ---------- Pemanggilan ----------
  async function fetchT(url, opts = {}, ms = 90000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(t); }
  }
  function httpError(status, msg) { const e = new Error(msg || ('HTTP ' + status)); e.status = status; return e; }
  async function readError(r) {
    let msg = '';
    try { const j = await r.json(); msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || ''; } catch {}
    return httpError(r.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  const stripThink = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  async function callOpenAI(p, key, model, prompt, useJson = p.json) {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    if (p.id === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'Berita Kilat'; }
    const body = { model, messages: [{ role: 'user', content: prompt }] };
    if (!p.noTemp) body.temperature = 0.4;
    if (useJson) body.response_format = { type: 'json_object' };
    const r = await fetchT(p.url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!r.ok) {
      const e = await readError(r);
      // Sebagian model tidak mendukung mode JSON → ulangi tanpa
      if (useJson && r.status === 400 && /response_format|json/i.test(e.message)) return callOpenAI(p, key, model, prompt, false);
      throw e;
    }
    const j = await r.json();
    // Beberapa penyedia mengirim error dengan status HTTP 200
    if (j && (j.success === false || (j.error && !j.choices))) throw httpError(j.status || (j.error && j.error.status) || 502, (j.error && (j.error.message || j.error)) || 'Gagal');
    const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const text = Array.isArray(c) ? c.map((x) => x.text || '').join('') : c;
    if (!text) throw httpError(502, 'Jawaban kosong');
    return stripThink(text);
  }
  async function callGemini(p, key, model, prompt) {
    const r = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } })
    });
    if (!r.ok) throw await readError(r);
    const j = await r.json();
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const text = parts.map((x) => x.text || '').join('');
    if (!text) throw httpError(502, 'Jawaban kosong');
    return text;
  }
  async function callClaude(p, key, model, prompt) {
    const headers = { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    // Model Claude terbaru tidak menerima "temperature". Fallback sisi server bila permintaan ditolak pengaman.
    const body = { model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] };
    if (/opus-5|sonnet-5-5|fable/.test(model)) { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
    const r = await fetchT('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) }, 180000);
    if (!r.ok) throw await readError(r);
    const j = await r.json();
    if (j.stop_reason === 'refusal') throw httpError(451, 'Permintaan ditolak oleh pengaman Claude');
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    if (!text) throw httpError(502, 'Jawaban kosong');
    return text;
  }
  let puterLoading = null;
  function loadPuter() {
    if (window.puter) return Promise.resolve(window.puter);
    if (!puterLoading) puterLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://js.puter.com/v2/';
      s.onload = () => res(window.puter); s.onerror = () => { puterLoading = null; rej(new Error('Gagal memuat Puter')); };
      document.head.appendChild(s);
    });
    return puterLoading;
  }
  async function callPuter(p, key, model, prompt) {
    const puter = await loadPuter();
    if (!puter.auth.isSignedIn()) { store.set('aiPuterUser', ''); const e = new Error('Akun Puter belum terhubung'); e.code = 'nokey'; throw e; }
    const r = await puter.ai.chat(prompt, model ? { model } : undefined);
    let text = typeof r === 'string' ? r : r && r.message && r.message.content;
    if (Array.isArray(text)) text = text.map((x) => x.text || '').join('');
    if (!text && r && r.toString) text = r.toString();
    if (!text) throw httpError(502, 'Jawaban kosong');
    return stripThink(text);
  }
  const CALL = { openai: callOpenAI, gemini: callGemini, claude: callClaude, puter: callPuter };

  // Daftar model dari penyedia (dipakai tombol "Muat daftar model" dan perbaikan otomatis)
  async function listModels(id) {
    const p = P[id], key = keyOf(id);
    if (p.type === 'gemini') {
      if (!key) throw Object.assign(new Error('API key belum diisi'), { code: 'nokey' });
      const r = await fetchT('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key), {}, 20000);
      if (!r.ok) throw await readError(r);
      const j = await r.json();
      return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, '')).filter((n) => /gemini/.test(n) && !/image|tts|embed|live|audio/.test(n));
    }
    if (p.type === 'claude' || p.type === 'puter' || !p.modelsUrl) return p.models.slice();
    const r = await fetchT(p.modelsUrl, { headers: key ? { Authorization: 'Bearer ' + key } : {} }, 20000);
    if (!r.ok) throw await readError(r);
    const j = await r.json();
    let ids = (j.data || j || []).map((m) => m.id || m.name).filter(Boolean)
      .filter((n) => !/whisper|embed|tts|guard|safeguard|moderation|image|vision-only|audio|transcribe|orpheus|dall-e|realtime|search/i.test(n));
    if (p.freeOnly) ids = ids.filter((n) => n.endsWith(':free'));
    return ids;
  }
  async function autoPickModel(id) {
    const list = await listModels(id);
    if (!list.length) return null;
    const p = P[id];
    return (p.prefer && list.find((m) => p.prefer.test(m))) || list[0];
  }

  async function callProvider(id, prompt) {
    const p = P[id];
    const key = keyOf(id);
    if (!p.noKey && p.type !== 'puter' && !key) { const e = new Error('API key belum diisi'); e.code = 'nokey'; throw e; }
    const model = modelOf(id);
    try {
      return await CALL[p.type](p, key, model, prompt);
    } catch (e) {
      // Model sudah tidak tersedia → pilih model lain yang ada, simpan, lalu ulangi sekali
      const modelGone = e.status === 404 || (e.status === 400 && /model/i.test(e.message) && /not|exist|found|invalid|decommission|support/i.test(e.message));
      if (modelGone && p.type !== 'claude' && p.type !== 'puter') {
        const alt = await autoPickModel(id).catch(() => null);
        if (alt && alt !== model) { setModel(id, alt); renderAll(); return CALL[p.type](p, key, alt, prompt); }
      }
      throw e;
    }
  }

  function friendlyError(id, e) {
    const n = P[id] ? P[id].name : id, s = e && e.status;
    if (e && e.code === 'nokey') return id === 'puter' ? `${n}: akun belum terhubung` : `${n}: API key belum diisi`;
    if (e && e.name === 'AbortError') return `${n} terlalu lama merespons`;
    if (e && e.code === 'badjson') return `${n}: jawaban AI tidak berformat benar`;
    if (s === 401 || s === 403 || (s === 400 && /api.?key|unauthori[sz]ed|permission/i.test((e && e.message) || ''))) return `${n}: API key salah atau tidak berlaku`;
    if (s === 402) return `${n}: saldo/kredit habis`;
    if (s === 429) return `${n}: kuota gratis sedang habis atau terlalu sering dipakai, coba lagi beberapa menit lagi`;
    if (s === 404) return `${n}: model tidak tersedia, coba "Muat daftar model" di Pengaturan`;
    if (s === 451) return `${n}: permintaan ditolak pengaman AI`;
    if (s >= 500) return `${n}: server sedang bermasalah`;
    // Sebagian penyedia tidak mengirim header CORS saat key ditolak, sehingga browser hanya melihat "gagal terhubung"
    if (e instanceof TypeError) return keyOf(id) ? `${n}: tidak bisa terhubung, kemungkinan besar API key salah (atau koneksi internet bermasalah)` : `Tidak bisa terhubung ke ${n} (cek koneksi internet)`;
    return `${n}: ${(e && e.message) || 'gagal'}`.slice(0, 200);
  }

  // Coba penyedia pilihan, lalu cadangan otomatis. validate() memeriksa/mengurai jawaban.
  async function generate(prompt, engine, opts = {}) {
    const order = [];
    if (engine && engine !== 'auto' && P[engine]) order.push(engine);
    AUTO_ORDER.forEach((id) => { if (!order.includes(id) && isReady(id)) order.push(id); });
    const notes = [];
    for (const id of order) {
      if (opts.onStatus) opts.onStatus(`Menulis dengan ${P[id].name}…`);
      try {
        const text = await callProvider(id, prompt);
        let data = text;
        if (opts.validate) { try { data = opts.validate(text); } catch { throw Object.assign(new Error('format'), { code: 'badjson' }); } }
        return { data, text, provider: id, providerName: P[id].name, notes };
      } catch (e) {
        notes.push(friendlyError(id, e));
      }
    }
    const err = new Error(notes.join('; ') || 'Belum ada mesin AI yang disetel');
    err.notes = notes.length ? notes : ['belum ada mesin AI yang disetel'];
    throw err;
  }

  async function testConnection(id) {
    const text = await callProvider(id, 'Balas hanya dengan JSON berikut tanpa teks lain: {"ok":true,"bahasa":"Indonesia"}');
    return text.slice(0, 80);
  }

  function detectProvider(key) {
    const k = (key || '').trim();
    if (!k) return null;
    for (const p of PROVIDERS) if ((p.prefix || []).some((x) => k.startsWith(x))) return p.id;
    if (/^sk-[a-f0-9]{32}$/.test(k)) return 'deepseek';
    if (k.startsWith('sk-')) return 'openai';
    if (/^[A-Za-z0-9]{32}$/.test(k)) return 'mistral';
    return null;
  }

  // ---------- UI: Pengaturan → Mesin AI ----------
  function cardHtml(p) {
    const ready = isReady(p.id);
    const badges = (p.recommended ? ['Direkomendasikan'] : []).concat(p.badges || [])
      .map((b) => `<span class="ai-badge${b === 'Direkomendasikan' ? ' rec' : ''}">${esc(b)}</span>`).join('');
    const steps = `<ol class="ai-steps">${p.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
    let body = steps;
    if (p.type === 'puter') {
      const user = store.get('aiPuterUser', '');
      body += user
        ? `<div class="row gap"><span class="ai-ok">✓ Terhubung sebagai <b>${esc(user)}</b></span><button type="button" class="ghost small" data-act="puter-out">Putuskan</button></div>`
        : `<div class="row gap"><button type="button" class="primary small" data-act="puter-in">Hubungkan akun Puter</button></div>`;
    } else if (!p.noKey) {
      body += `<div class="row gap"><a class="ghost small btn-like" href="${p.keyUrl}" target="_blank" rel="noopener">Buka halaman API key ↗</a></div>
        <label class="lbl" for="aiKey_${p.id}">API key ${esc(p.name)}</label>
        <div class="row"><input type="password" id="aiKey_${p.id}" data-key="${p.id}" value="${esc(keyOf(p.id))}" placeholder="Tempel API key di sini" autocomplete="off">
        <button type="button" class="ghost small" data-act="show" title="Tampilkan/sembunyikan">👁</button></div>`;
    }
    body += `<div class="row gap"><button type="button" class="secondary small" data-act="test">Tes koneksi</button><span class="ai-msg" id="aiMsg_${p.id}"></span></div>
      <details class="ai-adv"><summary>Lanjutan: pilih model</summary>
        <div class="row gap"><input type="text" list="aiList_${p.id}" data-model="${p.id}" value="${esc(modelOf(p.id))}" placeholder="${esc(p.model || 'model bawaan')}">
        ${p.type === 'claude' || p.type === 'puter' ? '' : '<button type="button" class="ghost small" data-act="models">Muat daftar model</button>'}</div>
        <datalist id="aiList_${p.id}">${p.models.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        <p class="hint">Biarkan bawaan bila ragu. Bila model tidak tersedia lagi, app memilih model lain secara otomatis.</p>
      </details>`;
    return `<details class="ai-card${ready ? ' ready' : ''}" data-id="${p.id}">
      <summary><span class="ai-name">${esc(p.name)}</span>${badges}<span class="ai-state">${ready ? '✓ Siap' : 'Belum disetel'}</span>
      <span class="ai-desc">${esc(p.desc)}</span></summary><div class="ai-body">${body}</div></details>`;
  }
  function renderBox() {
    const box = $('aiBox'); if (!box) return;
    const open = [...box.querySelectorAll('details.ai-card[open]')].map((d) => d.dataset.id);
    const readyCount = PROVIDERS.filter((p) => isReady(p.id) && !p.noKey).length;
    box.innerHTML = `<h3>Mesin AI</h3>
      <p class="hint">Cukup setel <b>satu</b> penyedia. Paling mudah: <b>Groq</b> (gratis, daftar ±2 menit) atau <b>Puter</b> (tanpa API key, cukup login).
      Bila satu penyedia gagal atau kuotanya habis, app otomatis mencoba penyedia lain yang sudah disetel.</p>
      <label class="lbl" for="aiPaste">Sudah punya API key? Tempel di sini, app akan mengenali penyedianya</label>
      <div class="row"><input id="aiPaste" type="password" placeholder="Tempel API key apa saja…" autocomplete="off"><button type="button" class="primary" id="aiPasteBtn">Simpan</button></div>
      <p class="hint" id="aiPasteMsg">${readyCount ? `${readyCount} penyedia ber-API key sudah siap.` : 'Belum ada API key tersimpan.'}</p>
      ${['A', 'B', 'C'].map((t) => `<div class="ai-tier"><div class="ai-tier-h">${TIERS[t]}</div>${PROVIDERS.filter((p) => p.tier === t).map(cardHtml).join('')}</div>`).join('')}`;
    open.forEach((id) => { const d = box.querySelector(`details.ai-card[data-id="${id}"]`); if (d) d.open = true; });
  }
  function renderEngine() {
    const sel = $('engine'); if (!sel) return;
    const cur = sel.value || store.get('engine', 'auto');
    sel.innerHTML = `<option value="auto">✦ Otomatis (terbaik yang tersedia)</option>` +
      PROVIDERS.map((p) => `<option value="${p.id}">${esc(p.name)}${isReady(p.id) ? '' : ' (perlu disetel)'}</option>`).join('') +
      `<option value="template">Template (tanpa AI)</option>`;
    sel.value = [...sel.options].some((o) => o.value === cur) ? cur : 'auto';
  }
  function renderAll() { renderBox(); renderEngine(); }

  function openSettings(id) {
    const dlg = $('dlg'); if (!dlg.open) dlg.showModal();
    const box = $('aiBox');
    const card = id && box.querySelector(`details.ai-card[data-id="${id}"]`);
    (card || box).scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (card) card.open = true;
  }
  function msg(id, text, ok) { const el = $('aiMsg_' + id); if (el) { el.textContent = text; el.className = 'ai-msg ' + (ok ? 'ok' : ok === false ? 'err' : ''); } }

  document.addEventListener('click', async (e) => {
    const opener = e.target.closest('[data-open-ai]');
    if (opener) { e.preventDefault(); openSettings(opener.dataset.openAi || ''); return; }
    const btn = e.target.closest('#aiBox [data-act], #aiPasteBtn'); if (!btn) return;
    if (btn.id === 'aiPasteBtn') {
      const v = $('aiPaste').value.trim(), out = $('aiPasteMsg');
      const id = detectProvider(v);
      if (!v) { out.textContent = 'Tempel API key dulu.'; return; }
      if (!id) { out.textContent = 'Penyedia tidak dikenali dari bentuk key. Buka kartu penyedianya di bawah lalu tempel di sana.'; return; }
      setKey(id, v); renderAll();
      $('aiPasteMsg').textContent = `Terdeteksi sebagai ${P[id].name}. Key tersimpan, sedang dites…`;
      openSettings(id);
      try { await testConnection(id); msg(id, '✓ Terhubung', true); $('aiPasteMsg').textContent = `✓ ${P[id].name} siap dipakai.`; }
      catch (err) { msg(id, friendlyError(id, err), false); $('aiPasteMsg').textContent = friendlyError(id, err); }
      return;
    }
    const card = btn.closest('.ai-card'), id = card.dataset.id, act = btn.dataset.act;
    if (act === 'show') { const i = card.querySelector('[data-key]'); i.type = i.type === 'password' ? 'text' : 'password'; return; }
    if (act === 'test') {
      btn.disabled = true; msg(id, 'Mengetes…');
      try { await testConnection(id); msg(id, '✓ Terhubung, siap dipakai', true); }
      catch (err) { msg(id, friendlyError(id, err), false); }
      finally { btn.disabled = false; }
      return;
    }
    if (act === 'models') {
      btn.disabled = true; msg(id, 'Memuat daftar model…');
      try {
        const list = await listModels(id);
        $('aiList_' + id).innerHTML = list.map((m) => `<option value="${esc(m)}">`).join('');
        msg(id, `${list.length} model tersedia. Klik kolom model untuk memilih.`, true);
      } catch (err) { msg(id, friendlyError(id, err), false); }
      finally { btn.disabled = false; }
      return;
    }
    if (act === 'puter-in') {
      btn.disabled = true; msg(id, 'Membuka jendela login Puter…');
      try {
        const puter = await loadPuter();
        if (!puter.auth.isSignedIn()) await puter.auth.signIn();
        const u = await puter.auth.getUser();
        store.set('aiPuterUser', (u && (u.username || u.email)) || 'akun Puter');
        renderAll(); openSettings(id); msg(id, '✓ Terhubung', true);
      } catch (err) { btn.disabled = false; msg(id, 'Login Puter dibatalkan atau gagal. Pastikan pop-up tidak diblokir.', false); }
      return;
    }
    if (act === 'puter-out') {
      try { (await loadPuter()).auth.signOut(); } catch {}
      store.set('aiPuterUser', ''); renderAll(); openSettings(id);
    }
  });
  // Simpan key/model saat diketik
  document.addEventListener('change', (e) => {
    const k = e.target.closest('#aiBox [data-key]');
    if (k) {
      const id = k.dataset.key, v = k.value.trim();
      const other = detectProvider(v);
      setKey(id, v); renderEngine();
      const card = k.closest('.ai-card'); card.classList.toggle('ready', isReady(id));
      card.querySelector('.ai-state').textContent = isReady(id) ? '✓ Siap' : 'Belum disetel';
      if (other && other !== id) msg(id, `Key ini sepertinya milik ${P[other].name}, bukan ${P[id].name}.`, false);
      else if (v) msg(id, 'Tersimpan. Klik "Tes koneksi" untuk memastikan.');
      return;
    }
    const m = e.target.closest('#aiBox [data-model]');
    if (m) { setModel(m.dataset.model, m.value); return; }
    if (e.target.id === 'engine') {
      const v = e.target.value;
      if (P[v] && !isReady(v)) openSettings(v);
    }
  });

  window.BKAI = { PROVIDERS, generate, testConnection, detectProvider, friendlyError, openSettings, isReady, render: renderAll, anyReady: () => PROVIDERS.some((p) => !p.noKey && isReady(p.id)) };
  renderAll();
})();
