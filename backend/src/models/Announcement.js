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
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  audience: {
    // who should see it — kept broad so the frontend can filter by role
    type: DataTypes.ENUM('all', 'teachers', 'students', 'parents'),
    defaultValue: 'all',
  },
  posted_by: {
    // user id of whoever is logged in when it's created — kept for
    // permissions/audit purposes, separate from the display name below.
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  posted_by_name: {
    // Free-text "Posted By" the admin/headteacher can type in themselves —
    // doesn't have to match a real User account. Shown in place of the
    // logged-in user's name whenever it's set.
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'announcements',
  timestamps: true,
});

module.exports = Announcement;
