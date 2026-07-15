# PRD — KelolaKos (Product Requirements Document)

> **Status:** As-built (MVP rilis 1.0) + rencana fase berikutnya.
> **Bahasa:** Indonesia. Dokumen ini merekam kebutuhan produk, model data, desain API,
> arsitektur, batasan, dan peta jalan pengembangan KelolaKos.

---

## 1. Ringkasan Produk

**KelolaKos** adalah aplikasi web **PWA mobile-first** untuk membantu pemilik kos
(boarding house) mengelola operasional harian: kamar, penghuni, dan pencatatan
pembayaran/sewa bulanan. Aplikasi berjalan sepenuhnya di lokal (tanpa layanan pihak ketiga
wajib) dan ditujukan untuk **satu pemilik (single-owner)**.

Tujuan utama: mengganti pencatatan manual (buku/buku Excel) dengan antarmuka sederhana
yang bisa dipasang di HP, mendukung alur *tambah kamar → tambah penghuni → generate tagihan
→ lunasi*, serta menyajikan ringkasan keuangan di layar Beranda.

---

## 2. Latar Belakang & Masalah

Pemilik kos skala kecil/rumahan sering menghadapi:

- Pencatatan kamar & penghuni tersebar di buku tulis atau spreadsheet.
- Lupa periode sewa mana yang sudah/belum dibayar → tunggakan tertunda.
- Tidak ada ringkasan cepat: kamar terisi berapa, pemasukan bulan ini, siapa yang jatuh tempo.
- Sulit mengakses data saat di luar rumah (tidak mobile-friendly).

**Solusi:** satu aplikasi web ringan yang bisa diinstal di HP (PWA), menyimpan data di
SQLite lokal, dengan alur kerja yang dipadatkan untuk penggunaan harian.

---

## 3. Tujuan & Non-Tujuan

### Tujuan
- Memberi dashboard ringkasan keuangan & okupansi kos.
- Memudahkan CRUD kamar, penghuni, dan pembayaran.
- Otomatisasi pembuatan tagihan bulanan bagi penghuni aktif.
- Dapat diakses & dipasang di perangkat mobile (PWA).
- Menjaga data privat di server lokal pemilik (tanpa cloud wajib).

### Non-Tujuan (MVP)
- Bukan multi-pemilik / multi-cabang / multi-properti.
- Bukan sistem pembayaran online (gateways) — pencatatan manual.
- Bukan notifikasi otomatis (WhatsApp/SMS) — direncanakan fase 1.5, belum diimplementasi.
- Bukan akuntansi penuh (laporan pajak, pengeluaran, dll.).

---

## 4. Target Pengguna

| Peran        | Deskripsi                                                                 |
| ------------ | ------------------------------------------------------------------------- |
| **Pemilik**  | Satu akun `owner`. Mengelola seluruh kamar, penghuni, dan pembayaran.      |
| (Calon)      | Belum ada peran `tenant` yang aktif di UI; skema menyediakan slot tersebut.|

Profil: pemilik kos rumahan/kecil, bukan teknis, menggunakan HP Android/iOS sebagai
perangkat utama.

---

## 5. Ruang Lingkup MVP (Rilis 1.0)

Fitur yang **sudah tersedia** di kode:

- Autentikasi pemilik (register 1x, login, logout, sesi via JWT cookie).
- Manajemen kamar (CRUD, filter status & pencarian).
- Manajemen penghuni (CRUD, filter status/room/q).
- Sinkronisasi status kamar otomatis (`syncRoomStatus`).
- Manajemen pembayaran (CRUD, filter periode/status/tenant/room).
- Generate tagihan bulanan massal (`/api/payments/generate`).
- Shortcut lunasi (`/api/payments/:id/pay`).
- Dashboard ringkasan + tren 6 bulan.
- Frontend PWA (Alpine.js) dengan bottom-nav: Beranda / Kamar / Penghuni / Bayar.

---

## 6. User Stories / Fitur Utama

