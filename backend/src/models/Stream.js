const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// e.g. Form 1 "A", Form 1 "B"
const Stream = sequelize.define('Stream', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false }, // "A", "B", "North"
  school_class_id: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'streams' });

module.exports = Stream;
