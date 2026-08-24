const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Result = sequelize.define('Result', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: { type: DataTypes.INTEGER, allowNull: false },
  exam_id: { type: DataTypes.INTEGER, allowNull: false },
  subject_id: { type: DataTypes.INTEGER, allowNull: false },
  marks_obtained: { type: DataTypes.FLOAT, allowNull: false },
  grade: { type: DataTypes.STRING }, // A, B, C, D, F - computed
  remarks: { type: DataTypes.STRING },
  entered_by: { type: DataTypes.INTEGER }, // FK -> users.id (teacher who entered)
}, {
  tableName: 'results',
  indexes: [
    { unique: true, fields: ['student_id', 'exam_id', 'subject_id'] },
  ],
});

module.exports = Result;