| #  | Sebagai …      | Saya ingin …                                              | Agar …                                       |
| -- | -------------- | --------------------------------------------------------- | -------------------------------------------- |
| F1 | Pemilik        | mendaftar akun sekali lalu login                          | hanya saya yang kelola datanya              |
| F2 | Pemilik        | menambah/mengubah/menghapus kamar                         | data kamar selalu mutakhir                   |
| F3 | Pemilik        | menempatkan penghuni ke kamar                             | status kamar otomatis `occupied`             |
| F4 | Pemilik        | melihat daftar penghuni aktif & keluar                    | tahu siapa menempati kamar mana              |
| F5 | Pemilik        | generate tagihan bulanan sekaligus                        | tidak membuat satu-satu untuk tiap penghuni  |
| F6 | Pemilik        | menandai tagihan lunas (cash/transfer/e-wallet)           | status pembayaran tercatat                   |
| F7 | Pemilik        | melihat dashboard (okupansi, pemasukan, tunggakan)        | memantau kesehatan kos sekilas pandang        |
| F8 | Pemilik        | menginstal aplikasi di HP                                 | akses cepat & offline-lite via PWA           |

---

## 7. Model Data

Skema dibuat idempoten oleh `migrate()` (`src/db.js`). Semua uang = **integer Rupiah**.

### `users`
| Kolom         | Tipe     | Keterangan                                       |
| ------------- | -------- | ------------------------------------------------ |
| `id`          | INTEGER  | PK, autoincrement.                               |
| `role`        | TEXT     | `'owner'` / `'tenant'` (default `owner`).        |
| `name`        | TEXT     | Wajib.                                           |
| `username`    | TEXT     | Wajib, UNIQUE.                                   |
| `phone`       | TEXT     | Opsional.                                        |
| `password`    | TEXT     | Hash bcrypt.                                     |
| `created_at`  | TEXT     | Default `datetime('now')`.                       |

### `rooms`
| Kolom         | Tipe     | Keterangan                                                  |
| ------------- | -------- | ----------------------------------------------------------- |
| `id`          | INTEGER  | PK.                                                         |
| `room_number` | TEXT     | Wajib.                                                      |
| `type`        | TEXT     | `'single'` / `'shared'` (default `single`).                |
| `price`       | INTEGER  | Harga sewa (default 0).                                     |
| `status`      | TEXT     | `'available'` / `'occupied'` / `'maintenance'` (default `available`). |
| `notes`       | TEXT     | Opsional.                                                   |
| `created_at` / `updated_at` | TEXT | Audit timestamp.                            |

### `tenants`
| Kolom             | Tipe    | Keterangan                                                       |
| ----------------- | ------- | ---------------------------------------------------------------- |
| `id`              | INTEGER | PK.                                                              |
| `room_id`         | INTEGER | FK → `rooms.id` `ON DELETE SET NULL` (opsional).                 |
| `name`            | TEXT    | Wajib.                                                           |
| `phone`           | TEXT    | Opsional.                                                        |
| `identity_number` | TEXT    | Opsional.                                                        |
| `start_date`      | TEXT    | Opsional.                                                        |
| `status`          | TEXT    | `'active'` / `'moved_out'` (default `active`).                  |
| `notes`           | TEXT    | Opsional.                                                       |
| `created_at` / `updated_at` | TEXT | Audit timestamp.                               |

### `payments`
| Kolom            | Tipe    | Keterangan                                                       |
| ---------------- | ------- | ---------------------------------------------------------------- |
| `id`             | INTEGER | PK.                                                              |
| `tenant_id`      | INTEGER | FK → `tenants.id` `ON DELETE CASCADE` (wajib).                   |
| `room_id`        | INTEGER | FK → `rooms.id` `ON DELETE SET NULL` (opsional).                 |
| `period_month`   | INTEGER | 1–12 (wajib).                                                    |
| `period_year`    | INTEGER | Tahun (wajib).                                                   |
| `amount`         | INTEGER | Nominal (default 0).                                             |
| `paid_date`      | TEXT    | Tanggal lunas (opsional).                                        |
| `payment_method` | TEXT    | `'cash'` / `'transfer'` / `'e-wallet'`.                         |
| `status`         | TEXT    | `'unpaid'` / `'paid'` / `'late'` (default `unpaid`).            |
| `notes`          | TEXT    | Opsional.                                                       |
| `created_at` / `updated_at` | TEXT | Audit timestamp.                              |
| **UNIQUE**        | —       | `(tenant_id, period_month, period_year)`.                        |

