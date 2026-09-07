const sequelize = require('../config/database');

(async () => {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await sequelize.getQueryInterface().dropTable('results'); // watoto kwanza
  await sequelize.getQueryInterface().dropTable('exams');   // kisha mzazi
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('exams and results tables dropped.');
  process.exit(0);
})();