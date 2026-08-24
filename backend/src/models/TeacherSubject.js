const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Subjects the teacher is qualified in / has expertise in
const TeacherSubject = sequelize.define('TeacherSubject', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  teacher_id: { type: DataTypes.INTEGER, allowNull: false },
  subject_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'teacher_subjects',
  indexes: [
    { unique: true, fields: ['teacher_id', 'subject_id'], name: 'uniq_teacher_subject' },
  ],
});

module.exports = TeacherSubject;