**Aturan integritas penting**
- Hapus `tenant` → seluruh `payments`-nya ikut terhapus (CASCADE).
- Hapus `room` yang masih punya penghuni aktif → **ditolak** (`409`) di level aplikasi.
- `syncRoomStatus`: perubahan penghuni menyesuaikan `rooms.status` ke `occupied`/`available`
  berdasarkan penghuni aktif; status `maintenance` **tidak** ditimpa otomatis.

---

## 8. Desain API

Base URL `/api`. Semua route (kecuali auth & health) dilindungi `requireAuth`
(cookie `kk_token` atau header `Authorization: Bearer <token>`).

### 8.1 Auth — `src/routes/auth.js`
| Metode | Path                        | Auth? | Keterangan                                            |
| ------ | --------------------------- | ----- | ----------------------------------------------------- |
| GET    | `/api/auth/registration-open` | Tidak | `{ open: bool }` — registrasi tertutup setelah 1 owner. |
| POST   | `/api/auth/register`        | Tidak | Body: `name`, `username`, `password`(≥6), `phone?`. `403` bila owner ada; `409` bila username dipakai. |
| POST   | `/api/auth/login`           | Tidak | Body: `username`, `password`. `401` bila salah.       |
| POST   | `/api/auth/logout`          | Tidak | Hapus cookie.                                         |
| GET    | `/api/auth/me`              | Ya    | Profil pemilik.                                       |

### 8.2 Rooms — `src/routes/rooms.js`
| Metode | Path                | Keterangan                                                       |
| ------ | ------------------- | ---------------------------------------------------------------- |
| GET    | `/api/rooms`        | `?status=`, `?q=` (room_number/notes).                           |
| GET    | `/api/rooms/:id`    | Detail + penghuni.                                               |
| POST   | `/api/rooms`        | `room_number` wajib; `type`,`price`,`status`,`notes` opsional.   |
| PUT    | `/api/rooms/:id`    | Update sebagian.                                                 |
| DELETE | `/api/rooms/:id`    | `409` bila ada penghuni aktif.                                   |

### 8.3 Tenants — `src/routes/tenants.js`
| Metode | Path                  | Keterangan                                                       |
| ------ | --------------------- | ---------------------------------------------------------------- |
| GET    | `/api/tenants`        | `?status=`, `?room_id=`, `?q=` (name/phone).                     |
| GET    | `/api/tenants/:id`    | Detail + riwayat pembayaran.                                     |
| POST   | `/api/tenants`        | `name` wajib; `room_id`,`phone`,`identity_number`,`start_date`,`status`,`notes` opsional. Panggil `syncRoomStatus`. |
| PUT    | `/api/tenants/:id`    | Update + re-sync kamar lama & baru.                              |
| DELETE | `/api/tenants/:id`    | Hapus + sync kamar (riwayat pembayaran ikut terhapus).           |

### 8.4 Payments — `src/routes/payments.js`
| Metode | Path                       | Keterangan                                                       |
| ------ | -------------------------- | ---------------------------------------------------------------- |
| GET    | `/api/payments`            | `?month=`,`?year=`,`?status=`,`?tenant_id=`,`?room_id=`.         |
| POST   | `/api/payments`            | `tenant_id`,`period_month`,`period_year` wajib; unik → `409`.    |
| POST   | `/api/payments/generate`   | Body `month?`,`year?` → tagihan `unpaid` massal penghuni aktif; periode ada dilewati (`skipped`). |
| PUT    | `/api/payments/:id`        | Update; `status:'paid'` tanpa `paid_date` → hari ini.            |
| POST   | `/api/payments/:id/pay`    | Shortcut lunas; `payment_method` invalid → `cash`; `paid_date` default hari ini. |
| DELETE | `/api/payments/:id`        | Hapus.                                                           |

### 8.5 Dashboard — `src/routes/dashboard.js`
| Metode | Path              | Keterangan                                                       |
| ------ | ----------------- | ---------------------------------------------------------------- |
| GET    | `/api/dashboard`  | `rooms` (total/available/occupied/maintenance), `activeTenants`, `incomeThisMonth`, `outstanding`(total/count), `dueList` (≤20), `trend` (6 bulan). |

### 8.6 Health
`GET /api/health` → `{ ok: true, service: 'kelolakos' }` (tanpa auth).

---

## 9. Arsitektur & Teknologi

