# Deploy ke Render

## Persiapan

1. **Push project ini ke GitHub** (jika belum)
2. **Backup database lokal** (kalau ada data yang perlu dipertahankan):
   ```
   Copy backend/data/petshop.db ke tempat aman
   ```

## Deploy Backend ke Render

1. Login ke [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect ke GitHub repo yang sudah di-push
4. Configure:

   | Setting | Value |
   |---------|-------|
   | Name | `petshop-admin` (atau nama lain) |
   | Root Directory | `backend` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

5. **Environment Variables** - click "Add Environment Variable":
   - `PORT` = `3000`
   - `NODE_ENV` = `production`

6. Click **Create Web Service**

7. **Tunggu deploy selesai** (~2-3 menit)
8. Setelah deploy, catat URL-nya, misalnya:
   ```
   https://petshop-admin.onrender.com
   ```

## Upload Database (Kalau Ada Data)

1. Di Render dashboard, click service kamu → **Shell**
2. Buat directory `data`:
   ```bash
   mkdir -p data
   ```
3. Upload `petshop.db` ke folder `/app/data/`

Cara upload lewat curl dari local:
```bash
# Dari terminal local, upload database:
curl -X POST -F "file=@backend/data/petshop.db" \
  https://petshop-admin.onrender.com/api/upload-db
```

*(Note: Kalau endpoint ini belum ada, bisa upload via Render Dashboard → Files)*

## Akses Aplikasi

- **Frontend**: `https://petshop-admin.onrender.com/Admin.html`
- **Admin A**: `https://petshop-admin.onrender.com/AdminA.html`
- **Admin B**: `https://petshop-admin.onrender.com/AdminB.html`
- **Admin C**: `https://petshop-admin.onrender.com/AdminC.html`
- **Validator**: `https://petshop-admin.onrender.com/validator.html`

## Troubleshooting

**CORS Error?**
CORS sudah di-enable di backend, jadi seharusnya tidak perlu konfigurasi tambahan.

**Database tidak ada?**
Buat baru dengan:
```bash
cd backend
npm run init-db
```
Terus upload database baru via Render Shell.

**Static files tidak kebaca?**
Pastikan root directory saat deploy ke `backend` karena `package.json` ada di situ.