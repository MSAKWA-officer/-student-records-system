const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Stores one-time reset tokens separately from `users`, so this new table
// can be created by sequelize.sync() without needing to ALTER the existing
// users table (same reasoning as the Announcement fix).
const PasswordReset = sequelize.define('PasswordReset', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  token: {
    // Random, unguessable string sent in the email link.
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used: {
    // Marked true once the token has been used to reset a password,
    // so it can't be replayed.
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'password_resets',
  timestamps: true,
});

module.exports = PasswordReset;
