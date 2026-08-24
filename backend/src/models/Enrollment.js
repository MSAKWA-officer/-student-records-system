const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Tracks which class/stream a student is in for a given academic year
const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: { type: DataTypes.INTEGER, allowNull: false },
  school_class_id: { type: DataTypes.INTEGER, allowNull: false },
  stream_id: { type: DataTypes.INTEGER, allowNull: true },
  academic_year_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'enrollments',
  indexes: [
    { unique: true, fields: ['student_id', 'academic_year_id'] },
  ],
});

module.exports = Enrollment;