- **Backend:** Node.js + Express 4, ES modules (`"type": "module"`).
- **Database:** `node:sqlite` (`DatabaseSync`) bawaan Node — tanpa kompilasi native.
  Path default `./data/kelolakos.db` (di-gitignore, mkdir otomatis). `PRAGMA journal_mode=WAL`,
  `PRAGMA foreign_keys=ON`.
- **Auth:** `bcryptjs` + `jsonwebtoken`; token di httpOnly cookie `kk_token`
  (`sameSite: lax`, `secure` di production, maxAge 7 hari). Dev fallback secret
  `insecure-dev-secret`; production *throw* bila `JWT_SECRET` kosong.
- **Frontend:** Alpine.js 3 (di-vendor), vanilla JS, PWA (`manifest.json` + `sw.js`,
  offline-lite). Entry `public/index.html`; SPA fallback di `server.js:44`.
- **Server:** `server.js` mount router `/api/*`, static `public/`, SPA fallback, JSON error handler.
  Port dari `PORT` (default 3000).
- **Skrip:** `npm start` (`node --no-warnings server.js`), `npm run dev` (`--watch`).

```
server.js → /api/{auth,rooms,tenants,payments,dashboard}, /api/health, static public/, SPA fallback
src/ → db.js, auth.js, routes/*.js
data/ → kelolakos.db (gitignored)
```

**Prasyarat runtime:** Node.js **≥ 22.5.0**. `node:sqlite` stabil tanpa flag sejak Node
22.10; pada 22.5–22.9 butuh `--experimental-sqlite`. (Environment saat ini: Node v24.)

---

## 10. Keamanan

- Kata sandi di-hash bcrypt (cost 10); tidak pernah disimpan sebagai plaintext.
- JWT di cookie `httpOnly` + `sameSite: lax`; `secure` otomatis saat `NODE_ENV=production`.
- `JWT_SECRET` wajib di production (fail-fast saat boot).
- Auth via middleware `requireAuth` (cookie atau `Bearer`) untuk seluruh route terlindungi.
- Input uang divalidasi sebagai integer (`Number.parseInt(x,10) || 0`).

---

## 11. Batasan & Risiko (MVP)

- **Single-owner:** tidak ada multi-akun/pembagian akses.
- **Data lokal:** `data/` di-gitignore, **belum ada backup otomatis** — kehilangan file =
  kehilangan data.
- **Tanpa notifikasi otomatis:** penagihan mengandalkan pemilik memeriksa dashboard.
- **Belum multi-cabang:** satu properti kos per instalasi.
- **PWA offline-lite:** `sw.js` belum menyediakan offline penuh untuk data dinamis.

---

## 12. Peta Jalan (Roadmap)

| Fase   | Fitur                                                  | Status kode            |
| ------ | ------------------------------------------------------ | ---------------------- |
| 1.0    | MVP: auth, kamar, penghuni, pembayaran, dashboard, PWA | ✅ Terimplementasi     |
| 1.5    | Notifikasi WhatsApp via FONNTE (`FONNTE_TOKEN`)        | 🔜 Belum (slot env ada)|
| 2.0    | Pengingat jatuh tempo otomatis + log notifikasi        | ⏳ Rencana             |
| 2.x    | Laporan & ekspor (CSV/PDF)                             | ⏳ Rencana             |
| 3.x    | Multi-pemilik / multi-cabang                           | ⏳ Rencana             |
| 3.x    | Backup otomatis & restore                             | ⏳ Rencana             |

---

## 13. Metrik Keberhasilan

- Waktu pencatatan sewa per bulan turun secara signifikan vs pencatatan manual.
- 100% tagihan bulan berjalan tergenerate lewat endpoint `/generate` (tanpa input manual per penghuni).
- Dashboard menjadi layar pertama yang dibuka pemilik untuk memantau tunggakan.
- Aplikasi dapat diinstal & digunakan dari HP (PWA) tanpa instalasi tambahan.

---

## 14. Glosarium

- **Penghuni aktif:** `tenants.status = 'active'`.
- **Tagihan jatuh tempo:** `payments.status IN ('unpaid','late')`.
- **Okupansi:** rasio kamar `occupied` terhadap total kamar.
- **PWA:** Progressive Web App — web app yang bisa diinstal ke perangkat.
