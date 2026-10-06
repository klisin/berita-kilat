# Berita Kilat

Ubah link berita menjadi **gambar judul siap posting** (4:5, 1:1, 9:16) dan **caption jurnalistik 5W+1H gaya Kompas**. Semua berjalan di browser, cocok untuk GitHub Pages.

## Cara pasang di GitHub Pages

1. Buat repo baru di GitHub, misalnya `berita-kilat` (Public).
2. Klik **Add file → Upload files**, unggah semua isi folder ini (`index.html`, `app.js`, `style.css`, `.nojekyll`, `README.md`), lalu **Commit**.
3. Buka **Settings → Pages**. Pada *Source* pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1–2 menit. App aktif di `https://USERNAME.github.io/berita-kilat/`.

## Pemakaian

1. Buka **⚙ Pengaturan** (sekali saja): isi nama media, handle, warna, logo, dan API key.
   - Gemini: gratis di https://aistudio.google.com/apikey
   - Claude: https://console.anthropic.com/settings/keys
2. Tempel link berita → **Proses**.
   - **Mengatur media Anda** (bagian *Identitas media*): pilih tampilan di pojok kiri atas gambar:
     - **Teks nama**: isi *Nama media*. Gambar menampilkan ikon huruf awal dan nama media.
     - **Logo**: klik *Unggah logo*. PNG transparan paling rapi. Atur besarnya lewat slider *Ukuran logo*.
     - **Logo + nama**: logo dan teks nama media tampil berdampingan.
     - Hasilnya langsung terlihat di kotak *Pratinjau*. Klik *Hapus logo* untuk kembali ke teks nama.
   - **Efek logo** (agar logo terbaca di atas foto terang/gelap): bayangan gelap, cahaya putih (glow), garis tepi putih, plat putih/gelap di belakang logo, atau jadikan putih (mono). Atur juga *Kekuatan efek*, *Kontras*, dan *Kecerahan*. Tepi transparan logo dipangkas otomatis.
   - **Preset akun media**: setelah identitas diatur, klik *Simpan sebagai preset baru* (mis. "Kalawaca.com", "Akun pribadi"). Berpindah akun cukup lewat menu pilihan di pojok kanan atas atau di Pengaturan. *Perbarui preset terpilih* menyimpan perubahan; *Ekspor*/*Impor* memindahkan preset ke browser/perangkat lain. API key tidak ikut preset.
3. Sunting judul/label bila perlu, atur posisi foto, lalu **Unduh PNG** dan **Salin caption**.

Pintasan: `https://USERNAME.github.io/berita-kilat/?url=LINK_BERITA` langsung memproses link.

## Catatan

- API key dan pengaturan tersimpan di browser Anda sendiri (localStorage), tidak di repo.
- Artikel diambil lewat proxy CORS publik (allorigins, corsproxy.io, codetabs) dengan cadangan r.jina.ai. Bila situs memblokir, buka bagian **Bahan artikel**, tempel judul & isi, lalu klik **Pakai bahan ini**.
- Foto otomatis diambil dari link berita. Bila sumber tidak punya foto atau foto gagal diambil, kotak **Unggah foto manual** muncul di bawah gambar. Jika foto otomatis kurang cocok, klik **Foto kurang cocok? Unggah sendiri**.
- Perhatikan hak cipta foto: cantumkan sumber (sudah otomatis di bagian bawah gambar) dan, untuk pemakaian rutin, sebaiknya gunakan foto milik sendiri atau berlisensi.
- AI bisa keliru. Periksa fakta, nama, dan angka sebelum mengunggah.
