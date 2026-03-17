const db = require('./db');

async function init() {
  console.log('Initializing database...');
  await db.init();
  console.log('Database initialized successfully!');
  await db.close();
}

init().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
