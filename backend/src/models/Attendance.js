const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'late', 'excused'),
    allowNull: false,
    defaultValue: 'present',
  },
  recorded_by: { type: DataTypes.INTEGER }, // FK -> users.id
  notes: { type: DataTypes.STRING },
}, {
  tableName: 'attendance',
  indexes: [
    { unique: true, fields: ['student_id', 'date'] },
  ],
});

module.exports = Attendance;
