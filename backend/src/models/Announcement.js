const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  audience: {
    type: DataTypes.ENUM('all', 'teachers', 'students', 'parents'),
    allowNull: false,
    defaultValue: 'all',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  posted_by: {
    type: DataTypes.INTEGER, // User id (admin/teacher) who posted it
    allowNull: true,
  },
}, {
  tableName: 'announcements',
  timestamps: true,
});

module.exports = Announcement;
