const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

// Setup multer for file upload
const dataDir = path.join(__dirname, '../data/');
const tempDir = path.join(dataDir, 'temp');

// Ensure data and temp directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({ dest: tempDir });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static frontend files
const frontendPath = path.join(__dirname, '../../');
app.use(express.static(frontendPath));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'Admin.html'));
});

// ============ ADMIN A/B/C API ============

// Get products by category (A, B, or C)
app.get('/api/products/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { status, merek, search } = req.query;

    const products = await db.getProducts({
      category: category.toUpperCase(),
      status,
      merek,
      search
    });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get brands for category
app.get('/api/brands/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const brands = await db.getBrands(category.toUpperCase());
    res.json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats for category
app.get('/api/stats/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const stats = await db.getStats(category.toUpperCase());
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update single product status (by product_uid or original id)
app.patch('/api/products/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminId } = req.body;

    if (!['aktif', 'nonaktif', 'lewati', 'belum'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Try as product_uid first (numeric), fallback to original id
    let product;
    if (/^\d+$/.test(id)) {
      product = await db.updateStatus(parseInt(id), status, adminId || 'admin');
    }
    if (!product) {
      const results = await db.updateStatusById(id, status, adminId || 'admin');
      product = results.length > 0 ? results : null;
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk update status (supports both product_uid and original id)
app.post('/api/products/bulk-update', async (req, res) => {
  try {
    const { ids, status, adminId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid ids array' });
    }

    if (!['aktif', 'nonaktif', 'lewati', 'belum'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Check if ids are numeric (product_uid) or string (original id)
    const allNumeric = ids.every(id => /^\d+$/.test(String(id)));
    let count;
    if (allNumeric) {
      count = await db.bulkUpdateStatus(ids.map(Number), status, adminId || 'admin');
    } else {
      count = await db.bulkUpdateStatusByIds(ids, status, adminId || 'admin');
    }
    res.json({ success: true, data: { updated: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import products from JSON
app.post('/api/products/import/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid products array' });
    }

    const count = await db.importProducts(products, category.toUpperCase());
    res.json({ success: true, data: { imported: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export products to XLSX
app.get('/api/export/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const products = await db.getProducts({ category: category.toUpperCase() });

    const SHEET_ORDER = [
      'Makanan Hewan','Accessories','Mainan','Shampoo & Grooming','Lain-lain',
      'Peralatan Makan & Minum','Obat & Medis','Kandang','Grooming Tools','Perlengkapan',
      'Baju & Fashion','Pasir & Litter','Vitamin & Suplemen','Minuman','Makanan Umum',
      'Perawatan Badan','Care Products','Tempat Tidur & Tikar','Hamster'
    ];

    // Group by sheet
    const bySheet = {};
    products.forEach(p => {
      if (!bySheet[p.sheet]) bySheet[p.sheet] = [];
      bySheet[p.sheet].push(p);
    });

    const sheets = SHEET_ORDER.filter(s => bySheet[s])
      .concat(Object.keys(bySheet).filter(s => !SHEET_ORDER.includes(s)));

    const wb = XLSX.utils.book_new();

    for (const sname of sheets) {
      const sitems = bySheet[sname];
      const isFood = sname === 'Makanan Hewan';

      const headers = isFood
        ? ['Kode Item','Barcode','SKU','Nama Item','Merek','Sub Jenis','Stok','Satuan','Rak','Harga Pokok','Harga Jual','Keterangan','Status Review']
        : ['Kode Item','Barcode','SKU','Nama Item','Merek','Jenis','Stok','Satuan','Rak','Harga Pokok','Harga Jual','Keterangan','Status Review'];

      const rows = sitems.map(i => isFood
        ? [i.id, i.barcode, i.sku, i.nama, i.merek, i.sub_jenis, i.stok, i.satuan, i.rak, i.harga_pokok, i.harga_jual, i.keterangan, i.status]
        : [i.id, i.barcode, i.sku, i.nama, i.merek, i.jenis || i.sub_jenis, i.stok, i.satuan, i.rak, i.harga_pokok, i.harga_jual, i.keterangan, i.status]
      );

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, sname.substring(0, 31));
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=hasil_review_admin_${category.toUpperCase()}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ VALIDATOR API ============

// Get all products (for validator)
app.get('/api/validator/products', async (req, res) => {
  try {
    const products = await db.getAllProductsForValidator();

    // Detect duplicates
    const nameCount = {};
    products.forEach(p => {
      const key = p.nama.toLowerCase().trim();
      nameCount[key] = (nameCount[key] || 0) + 1;
    });

    // Add flags
    for (const p of products) {
      const flags = [];
      if (nameCount[p.nama.toLowerCase().trim()] > 1) flags.push('duplikat');
      if (p.harga_jual === 0) flags.push('harga-nol');
      if (p.stok === 0) flags.push('stok-nol');
      p.flags = flags;

      // Update in DB using product_uid
      await db.updateFlags(p.product_uid, flags);
    }

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get summary stats for validator
app.get('/api/validator/stats', async (req, res) => {
  try {
    const stats = await db.getValidatorStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export for validator
app.post('/api/validator/export', async (req, res) => {
  try {
    const { mode } = req.body; // 'aktif', 'nonaktif', 'semua'

    let products = await db.getAllProductsForValidator();

    if (mode === 'aktif') {
      products = products.filter(p => p.status === 'aktif');
    } else if (mode === 'nonaktif') {
      products = products.filter(p => p.status === 'nonaktif');
    } else {
      products = products.filter(p => p.status === 'aktif' || p.status === 'nonaktif');
    }

    const SHEET_ORDER = [
      'Makanan Hewan','Accessories','Mainan','Shampoo & Grooming','Lain-lain',
      'Peralatan Makan & Minum','Obat & Medis','Kandang','Grooming Tools','Perlengkapan',
      'Baju & Fashion','Pasir & Litter','Vitamin & Suplemen','Minuman','Makanan Umum',
      'Perawatan Badan','Care Products','Tempat Tidur & Tikar','Hamster'
    ];

    const bySheet = {};
    products.forEach(p => {
      if (!bySheet[p.sheet]) bySheet[p.sheet] = [];
      bySheet[p.sheet].push(p);
    });

    const sheets = SHEET_ORDER.filter(s => bySheet[s])
      .concat(Object.keys(bySheet).filter(s => !SHEET_ORDER.includes(s)));

    const wb = XLSX.utils.book_new();

    for (const sname of sheets) {
      const sitems = bySheet[sname];
      const isFood = sname === 'Makanan Hewan';

      const headers = isFood
        ? ['Kode Item','Barcode','SKU','Nama Item','Merek','Sub Jenis','Stok','Satuan','Harga Jual']
        : ['Kode Item','Barcode','SKU','Nama Item','Merek','Jenis','Stok','Satuan','Harga Jual'];

      const rows = sitems.map(i => [
        i.id, i.barcode, i.sku, i.nama, i.merek,
        isFood ? i.sub_jenis : (i.jenis || i.sub_jenis),
        i.stok, i.satuan, i.harga_jual
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, sname.substring(0, 31));
    }

    const fileName = mode === 'aktif' ? 'produk_aktif.xlsx' :
                     mode === 'nonaktif' ? 'produk_tidak_aktif.xlsx' :
                     'semua_produk_review.xlsx';

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Upload database file
app.post('/api/upload-db', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const destPath = path.join(dataDir, 'petshop.db');

    // Remove existing db if any
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }

    // Move uploaded file to data directory
    fs.renameSync(req.file.path, destPath);

    res.json({ success: true, message: 'Database uploaded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
