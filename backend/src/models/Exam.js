const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Exam = sequelize.define('Exam', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false }, // "Mid-Term Exam", "Final Exam"
  term_id: { type: DataTypes.INTEGER, allowNull: false },
  start_date: { type: DataTypes.DATEONLY }, // exam sittings can span several days
  end_date: { type: DataTypes.DATEONLY },
  // Every subject's paper is marked out of 100 — this is a fixed rule, not
  // something that varies per exam, so it is no longer editable from the
  // exam form. It stays a real column (rather than a hardcoded literal
  // everywhere) because Result validation/grading below reads it off the
  // Exam record.
  max_marks: { type: DataTypes.INTEGER, defaultValue: 100 },
  weight_percent: { type: DataTypes.FLOAT, defaultValue: 100 }, // for weighted averages
}, { tableName: 'exams' });

module.exports = Exam;

