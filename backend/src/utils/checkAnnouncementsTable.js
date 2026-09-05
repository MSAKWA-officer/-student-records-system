// Diagnostic script — prints the actual columns of the "announcements"
// table in your database, without needing a MySQL console/query tool.
//
// Run it with:
//   node src/utils/checkAnnouncementsTable.js
//
// It reuses backend/src/config/database.js, so it connects with the
// same .env values your server uses.

const sequelize = require('../config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to the database.');

    const [columns] = await sequelize.query('DESCRIBE announcements;');
    console.log('Current "announcements" table columns:');
    console.table(columns);
  } catch (err) {
    console.error('Failed to describe the table:', err.message);
  } finally {
    await sequelize.close();
  }
}

run();
