const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exam = sequelize.define('Exam', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false }, // "Mid-Term Exam", "Final Exam"
  term_id: { type: DataTypes.INTEGER, allowNull: false },
  exam_date: { type: DataTypes.DATEONLY },
  max_marks: { type: DataTypes.INTEGER, defaultValue: 100 },
  weight_percent: { type: DataTypes.FLOAT, defaultValue: 100 }, // for weighted averages
}, { tableName: 'exams' });

module.exports = Exam;
