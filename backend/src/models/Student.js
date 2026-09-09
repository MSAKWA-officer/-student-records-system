const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true }, // linked login account, optional
  admission_number: { type: DataTypes.STRING, allowNull: false, unique: true },
  first_name: { type: DataTypes.STRING, allowNull: false },
  middle_name: { type: DataTypes.STRING },
  last_name: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.ENUM('male', 'female'), allowNull: false },
  date_of_birth: { type: DataTypes.DATEONLY },
  guardian_name: { type: DataTypes.STRING },
  guardian_phone: { type: DataTypes.STRING },
  guardian_relationship: { type: DataTypes.STRING }, // father, mother, guardian
  address: { type: DataTypes.STRING },
  admission_date: { type: DataTypes.DATEONLY },
  photo_url: { type: DataTypes.STRING },
  status: {
    type: DataTypes.ENUM('active', 'transferred', 'graduated', 'dropped'),
    defaultValue: 'active',
  },
  // Incoming transfers — a student who joined from another school, as
  // opposed to `status: 'transferred'` above which is about a student
  // LEAVING this school.
  is_transfer_student: { type: DataTypes.BOOLEAN, defaultValue: false },
  previous_school_name: { type: DataTypes.STRING },
  previous_class_level: { type: DataTypes.STRING }, // e.g. "Form 2" at their old school
  transfer_date: { type: DataTypes.DATEONLY },
  transfer_certificate_no: { type: DataTypes.STRING },
}, { tableName: 'students' });

module.exports = Student;
