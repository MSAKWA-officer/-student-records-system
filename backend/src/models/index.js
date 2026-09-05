const sequelize = require('../config/database');

const User = require('./User');
const AcademicYear = require('./AcademicYear');
const Term = require('./Term');
const SchoolClass = require('./SchoolClass');
const Stream = require('./Stream');
const Student = require('./Student');
const Enrollment = require('./Enrollment');
const Teacher = require('./Teacher');
const Subject = require('./Subject');
const TeacherSubject = require('./TeacherSubject');
const ClassSubject = require('./ClassSubject');
const Exam = require('./Exam');
const Result = require('./Result');
const Attendance = require('./Attendance');
const Announcement = require('./Announcement');
const ClassGateway = require('./ClassGateway');
const SmsLog = require('./SmsLog');

// --- Associations ---

// AcademicYear -> Term
AcademicYear.hasMany(Term, { foreignKey: 'academic_year_id' });
Term.belongsTo(AcademicYear, { foreignKey: 'academic_year_id' });

// SchoolClass -> Stream
SchoolClass.hasMany(Stream, { foreignKey: 'school_class_id' });
Stream.belongsTo(SchoolClass, { foreignKey: 'school_class_id' });

//Gateway for each class
SchoolClass.hasMany(ClassGateway, { foreignKey: 'class_id' });
ClassGateway.belongsTo(SchoolClass, { foreignKey: 'class_id' });

//SmsLog -> Student
Student.hasMany(SmsLog, { foreignKey: 'student_id' });
SmsLog.belongsTo(Student, { foreignKey: 'student_id' });

// Student -> Enrollment <- SchoolClass / Stream / AcademicYear
Student.hasMany(Enrollment, { foreignKey: 'student_id' });
Enrollment.belongsTo(Student, { foreignKey: 'student_id' });

SchoolClass.hasMany(Enrollment, { foreignKey: 'school_class_id' });
Enrollment.belongsTo(SchoolClass, { foreignKey: 'school_class_id' });

Stream.hasMany(Enrollment, { foreignKey: 'stream_id' });
Enrollment.belongsTo(Stream, { foreignKey: 'stream_id' });

AcademicYear.hasMany(Enrollment, { foreignKey: 'academic_year_id' });
Enrollment.belongsTo(AcademicYear, { foreignKey: 'academic_year_id' });

// Teacher <-> User (optional login link)
User.hasOne(Teacher, { foreignKey: 'user_id' });
Teacher.belongsTo(User, { foreignKey: 'user_id' });

//Announcement <-> User
User.hasMany(Announcement, { foreignKey: 'posted_by' });
Announcement.belongsTo(User, { foreignKey: 'posted_by' });

// Student <-> User (optional login link, for the 'student' role)
User.hasOne(Student, { foreignKey: 'user_id' });
Student.belongsTo(User, { foreignKey: 'user_id' });

// Teacher -> Stream (class teacher of)
Teacher.belongsTo(Stream, { foreignKey: 'is_class_teacher_of', as: 'homeroomStream' });

// Teacher <-> Subject (subject expertise / qualifications)
Teacher.belongsToMany(Subject, {
  through: TeacherSubject,
  foreignKey: 'teacher_id',
  otherKey: 'subject_id',
  as: 'subjectsExpertise',
});
Subject.belongsToMany(Teacher, {
  through: TeacherSubject,
  foreignKey: 'subject_id',
  otherKey: 'teacher_id',
  as: 'teachersWithExpertise',
});


// ClassSubject: SchoolClass <-> Subject <-> Teacher <-> AcademicYear <-> Stream
SchoolClass.hasMany(ClassSubject, { foreignKey: 'school_class_id' });
ClassSubject.belongsTo(SchoolClass, { foreignKey: 'school_class_id' });

Subject.hasMany(ClassSubject, { foreignKey: 'subject_id' });
ClassSubject.belongsTo(Subject, { foreignKey: 'subject_id' });

Teacher.hasMany(ClassSubject, { foreignKey: 'teacher_id' });
ClassSubject.belongsTo(Teacher, { foreignKey: 'teacher_id' });

AcademicYear.hasMany(ClassSubject, { foreignKey: 'academic_year_id' });
ClassSubject.belongsTo(AcademicYear, { foreignKey: 'academic_year_id' });

Stream.hasMany(ClassSubject, { foreignKey: 'stream_id' });
ClassSubject.belongsTo(Stream, { foreignKey: 'stream_id' });

// Exam -> Term
Term.hasMany(Exam, { foreignKey: 'term_id' });
Exam.belongsTo(Term, { foreignKey: 'term_id' });

// Result: Student <-> Exam <-> Subject
Student.hasMany(Result, { foreignKey: 'student_id' });
Result.belongsTo(Student, { foreignKey: 'student_id' });

Exam.hasMany(Result, { foreignKey: 'exam_id' });
Result.belongsTo(Exam, { foreignKey: 'exam_id' });

Subject.hasMany(Result, { foreignKey: 'subject_id' });
Result.belongsTo(Subject, { foreignKey: 'subject_id' });

// Attendance -> Student
Student.hasMany(Attendance, { foreignKey: 'student_id' });
Attendance.belongsTo(Student, { foreignKey: 'student_id' });

module.exports = {
  sequelize,
  User,
  AcademicYear,
  Term,
  SchoolClass,
  Stream,
  Student,
  Enrollment,
  Teacher,
  Subject,
  TeacherSubject,
  ClassSubject,
  Exam,
  Result,
  Attendance,
  Announcement,
  ClassGateway,
  SmsLog,
};
