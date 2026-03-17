/**
 * Script to extract data from HTML files and import to SQLite
 * Run: node src/migrate-data.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const ADMIN_DIR = path.join(__dirname, '../../');

function extractDataFromHTML(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Find the JSON data array in the HTML
  // Pattern: localStorage.setItem(STORAGE_KEY, JSON.stringify([...]))
  const match = content.match(/localStorage\.setItem\([^,]+,\s*JSON\.stringify\((\[[\s\S]*?\])\)\s*\);/);

  if (!match) {
    console.error('Could not find data in:', filePath);
    return [];
  }

  try {
    // Parse the JSON array
    const jsonStr = match[1];
    const data = JSON.parse(jsonStr);
    console.log(`Found ${data.length} items in ${path.basename(filePath)}`);
    return data;
  } catch (e) {
    console.error('Error parsing JSON from:', filePath, e.message);
    return [];
  }
}

async function migrate() {
  console.log('Starting data migration...\n');

  // Migrate Admin A
  console.log('Migrating Admin A (Makanan Hewan)...');
  const dataA = extractDataFromHTML(path.join(ADMIN_DIR, 'AdminA.html'));
  if (dataA.length > 0) {
    const count = await db.importProducts(dataA, 'A');
    console.log(`✓ Imported ${count} products for Admin A\n`);
  }

  // Migrate Admin B
  console.log('Migrating Admin B (Accessories)...');
  const dataB = extractDataFromHTML(path.join(ADMIN_DIR, 'AdminB.html'));
  if (dataB.length > 0) {
    const count = await db.importProducts(dataB, 'B');
    console.log(`✓ Imported ${count} products for Admin B\n`);
  }

  // Migrate Admin C
  console.log('Migrating Admin C (Medis & Grooming)...');
  const dataC = extractDataFromHTML(path.join(ADMIN_DIR, 'AdminC.html'));
  if (dataC.length > 0) {
    const count = await db.importProducts(dataC, 'C');
    console.log(`✓ Imported ${count} products for Admin C\n`);
  }

  // Show summary
  console.log('=== Migration Summary ===');
  const statsA = await db.getStats('A');
  const statsB = await db.getStats('B');
  const statsC = await db.getStats('C');

  console.log(`Admin A: ${statsA.total} products`);
  console.log(`Admin B: ${statsB.total} products`);
  console.log(`Admin C: ${statsC.total} products`);
  console.log(`Total: ${statsA.total + statsB.total + statsC.total} products`);

  await db.close();
  console.log('\nMigration complete!');
}

migrate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
