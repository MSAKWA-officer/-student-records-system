const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ClassGateway = sequelize.define('ClassGateway', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  gateway_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  gateway_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  gateway_api_key: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'class_gateways',
  timestamps: true,
});

module.exports = ClassGateway;