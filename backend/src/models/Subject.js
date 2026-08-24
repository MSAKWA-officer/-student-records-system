const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subject = sequelize.define('Subject', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false }, // "Mathematics", "Kiswahili"
  code: { type: DataTypes.STRING, unique: true }, // "MATH", "KISW"
  education_level: {
    type: DataTypes.ENUM('primary', 'secondary', 'both'),
    defaultValue: 'both',
  },
}, { tableName: 'subjects' });

module.exports = Subject;
