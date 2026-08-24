const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// e.g. "Form 1", "Form 2" ... or "Standard 1"..."Standard 7"
const SchoolClass = sequelize.define('SchoolClass', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false }, // "Form 1", "Std 4"
  level: { type: DataTypes.INTEGER }, // 1,2,3... for sorting
  education_level: {
    type: DataTypes.ENUM('primary', 'secondary'),
    allowNull: false,
  },
}, { tableName: 'school_classes' });

module.exports = SchoolClass;
