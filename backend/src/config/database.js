require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 20363,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      underscored: true,
      timestamps: true,
    },
    // Hapa ndipo tunapoongeza SSL kwa ajili ya Aiven mtandaoni
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false // Inasaidia kukubali ulinzi wa Aiven bila kuhitaji kupakua faili la cheti (.pem)
      } : false
    }
  }
);

module.exports = sequelize;