// Run with: node src/utils/seedAdmin.js
require('dotenv').config();
const { sequelize, User } = require('../models');

async function seed() {
  await sequelize.authenticate();
  await sequelize.sync();

  const existing = await User.findOne({ where: { email: 'admin@school.ac.tz' } });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    process.exit(0);
  }

  const admin = await User.create({
    full_name: 'Super Admin',
    email: 'admin@school.ac.tz',
    password: 'Admin@12345', // change this immediately after logging in
    role: 'admin',
  });

  console.log('✅ Admin created:');
  console.log('   Email:', admin.email);
  console.log('   Password: Admin@12345 (change it right away!)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
