const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Records which specific subjects a student takes for a given Enrollment
// (i.e. for their class + academic year). Not every student in a class
// takes every subject allocated to that class (ClassSubject) — some
// subjects are optional/elective, so each student's actual subject list
// is chosen at enrollment time and stored here.
const EnrollmentSubject = sequelize.define('EnrollmentSubject', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  enrollment_id: { type: DataTypes.INTEGER, allowNull: false },
  subject_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'enrollment_subjects',
  indexes: [
    { unique: true, fields: ['enrollment_id', 'subject_id'] },
  ],
});

module.exports = EnrollmentSubject;
