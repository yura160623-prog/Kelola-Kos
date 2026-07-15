# KelolaKos — Aplikasi Manajemen Kos (PWA mobile-first)

KelolaKos adalah aplikasi web **PWA mobile-first** untuk manajemen kos (boarding house):
pengelolaan kamar, penghuni, dan pencatatan pembayaran/sewa bulanan. Aplikasi ini dirancang
untuk satu pemilik (single-owner) dan berjalan sepenuhnya di lokal tanpa layanan pihak ketiga.

---

## Daftar Isi

- [Tentang / Fitur](#tentang--fitur)
- [Teknologi](#teknologi)
- [Prasyarat](#prasyarat)
- [Instalasi & Menjalankan](#instalasi--menjalankan)
- [Konfigurasi (.env)](#konfigurasi-env)
- [Penggunaan (Alur Pengguna)](#penggunaan-alur-pengguna)
- [Arsitektur](#arsitektur)
- [Referensi API](#referensi-api)
- [Struktur Direktori](#struktur-direktori)
- [Keamanan](#keamanan-catatan)
- [Catatan / Keterbatasan (MVP)](#catatan--keterbatasan-mvp)
- [Lisensi](#lisensi)

---

## Tentang / Fitur

- **Dashboard ringkasan** — total kamar (tersedia/terisi/maintenance), penghuni aktif,
  pemasukan bulan berjalan, tunggakan, daftar jatuh tempo, dan tren pemasukan 6 bulan.
- **Manajemen kamar** — tipe `single` / `shared`, harga sewa, dan status
  `available` / `occupied` / `maintenance`, lengkap dengan catatan.
- **Manajemen penghuni** — status `active` / `moved_out`, nomor identitas, telepon,
  dan penempatan ke kamar.
- **Pencatatan & generate tagihan bulanan otomatis** — buat tagihan per periode
  (bulan + tahun) untuk setiap penghuni aktif sekaligus.
- **Status pembayaran** — `unpaid` / `paid` / `late` dengan metode `cash` / `transfer` / `e-wallet`.
- **PWA (install di HP, offline-lite)** — dapat dipasang ke layar utama lewat `manifest.json`
  dan `sw.js`.
- **Single-owner** — satu akun pemilik; registrasi tertutup setelah akun pertama dibuat.
- **Data lokal (SQLite)** — database disimpan di file lokal, tanpa server database terpisah.

---

## Teknologi

- **Node.js + Express 4** (ES modules, `"type": "module"`).
- **`node:sqlite` (DatabaseSync)** — modul SQLite bawaan Node, tanpa kompilasi native.
- **Alpine.js 3** (di-vendor ke `public/js/vendor/alpine.min.js`) + vanilla JS.
- **JWT di httpOnly cookie** (`kk_token`) — `bcryptjs` + `jsonwebtoken`.
- **PWA** — `manifest.json` + `sw.js` (offline-lite).

---

## Prasyarat

- **Node.js >= 22.5.0** (diperlukan karena `node:sqlite` `DatabaseSync`).
- **npm** (disertakan bersama Node.js).

Cek versi Node Anda:

```bash
node -v
```

> **Catatan flag `--experimental-sqlite`**: `DatabaseSync` masih eksperimental pada
> Node **22.5.0 – 22.9.x** dan butuh flag `--experimental-sqlite`. Pada Node **22.10.0+**
> (serta 23/24) modul sudah stabil dan **tidak perlu flag** — skrip `npm start` memang
> menjalankan `node --no-warnings` tanpa flag apa pun. Pastikan Anda menggunakan Node
> 22.10 ke atas agar tidak perlu menambahkan flag manual.

---

## Instalasi & Menjalankan

```bash
# 1. Masuk ke folder proyek (hasil git clone atau ekstrak)
cd KelolaKos

# 2. Instal dependensi
npm install

# 3. Salin contoh environment, lalu isi JWT_SECRET (wajib di production)
cp .env.example .env

# 4. Jalankan
npm start        # produksi (node --no-warnings server.js)
# atau
npm run dev      # development dengan watch (node --no-warnings --watch server.js)

# 5. Buka di browser / HP
#    http://localhost:3000   (atau sesuai PORT)
```

Database (`data/kelolakos.db`) akan otomatis dibuat dan dimigrasi saat aplikasi boot.

---

## Konfigurasi (.env)

Salin `.env.example` menjadi `.env`. Variabel yang tersedia:

| Variabel          | Wajib?        | Default                       | Keterangan                                                                 |
| ----------------- | ------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `PORT`            | Tidak         | `3000`                        | Port tempat server mendengarkan.                                           |
| `NODE_ENV`        | Tidak         | `development`                 | Atur `production` untuk mengaktifkan cookie `secure`.                      |
| `JWT_SECRET`      | **Wajib (prod)** | `insecure-dev-secret`     | Kunci penandatanganan JWT. App akan *throw* saat boot jika kosong di production. |
| `JWT_EXPIRES_IN`  | Tidak         | `7d`                          | Masa berlaku token (format `jsonwebtoken`, mis. `7d`, `12h`).              |
| `DB_PATH`         | Tidak         | `./data/kelolakos.db`         | Lokasi file database (relatif ke root proyek). Direktori dibuat otomatis.  |
| `FONNTE_TOKEN`    | Tidak (opsional) | _kosong_                   | Token API WhatsApp FONNTE (fase 1.5, belum digunakan kode saat ini).      |

Contoh `.env`:

```env
PORT=3000
NODE_ENV=development

JWT_SECRET=ganti-dengan-string-acak-yang-panjang
JWT_EXPIRES_IN=7d

DB_PATH=./data/kelolakos.db

# FONNTE_TOKEN=token-fonnte-anda
```

---

## Penggunaan (Alur Pengguna)

1. **Daftar pemilik (hanya 1x)** — Pada layar login, tombol **Daftar** tersedia hanya
   jika `GET /api/auth/registration-open` mengembalikan `open: true`. Setelah akun pemilik
   pertama terdaftar, registrasi tertutup (respons `403`).
2. **Login** — Masuk dengan `username` dan `password` yang dibuat saat registrasi.
   Token JWT disimpan otomatis di cookie `kk_token`.
3. **Tambah kamar** — lewat menu **Kamar**, buat kamar dengan nomor, tipe, harga, dan status.
4. **Tambah penghuni** — lewat menu **Penghuni**, tambahkan penghuni dan tempatkan ke kamar.
   Status kamar akan otomatis berubah menjadi `occupied` bila ada penghuni aktif.
5. **Generate tagihan** — lewat menu **Bayar**, panggil generate untuk membuat tagihan
   bulan berjalan bagi semua penghuni aktif.
6. **Lunasi** — tandai tagihan sebagai `paid` (shortcut lunasi) atau edit detailnya.

Navigasi bawah (bottom-nav) terdiri dari: **Beranda / Kamar / Penghuni / Bayar**.

---

## Arsitektur

```
server.js
  ├─ migrate()            → buat skema SQLite (idempoten) saat boot
  ├─ /api/health          → health check
  ├─ /api/auth/*          → routes/auth.js
  ├─ /api/rooms/*         → routes/rooms.js
  ├─ /api/tenants/*       → routes/tenants.js
  ├─ /api/payments/*      → routes/payments.js
  ├─ /api/dashboard/*     → routes/dashboard.js
  ├─ public/ (static)    → frontend PWA (Alpine.js)
  └─ SPA fallback         → GET /* (bukan /api/*) → public/index.html
```

- Folder `src/` berisi `db.js` (inisialisasi `DatabaseSync`, `PRAGMA journal_mode=WAL`,
  `foreign_keys=ON`), `auth.js` (bcrypt, JWT, cookie, `requireAuth`), dan `routes/`.
- Penyimpanan ada di `data/` (di-gitignore). Semua tabel dibuat otomatis oleh `migrate()`.
- `syncRoomStatus` (di `src/routes/tenants.js`) — saat penghuni dibuat/diubah/dihapus,
  status kamar otomatis disesuaikan (`occupied`/`available`) berdasarkan jumlah penghuni
  aktif. Khusus status `maintenance` **tidak** ditimpa otomatis.

---

## Referensi API

Semua endpoint di bawah dilindungi middleware `requireAuth`, **kecuali** auth dan health.
Kirim token lewat cookie `kk_token` atau header `Authorization: Bearer <token>`.
Jika tidak valid, respons berupa `401`.

### `GET /api/health`

Cek status layanan.

```json
{ "ok": true, "service": "kelolakos" }
```

### Auth — `src/routes/auth.js`

| Metode | Path                              | Keterangan                                                        |
| ------ | --------------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/auth/registration-open`     | Cek apakah registrasi masih terbuka (`{ "open": true/false }`).   |
| POST   | `/api/auth/register`              | Daftar pemilik (hanya 1x; `403` bila sudah ada owner).            |
| POST   | `/api/auth/login`                 | Login dengan `username` + `password`.                             |
| POST   | `/api/auth/logout`                | Hapus cookie auth.                                                |
| GET    | `/api/auth/me`                    | Profil pemilik yang sedang login (butuh auth).                    |

**`POST /api/auth/register`** — body:

```json
{
  "name": "Budi Santoso",
  "username": "budi",
  "password": "rahasia123",
  "phone": "08123456789"
}
```

- Wajib: `name`, `username`, `password`. `password` minimal 6 karakter.
- `409` bila `username` sudah dipakai; `403` bila akun pemilik sudah ada.

**`POST /api/auth/login`** — body:

```json
{ "username": "budi", "password": "rahasia123" }
```

- `401` bila `username`/`password` salah.

### Rooms — `src/routes/rooms.js`

Semua butuh auth.

| Metode | Path                | Keterangan                                                       |
| ------ | ------------------- | ---------------------------------------------------------------- |
| GET    | `/api/rooms`        | List kamar. Query: `?status=&q=` (cari `room_number`/`notes`).   |
| GET    | `/api/rooms/:id`    | Detail kamar + daftar penghuni.                                  |
| POST   | `/api/rooms`        | Buat kamar.                                                      |
| PUT    | `/api/rooms/:id`    | Update kamar.                                                    |
| DELETE | `/api/rooms/:id`    | Hapus kamar. `409` bila masih ada penghuni aktif.                |

**`POST /api/rooms`** — body:

```json
{
  "room_number": "A-101",
  "type": "single",
  "price": 1200000,
  "status": "available",
  "notes": "Kamar depan, sejuk"
}
```

- Wajib: `room_number`.
- Opsional: `type` (`single`/`shared`, default `single`), `price` (default `0`),
  `status` (`available`/`occupied`/`maintenance`, default `available`), `notes`.
- Enum tidak valid → `400`.

### Tenants — `src/routes/tenants.js`

Semua butuh auth. Setiap perubahan memanggil `syncRoomStatus` secara otomatis.

| Metode | Path                  | Keterangan                                                            |
| ------ | --------------------- | --------------------------------------------------------------------- |
| GET    | `/api/tenants`        | List penghuni. Query: `?status=&room_id=&q=` (`name`/`phone`).        |
| GET    | `/api/tenants/:id`    | Detail penghuni + riwayat pembayaran.                                 |
| POST   | `/api/tenants`        | Buat penghuni.                                                        |
| PUT    | `/api/tenants/:id`    | Update penghuni (termasuk pindah kamar).                             |
| DELETE | `/api/tenants/:id`    | Hapus penghuni (note: riwayat pembayarannya ikut terhapus — CASCADE). |

**`POST /api/tenants`** — body:

```json
{
  "name": "Siti Aminah",
  "room_id": 1,
  "phone": "08567890123",
  "identity_number": "3201xxxx",
  "start_date": "2026-07-01",
  "status": "active",
  "notes": "Mahasiswa"
}
```

- Wajib: `name`.
- Opsional: `room_id` (harus kamar yang ada), `phone`, `identity_number`, `start_date`,
  `status` (`active`/`moved_out`, default `active`), `notes`.
- `status` tidak valid → `400`.

### Payments — `src/routes/payments.js`

Semua butuh auth. Kolom uang (`amount`, `price`) berupa **integer Rupiah** (tanpa desimal).

| Metode | Path                       | Keterangan                                                            |
| ------ | -------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/payments`            | List pembayaran. Query: `?month=&year=&status=&tenant_id=&room_id=`.   |
| POST   | `/api/payments`            | Buat satu tagihan.                                                    |
| POST   | `/api/payments/generate`   | Generate massal tagihan penghuni aktif (transaksional).               |
| PUT    | `/api/payments/:id`        | Update pembayaran.                                                    |
| POST   | `/api/payments/:id/pay`    | Shortcut lunasi (status → `paid`).                                    |
| DELETE | `/api/payments/:id`        | Hapus pembayaran.                                                      |

**`POST /api/payments`** — body:

```json
{
  "tenant_id": 1,
  "period_month": 7,
  "period_year": 2026,
  "amount": 1200000,
  "paid_date": "2026-07-10",
  "payment_method": "transfer",
  "status": "paid",
  "notes": "Bayar tepat waktu"
}
```

- Wajib: `tenant_id`, `period_month`, `period_year`.
- Opsional: `amount` (default = harga kamar), `paid_date`, `payment_method`
  (`cash`/`transfer`/`e-wallet`), `status` (`unpaid`/`paid`/`late`, default `unpaid`), `notes`.
- Kombinasi `(tenant_id, period_month, period_year)` unik → duplikat mengembalikan `409`.

**`POST /api/payments/generate`** — body (opsional):

```json
{ "month": 7, "year": 2026 }
```

- Membuat tagihan `unpaid` untuk semua penghuni `active`. Periode yang sudah ada
  dilewati (dihitung sebagai `skipped`), bukan error.
- Respons: `{ "created": N, "skipped": M, "month": 7, "year": 2026 }`.

**`POST /api/payments/:id/pay`** — body (opsional):

```json
{ "payment_method": "cash", "paid_date": "2026-07-12" }
```

- Shortcut: `status` langsung dijadikan `paid`. Bila `payment_method` tidak valid/cosong,
  default `cash`. Bila `paid_date` kosong, default hari ini.

**`PUT /api/payments/:id`** — body (opsional): `amount`, `paid_date`, `payment_method`,
`status`, `notes`. Bila diubah ke `status: "paid"` tanpa `paid_date`, tanggal default hari ini.

### Dashboard — `src/routes/dashboard.js`

| Metode | Path              | Keterangan                                                                 |
| ------ | ----------------- | --------------------------------------------------------------------------- |
| GET    | `/api/dashboard`  | Ringkasan: jumlah kamar, penghuni aktif, pemasukan bulan ini, tunggakan, daftar jatuh tempo, tren 6 bulan. |

Respons mencakup `period`, `rooms` (`total`/`available`/`occupied`/`maintenance`),
`activeTenants`, `incomeThisMonth`, `outstanding` (`total`/`count`), `dueList`, dan `trend`.

### Autentikasi (Header / Cookie)

- Cookie: `kk_token` (httpOnly, `sameSite: lax`, `secure` otomatis di production, maxAge 7 hari).
- Atau header: `Authorization: Bearer <token>`.
- Tanpa token valid → `401 { "error": "Tidak terautentikasi. Silakan login." }`.

---

## Struktur Direktori

```
KelolaKos/
├── server.js              # Entry point Express, mount router + SPA fallback
├── src/
│   ├── db.js              # Inisialisasi DatabaseSync + migrate()
│   ├── auth.js            # bcrypt, JWT, cookie, requireAuth
│   └── routes/
│       ├── auth.js
│       ├── rooms.js
│       ├── tenants.js
│       ├── payments.js
│       └── dashboard.js
├── public/               # Frontend PWA (Alpine.js)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/style.css
│   ├── icons/
│   └── js/
│       ├── app.js
│       └── vendor/alpine.min.js
├── data/                 # Database SQLite (gitignored, otomatis dibuat)
├── .env.example          # Contoh konfigurasi environment
└── package.json
```

---

## Keamanan (Catatan)

- **Ganti `JWT_SECRET` di production** — aplikasi akan *throw* saat boot bila `NODE_ENV=production`
  dan `JWT_SECRET` kosong (mencegah boot dengan kunci yang diketahui publik).
- **Cookie `secure` otomatis di production** (`NODE_ENV=production`). Di development
  cookie dikirim lewat HTTP biasa.
- **Password di-hash dengan bcrypt** (cost 10) — tidak pernah disimpan sebagai teks polos.
- Token memiliki masa berlaku (`JWT_EXPIRES_IN`, default 7 hari) dan disimpan di cookie httpOnly
  sehingga tidak dapat diakses dari JavaScript frontend.

---

## Catatan / Keterbatasan (MVP)

- **Single-owner** — hanya satu akun pemilik; multi-akun belum didukung.
- **Notifikasi WhatsApp (FONNTE)** belum diimplementasikan — variabel `FONNTE_TOKEN` ada
  sebagai persiapan fase 1.5, namun belum ada kode konsumennya.
- **Data lokal** — database tersimpan di `data/` yang di-gitignore dan **belum ada mekanisme
  backup otomatis**. Lakukan backup file `data/kelolakos.db` secara mandiri.
- **Belum multi-cabang** — seluruh kamar/penghuni diasumsikan dalam satu properti kos.

---

## Lisensi

Proyek ini dilisensikan di bawah **MIT** (lihat `package.json`).
