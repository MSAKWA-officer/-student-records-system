const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Teacher = sequelize.define('Teacher', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true }, // linked login account, optional
  staff_number: { type: DataTypes.STRING, unique: true },
  full_name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, unique: true },
  email: { type: DataTypes.STRING },
  qualification: { type: DataTypes.STRING },
  is_class_teacher_of: { type: DataTypes.INTEGER, allowNull: true }, // FK -> streams.id (optional)
}, { tableName: 'teachers' });

module.exports = Teacher;
