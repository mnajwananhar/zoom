const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const DB_PATH = path.join(__dirname, '../data/petshop.db');

class DatabaseManager {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.init();
  }

  async init() {
    // Create tables - use rowid as implicit PK, composite unique on (id, satuan, category)
    await this.run(`
      CREATE TABLE IF NOT EXISTS products (
        product_uid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
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
        category TEXT,
        flags TEXT,
        status TEXT DEFAULT 'belum',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id, satuan, category)
      )
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_uid INTEGER,
        admin_id TEXT,
        old_status TEXT,
        new_status TEXT,
        reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_uid) REFERENCES products(product_uid)
      )
    `);

    // Create indexes
    await this.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_products_merek ON products(merek)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_products_sheet ON products(sheet)`);
    await this.run(`CREATE INDEX IF NOT EXISTS idx_products_id ON products(id)`);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Get all products with optional filters
  async getProducts(filters = {}) {
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.merek) {
      sql += ' AND merek = ?';
      params.push(filters.merek);
    }

    if (filters.sheet) {
      sql += ' AND sheet = ?';
      params.push(filters.sheet);
    }

    if (filters.search) {
      sql += ' AND (nama LIKE ? OR merek LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY sheet, merek, nama';

    const products = await this.all(sql, params);

    // Parse flags JSON
    return products.map(p => ({
      ...p,
      flags: p.flags ? JSON.parse(p.flags) : []
    }));
  }

  // Get single product by product_uid
  async getProductByUid(uid) {
    const product = await this.get('SELECT * FROM products WHERE product_uid = ?', [uid]);
    if (product) {
      product.flags = product.flags ? JSON.parse(product.flags) : [];
    }
    return product;
  }

  // Get single product by id (returns first match - for backward compat)
  async getProduct(id) {
    const product = await this.get('SELECT * FROM products WHERE id = ?', [id]);
    if (product) {
      product.flags = product.flags ? JSON.parse(product.flags) : [];
    }
    return product;
  }

  // Get all products matching an id (there can be multiple with different satuan)
  async getProductsById(id) {
    const products = await this.all('SELECT * FROM products WHERE id = ?', [id]);
    return products.map(p => ({
      ...p,
      flags: p.flags ? JSON.parse(p.flags) : []
    }));
  }

  // Get unique brands for a category
  async getBrands(category) {
    const sql = `
      SELECT merek, COUNT(*) as count,
        SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) as aktif_count,
        SUM(CASE WHEN status = 'nonaktif' THEN 1 ELSE 0 END) as nonaktif_count
      FROM products
      WHERE category = ?
      GROUP BY merek
      ORDER BY COUNT(*) DESC
    `;
    return await this.all(sql, [category]);
  }

  // Get statistics
  async getStats(category) {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) as aktif,
        SUM(CASE WHEN status = 'nonaktif' THEN 1 ELSE 0 END) as nonaktif,
        SUM(CASE WHEN status = 'lewati' THEN 1 ELSE 0 END) as lewati,
        SUM(CASE WHEN status = 'belum' THEN 1 ELSE 0 END) as belum
      FROM products
      WHERE category = ?
    `;
    return await this.get(sql, [category]);
  }

  // Update product status by product_uid
  async updateStatus(uid, newStatus, adminId) {
    const product = await this.getProductByUid(uid);
    if (!product) return null;

    // Insert audit record
    await this.run(
      'INSERT INTO reviews (product_uid, admin_id, old_status, new_status) VALUES (?, ?, ?, ?)',
      [uid, adminId, product.status, newStatus]
    );

    // Update product
    await this.run(
      'UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE product_uid = ?',
      [newStatus, uid]
    );

    return await this.getProductByUid(uid);
  }

  // Update product status by original id (backward compat - updates ALL matching id)
  async updateStatusById(id, newStatus, adminId) {
    const products = await this.getProductsById(id);
    const results = [];
    for (const product of products) {
      await this.run(
        'INSERT INTO reviews (product_uid, admin_id, old_status, new_status) VALUES (?, ?, ?, ?)',
        [product.product_uid, adminId, product.status, newStatus]
      );
      await this.run(
        'UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE product_uid = ?',
        [newStatus, product.product_uid]
      );
      results.push(await this.getProductByUid(product.product_uid));
    }
    return results;
  }

  // Bulk update status by product_uid
  async bulkUpdateStatus(uids, newStatus, adminId) {
    for (const uid of uids) {
      const product = await this.getProductByUid(uid);
      if (product) {
        await this.run(
          'INSERT INTO reviews (product_uid, admin_id, old_status, new_status) VALUES (?, ?, ?, ?)',
          [uid, adminId, product.status, newStatus]
        );
        await this.run(
          'UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE product_uid = ?',
          [newStatus, uid]
        );
      }
    }
    return uids.length;
  }

  // Bulk update status by original ids (backward compat)
  async bulkUpdateStatusByIds(ids, newStatus, adminId) {
    let count = 0;
    for (const id of ids) {
      const products = await this.getProductsById(id);
      for (const product of products) {
        await this.run(
          'INSERT INTO reviews (product_uid, admin_id, old_status, new_status) VALUES (?, ?, ?, ?)',
          [product.product_uid, adminId, product.status, newStatus]
        );
        await this.run(
          'UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE product_uid = ?',
          [newStatus, product.product_uid]
        );
        count++;
      }
    }
    return count;
  }

  // Insert or replace products (for import) - uses composite unique key
  async importProducts(products, category) {
    const sql = `
      INSERT OR REPLACE INTO products (
        id, barcode, sku, nama, merek, sub_jenis, jenis, stok, satuan, rak,
        harga_pokok, harga_jual, keterangan, sheet, category, flags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const item of products) {
      await this.run(sql, [
        item.id,
        item.barcode || '',
        item.sku || '',
        item.nama,
        item.merek || '',
        item.sub_jenis || '',
        item.jenis || '',
        item.stok || 0,
        item.satuan || '',
        item.rak || '',
        item.harga_pokok || 0,
        item.harga_jual || 0,
        item.keterangan || '',
        item.sheet || '',
        category,
        JSON.stringify(item.flags || []),
        item.status || 'belum'
      ]);
    }
    return products.length;
  }

  // Get all products for validator (all categories)
  async getAllProductsForValidator() {
    const products = await this.all('SELECT * FROM products ORDER BY sheet, merek, nama');
    return products.map(p => ({
      ...p,
      flags: p.flags ? JSON.parse(p.flags) : []
    }));
  }

  // Update product flags by product_uid
  async updateFlags(uid, flags) {
    await this.run(
      'UPDATE products SET flags = ?, updated_at = CURRENT_TIMESTAMP WHERE product_uid = ?',
      [JSON.stringify(flags), uid]
    );
    return await this.getProductByUid(uid);
  }

  // Update product flags by id (updates all matching)
  async updateFlagsById(id, flags) {
    await this.run(
      'UPDATE products SET flags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(flags), id]
    );
  }

  // Get validator stats
  async getValidatorStats() {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) as aktif,
        SUM(CASE WHEN status = 'nonaktif' THEN 1 ELSE 0 END) as nonaktif,
        SUM(CASE WHEN status = 'lewati' THEN 1 ELSE 0 END) as lewati,
        SUM(CASE WHEN status = 'belum' THEN 1 ELSE 0 END) as belum
      FROM products
    `;
    return await this.get(sql);
  }

  // Close connection
  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        resolve();
      });
    });
  }
}

module.exports = new DatabaseManager();
