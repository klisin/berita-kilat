# Berita Kilat

Ubah **link berita, kata kunci, teks berita, atau video (YouTube/unggahan)** menjadi **gambar judul siap posting** (4:5, 1:1, 9:16), **caption jurnalistik 5W+1H gaya Kompas**, **Video Short** 9:16, dan **artikel WordPress**. Semua berjalan di browser, cocok untuk GitHub Pages.

## Cara pasang di GitHub Pages

1. Buat repo baru di GitHub, misalnya `berita-kilat` (Public).
2. Klik **Add file → Upload files**, unggah semua isi folder ini (`index.html`, `style.css`, `.nojekyll`, `README.md`, semua file `.js` — `ai.js`, `app.js`, `research.js`, `videoin.js`, `footage.js`, `wp.js`, `video.js`, `share.js` — dan folder `wp-plugin`), lalu **Commit**.
3. Buka **Settings → Pages**. Pada *Source* pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu 1–2 menit. App aktif di `https://USERNAME.github.io/berita-kilat/`.

## Pemakaian

1. Buka **⚙ Pengaturan** (sekali saja): isi nama media, handle, warna, dan logo, lalu setel **Mesin AI** (lihat bagian di bawah).
2. Pilih sumber berita di tab paling atas, lalu proses:
   - **🔗 Link / kata kunci**: tempel link berita atau ketik kata kunci → **Proses** (lihat *Mode kata kunci*).
   - **📝 Teks berita**: tempel teks → **Proses teks**.
   - **🎬 Video**: link YouTube atau unggah video → **Analisis video**.
   - **Mengatur media Anda** (bagian *Identitas media*): pilih tampilan di pojok kiri atas gambar:
     - **Teks nama**: isi *Nama media*. Gambar menampilkan ikon huruf awal dan nama media.
     - **Logo**: klik *Unggah logo*. PNG transparan paling rapi. Atur besarnya lewat slider *Ukuran logo*.
     - **Logo + nama**: logo dan teks nama media tampil berdampingan.
     - Hasilnya langsung terlihat di kotak *Pratinjau*. Klik *Hapus logo* untuk kembali ke teks nama.
   - **Efek logo** (agar logo terbaca di atas foto terang/gelap): bayangan gelap, cahaya putih (glow), garis tepi putih, plat putih/gelap di belakang logo, atau jadikan putih (mono). Atur juga *Kekuatan efek*, *Kontras*, dan *Kecerahan*. Tepi transparan logo dipangkas otomatis.
   - **Preset akun media**: setelah identitas diatur, klik *Simpan sebagai preset baru* (mis. "Kalawaca.com", "Akun pribadi"). Berpindah akun cukup lewat menu pilihan di pojok kanan atas atau di Pengaturan. *Perbarui preset terpilih* menyimpan perubahan; *Ekspor*/*Impor* memindahkan preset ke browser/perangkat lain. API key tidak ikut preset.
3. Sunting judul/label bila perlu, atur posisi foto, lalu **Unduh PNG** dan **Salin caption**.

### Mode kata kunci (riset berita terkini)

Selain link, kolom input menerima **kata kunci**, mis. `3 handphone terbaik saat ini`. App lalu:

1. Mencari berita Indonesia terbaru di **Google Berita** dan **Bing Berita** sekaligus (rentang 7 hari / 30 hari / 1 tahun; bila salah satu sedang diblokir, yang lain tetap dipakai), mengurutkan menurut kecocokan judul dengan kata kunci, lalu menampilkan panel **Sumber ditemukan**. Sumber relevan teratas tercentang otomatis (3/4/6 sumber), dan Anda bisa mengubah centang lalu klik **Rangkum ulang**.
2. Membaca isi tiap berita (lewat r.jina.ai), lalu **Mesin AI merangkum hanya dari isi berita tersebut**. Bila kata kunci menyebut jumlah ("3 …"), hasilnya tepat sebanyak itu, lengkap dengan keunggulan/angka dari sumber dan baris **Sumber: media A, media B**.
3. Mengisi gambar, caption (daftar bernomor), naskah video (satu poin per item), footage per item (foto dicari berdasarkan nama item), dan artikel WordPress dengan referensi ke semua sumber.

Mode ini butuh Mesin AI. Tanpa AI, app memakai sumber teratas saja seperti mode link. Pencarian dan pembacaan memakai r.jina.ai; saat ramai, Jina kadang membatasi akses tanpa key. Isi **Jina API key** gratis di **⚙ Pengaturan → Pencarian & pembaca berita** agar lebih stabil. Pintasan: `…/berita-kilat/?q=kata+kunci`. Selalu periksa fakta (harga/spesifikasi bisa berbeda antarmedia).

### Mode 📝 Teks berita

Tempel teks berita, siaran pers, atau catatan liputan. Baris pertama yang pendek dipakai sebagai judul, sisanya sebagai isi. Foto dipilih dari galeri atau diunggah.

### Mode 🎬 Video (YouTube atau video sendiri)

Tempel **link YouTube publik** atau **unggah video** (rekaman liputan, wawancara, konferensi pers), lalu klik **Analisis video**. **Google Gemini** menonton videonya dan menyusun bahan berita (isi faktual + kutipan langsung). Setelah itu, gambar, caption 5W+1H, naskah video, dan artikel WordPress dibuat seperti biasa dengan Mesin AI pilihan Anda.

- Butuh **API key Google Gemini** (gratis) di ⚙ Pengaturan → Mesin AI, karena hanya Gemini yang bisa menganalisis video.
- **YouTube:** foto utama memakai thumbnail video. Cuplikan YouTube tidak dipakai sebagai footage, karena tidak bisa diunduh dari browser dan melanggar ketentuan YouTube.
- **Video sendiri** (maks. ±1 GB): frame terbaik menurut Gemini menjadi foto utama. Bila **Pakai video ini sebagai latar Video Short** dicentang, video diputar bersambung di semua adegan. Atur detik mulainya dan centang **Pakai suara asli video** di kartu Video Short; bila ada musik, volume musik diturunkan otomatis. Adegan tertentu tetap bisa diganti lewat *Tukar*.
- Periksa kembali nama, jabatan, dan angka hasil analisis sebelum diunggah.

### Mesin AI (caption & naskah video)

Cukup setel **satu** penyedia di **⚙ Pengaturan → Mesin AI**. Setiap penyedia punya panduan langkah demi langkah, tombol **Buka halaman API key**, dan **Tes koneksi**. Bisa juga langsung menempel API key di kotak paling atas: app mengenali penyedianya dari bentuk key.

| Tingkat | Penyedia | Keterangan |
|---|---|---|
| Tanpa API key | **Puter** | Klik *Hubungkan akun Puter*, login sekali (gratis, kuota per akun terbatas) |
| Gratis dengan API key | **Groq** (direkomendasikan), Google Gemini, OpenRouter (model `:free`), Cerebras, Mistral (paket Experiment), Hugging Face, Pollinations | Daftar ±2 menit, tanpa kartu kredit |
| Berbayar | Claude, OpenAI, DeepSeek | Kualitas tertinggi, perlu saldo |

- Pilihan **✦ Otomatis** di kartu Caption memakai penyedia terbaik yang sudah disetel. Bila gagal (key salah, kuota habis, server sibuk), app otomatis mencoba penyedia lain, dan terakhir mode template. Pesan status menyebut penyedia yang dipakai dan alasan bila ada yang gagal.
- Bila model bawaan sudah tidak tersedia, app memilih model lain secara otomatis. Model bisa diganti di *Lanjutan: pilih model* → *Muat daftar model*.
- Puter dimuat dari `js.puter.com` hanya bila dipakai. Puter dan penyedia lain adalah layanan pihak ketiga; isi artikel dikirim ke penyedia yang Anda pilih.

### Video Short (TikTok, Reels, YouTube Shorts)

Setelah berita diproses (mode apa pun), kartu **Video Short** di bawah otomatis terisi naskah (dibuat bersamaan dengan caption, tanpa panggilan AI tambahan):

- **Hook** pembuka → **poin penjelasan** berupa kalimat lengkap (pola SPOK, tanpa label) → **penutup** berisi logo, ajakan, handle, dan sumber. AI menyiapkan 6 poin, diurutkan dari yang terpenting.
- Foto berita bergerak pelan (efek zoom), teks muncul beranimasi, ada bar progres ala story. Teks diletakkan di area aman agar tidak tertutup tombol TikTok/Reels.
- Pilih **Gaya** tampilan: **Klasik** (gradasi + kotak gelap), **Panel bawah** (foto di atas, panel warna media di bawah), **Bingkai** (bingkai warna aksen + panel), atau **Teks sorot** (kalimat berblok warna ala caption TikTok/Reels). Atur juga **Ukuran teks** (bawaan lebih kecil) bila kalimat terasa terlalu besar atau kecil. Pilihan gaya dan ukuran diingat untuk video berikutnya.
- Pilih durasi **15 / 30 / 60 detik**. Durasi 15 detik menampilkan ±3 poin, 30–60 detik hingga 6 poin; lama tampil tiap poin menyesuaikan panjang kalimatnya. Klik **▶ Putar pratinjau**, lalu **⬇ Render & unduh video**: hasilnya **MP4 1080×1920** (15 dtk ±5 MB, 60 dtk ±20–25 MB), dirender langsung di browser (60 detik butuh ±40 detik).
- **Musik latar opsional**: unggah MP3/M4A/WAV, atur volume dan titik mulai; musik dipotong (atau diulang bila lebih pendek dari video) dan diberi fade-out otomatis. Tanpa musik, video bisu, dan Anda bisa menambahkan sound trending di aplikasi (disarankan untuk jangkauan).
- Paling baik di **Chrome atau Edge** terbaru. Di browser lain, app memakai mode cadangan (perekaman real-time, bisa menghasilkan WebM).

#### Footage per adegan

Setiap adegan video (hook, poin 1–6, penutup) bisa memakai foto atau klip berbeda, dengan transisi crossfade:

- **Otomatis:** setelah naskah dibuat, AI menyiapkan kata kunci foto per adegan, lalu app mencari dari **foto lain di artikel**, **Wikimedia Commons**, dan **Openverse** (tanpa key). Hook dan penutup memakai foto utama berita.
- **Pixabay (opsional, gratis):** isi API key di **⚙ Pengaturan → Sumber footage video** untuk foto stok berkualitas dan **klip video**. Daftar/masuk di pixabay.com, lalu buka https://pixabay.com/api/docs/ — key tertulis di bagian *Parameters → key*. Centang *Utamakan klip video* agar adegan poin memakai klip bergerak.
- **Pexels:** pendaftaran key baru sedang ditutup oleh Pexels; key lama tetap bisa diisi di bagian *Pexels* pada pengaturan yang sama.
- **Tukar:** klik *Tukar* pada adegan untuk melihat galeri hasil pencarian, cari dengan kata kunci sendiri, atau **⬆ unggah** foto/klip milik Anda. Tombol ↺ kembali ke foto utama.
- **Kredit & lisensi:** foto Wikimedia/Openverse umumnya berlisensi Creative Commons (wajib mencantumkan kredit). Sumber foto otomatis ditulis di layar penutup, dan tombol **Salin kredit foto** menyalin daftar lengkap untuk ditempel di caption. Foto dari artikel adalah milik media asal; gunakan sesuai kebijakan redaksi Anda.

### Posting ke WordPress (mis. kalawaca.com)

1. **Pasang plugin penghubung Yoast** (sekali saja): unduh [`wp-plugin/berita-kilat-connector.zip`](wp-plugin/berita-kilat-connector.zip), lalu di WordPress buka **Plugin → Tambah Baru → Unggah Plugin** → pilih zip → **Pasang** → **Aktifkan**. Plugin ini membuka kolom Yoast (focus keyphrase, judul SEO, meta description, kategori utama) untuk REST API, khusus pengguna yang boleh mengedit pos. Versi **1.1** juga menyediakan jalur login cadangan untuk hosting yang membuang header login (umum di LiteSpeed/Hostinger, termasuk kalawaca.com); app beralih ke jalur ini otomatis saat **Tes koneksi**. Bila sudah memasang versi lama, unggah ulang zip terbaru (WordPress akan menawarkan *Ganti versi saat ini*).
2. **Hubungkan website:** **⚙ Pengaturan → Website WordPress** → isi alamat (mis. `kalawaca.com`) → **Hubungkan** → login WordPress → klik **Yes, I approve of this connection**. App kembali otomatis dan menampilkan "✓ Terhubung". Bila app dibuka dari file lokal, gunakan *Cara manual* (Application Password dari **Pengguna → Profil**).
3. **Tulis & kirim:** setelah link berita diproses, di kartu **Posting ke WordPress** klik **✦ Tulis artikel dengan AI**. AI menulis ulang berita dengan gaya Kompas (piramida terbalik, 5W+1H, atribusi jelas, tanpa menambah fakta), memilih **kategori yang ada di situs**, membuat **tag**, **slug**, **ringkasan**, dan data **Yoast**. App menambahkan **Baca juga** (pos terkait di situs Anda) dan paragraf **referensi** ke berita sumber.
4. Periksa dan sunting bila perlu, pilih **Draf** (bawaan) / **Terbitkan** / **Jadwalkan**, lalu **Kirim ke WordPress**. Gambar unggulan dibuat otomatis 1200×675, lengkap dengan alt dan kredit; sumbernya bisa dipilih: **Foto kartu Gambar**, **🔍 Pilih foto lain** (galeri artikel/Wikimedia/Openverse/Pixabay), atau **⬆ Unggah**. Bila firewall hosting memblokir unggahan, app mencoba ukuran lebih kecil lalu menawarkan **Kirim tanpa gambar unggulan**. Kirim ulang akan **memperbarui** pos yang sama, bukan membuat pos ganda.

Catatan: Application Password tersimpan hanya di browser ini dan bisa dicabut kapan saja di WordPress (**Pengguna → Profil → Application Passwords**). Setiap preset akun media bisa terhubung ke website yang berbeda. Selalu periksa fakta sebelum menerbitkan.

### Bagikan ke media sosial

Tombol **📤 Bagikan** ada di kartu Gambar, Caption, Video, dan setelah artikel terkirim ke WordPress. Dialog Bagikan berisi:

- **📱 Bagikan via aplikasi…**: membuka daftar aplikasi di perangkat (Instagram, TikTok, WhatsApp, Facebook, X, dll.) **lengkap dengan file gambar/video dan caption**. Paling praktis di HP (Chrome Android / Safari iPhone) dan Chrome/Edge di Windows.
- **Unggah ke platform** (Instagram, TikTok, YouTube Shorts, Facebook): satu klik menyalin caption, mengunduh file, dan membuka halaman unggah resmi; tinggal pilih file dan tempel caption.
- **Kirim teks + link** lewat WhatsApp, Telegram, X (otomatis dipangkas ≤ 280 karakter), Threads, Facebook, LinkedIn, atau Email. Link bawaan: pos WordPress yang sudah terbit, atau link berita sumber (bisa diganti).
- Video yang belum dirender bisa langsung dirender dari dialog. Tidak ada posting otomatis tanpa persetujuan Anda; semua pengiriman dilakukan dari akun Anda sendiri.

Pintasan: `https://USERNAME.github.io/berita-kilat/?url=LINK_BERITA` langsung memproses link.

## Catatan

- API key dan pengaturan tersimpan di browser Anda sendiri (localStorage), tidak di repo. Gunakan app di perangkat pribadi; di komputer bersama, hapus data situs setelah selesai.
- **Keamanan:** halaman memakai Content-Security-Policy (hanya skrip dari app sendiri, jsDelivr, dan Puter yang boleh berjalan) dan skrip mp4-muxer dikunci dengan Subresource Integrity. Semua teks dari luar (artikel, AI, hasil pencarian, WordPress) di-escape atau disaring sebelum ditampilkan. Koneksi WordPress hanya diterima dari tombol **Hubungkan** di browser ini (tautan pihak lain diabaikan) dan wajib https.
- Artikel diambil lewat proxy CORS publik (allorigins, corsproxy.io, codetabs) dengan cadangan r.jina.ai. Bila situs memblokir, salin isi beritanya lalu pakai mode **📝 Teks berita**, atau buka bagian **Bahan artikel**, tempel judul & isi, lalu klik **Pakai bahan ini**.
- Foto gambar punya tiga pilihan: **Otomatis** (dari link), **🔍 Pilih foto lain** (galeri berisi foto lain di artikel, Wikimedia Commons, Openverse, dan Pixabay/Pexels bila ada key; bisa cari dengan kata kunci sendiri; kredit foto otomatis masuk ke *Keterangan sumber*), dan **⬆ Unggah**. Foto yang dipilih juga dipakai di Hook & Penutup video.
- Foto otomatis diambil dari link berita (mode video: thumbnail YouTube atau cuplikan video Anda; mode teks: dipilih dari galeri). Bila sumber tidak punya foto atau foto gagal diambil, kotak **Unggah foto manual** muncul di bawah gambar.
- Perhatikan hak cipta foto: cantumkan sumber (sudah otomatis di bagian bawah gambar) dan, untuk pemakaian rutin, sebaiknya gunakan foto milik sendiri atau berlisensi.
- AI bisa keliru. Periksa fakta, nama, dan angka sebelum mengunggah.
