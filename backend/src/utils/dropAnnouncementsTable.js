// One-off fix script — drops the stale `announcements` table so the next
// `sequelize.sync()` (on normal server start) recreates it fresh, matching
// the Announcement model exactly (fixes "Field 'body' doesn't have a
// default value" caused by an old/incomplete table definition).
//
// Run this once with:
//   node src/utils/dropAnnouncementsTable.js
//
// It reuses backend/src/config/database.js, so it connects using the same
// DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_SSL values already in your .env —
// no need to find Aiven connection details manually.

const sequelize = require('../config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to the database.');

    await sequelize.query('DROP TABLE IF EXISTS announcements;');
    console.log('Dropped the old "announcements" table (if it existed).');

    console.log('Done. Now start the server normally (npm run dev) — ');
    console.log('sequelize.sync() will recreate "announcements" correctly.');
  } catch (err) {
    console.error('Failed to drop the table:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
