const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Term = sequelize.define('Term', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false }, // e.g. "Term 1", "First Term"
  academic_year_id: { type: DataTypes.INTEGER, allowNull: false },
  start_date: { type: DataTypes.DATEONLY },
  end_date: { type: DataTypes.DATEONLY },
  is_current: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'terms' });

module.exports = Term;
