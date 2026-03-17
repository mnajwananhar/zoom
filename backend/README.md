# Petshop Zoom Admin - Backend SQLite

Backend API untuk sistem review produk Petshop Zoom menggunakan SQLite.

## Struktur File

```
backend/
├── src/
│   ├── server.js      # Express server dengan API endpoints
│   ├── db.js          # Database manager (SQLite)
│   ├── init-db.js     # Inisialisasi database
│   └── migrate-data.js # Migrasi data dari HTML ke SQLite
├── data/
│   └── petshop.db     # File database SQLite
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Initialize Database

```bash
npm run init-db
```

Atau:

```bash
node src/init-db.js
```

### 3. Migrate Data dari HTML (Opsional)

Jika ingin memindahkan data yang sudah ada di file HTML:

```bash
node src/migrate-data.js
```

### 4. Jalankan Server

```bash
npm start
```

Atau untuk development dengan auto-reload:

```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000`

## API Endpoints

### Admin A/B/C

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/products/:category` | Get semua produk (A/B/C) |
| GET | `/api/brands/:category` | Get daftar merek |
| GET | `/api/stats/:category` | Get statistik |
| PATCH | `/api/products/:id/status` | Update status produk |
| POST | `/api/products/bulk-update` | Bulk update status |
| POST | `/api/products/import/:category` | Import produk dari JSON |
| GET | `/api/export/:category` | Export ke XLSX |

### Validator

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/validator/products` | Get semua produk (all categories) |
| GET | `/api/validator/stats` | Get statistik keseluruhan |
| POST | `/api/validator/export` | Export final ke XLSX |

### Health Check

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Cek server status |

## Database Schema

### Tabel `products`

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  barcode TEXT,
  sku TEXT,
  nama TEXT NOT NULL,
  merek TEXT,
  sub_jenis TEXT,
  jenis TEXT,
  stok REAL DEFAULT 0,
  satuan TEXT,
  rak TEXT,
  harga_pokok REAL DEFAULT 0,
  harga_jual REAL DEFAULT 0,
  keterangan TEXT,
  sheet TEXT,
  category TEXT, -- 'A', 'B', or 'C'
  flags TEXT,    -- JSON array
  status TEXT DEFAULT 'belum',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel `reviews` (Audit Trail)

```sql
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT,
  admin_id TEXT,
  old_status TEXT,
  new_status TEXT,
  reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Frontend Files

Setelah backend berjalan, buka file HTML baru di browser:

- `AdminA_new.html` - Review produk Admin A (Makanan Hewan)
- `AdminB_new.html` - Review produk Admin B (Accessories)
- `AdminC_new.html` - Review produk Admin C (Medis & Grooming)
- `validator_new.html` - Validator & Export

## Perbedaan dengan Versi Lama

| Fitur | Versi Lama (localStorage) | Versi Baru (SQLite) |
|-------|---------------------------|---------------------|
| Penyimpanan | Browser localStorage | SQLite database |
| Data persistence | Hanya di browser | Persisten di server |
| Multi-user | Tidak support | Support |
| Audit trail | Tidak ada | Tersimpan di tabel reviews |
| Export | Client-side | Server-side |

## Troubleshooting

### Error: Cannot find module 'better-sqlite3'

```bash
npm install better-sqlite3
```

### Error: EACCES: permission denied

Jalankan dengan administrator/sudo:

```bash
sudo npm start
```

### Port 3000 sudah digunakan

Ubah port di `server.js`:

```javascript
const PORT = process.env.PORT || 3001;
```

Atau kill process yang menggunakan port 3000:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```
