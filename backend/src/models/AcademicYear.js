const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AcademicYear = sequelize.define('AcademicYear', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  year_name: { type: DataTypes.STRING, allowNull: false, unique: true }, // e.g. "2026"
  start_date: { type: DataTypes.DATEONLY },
  end_date: { type: DataTypes.DATEONLY },
  is_current: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'academic_years' });

module.exports = AcademicYear;
