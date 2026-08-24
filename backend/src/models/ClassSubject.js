const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Links a subject to a class, and assigns a teacher for that academic year
const ClassSubject = sequelize.define('ClassSubject', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  school_class_id: { type: DataTypes.INTEGER, allowNull: false },
  subject_id: { type: DataTypes.INTEGER, allowNull: false },
  teacher_id: { type: DataTypes.INTEGER, allowNull: true },
  academic_year_id: { type: DataTypes.INTEGER, allowNull: false },
  // The relevant Stream. Null = this allocation covers ALL Streams of that class.
  stream_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'class_subjects',
  indexes: [
    {
      // A subject should not be allocated twice to the same class/stream in the same year
      unique: true,
      fields: ['school_class_id', 'subject_id', 'academic_year_id', 'stream_id'],
      name: 'uniq_class_subject_year_stream',
    },
  ],
});

module.exports = ClassSubject;
