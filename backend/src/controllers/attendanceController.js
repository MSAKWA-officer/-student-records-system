const { Attendance, Student } = require('../models');
const { Op } = require('sequelize');

const includeRelations = [{ model: Student }];

// GET /api/attendance?student_id=&date=&start_date=&end_date=&status=
exports.getAllAttendance = async (req, res) => {
  try {
    const { student_id, date, start_date, end_date, status } = req.query;
    const where = {};
    if (student_id) where.student_id = student_id;
    if (status) where.status = status;
    if (date) {
      where.date = date;
    } else if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date[Op.gte] = start_date;
      if (end_date) where.date[Op.lte] = end_date;
    }

    const records = await Attendance.findAll({
      where,
      include: includeRelations,
      order: [['date', 'DESC']],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch attendance.', error: err.message });
  }
};

// GET /api/attendance/:id
exports.getAttendanceById = async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id, { include: includeRelations });
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/attendance
// Body: { student_id, date, status, notes }
exports.createAttendance = async (req, res) => {
  try {
    const { student_id, date, status, notes } = req.body;

    if (!student_id || !date) {
      return res.status(400).json({ message: 'Student and date are required.' });
    }

    const student = await Student.findByPk(student_id);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const record = await Attendance.create({
      student_id,
      date,
      status: status || 'present',
      notes: notes || null,
      recorded_by: req.user?.id || null,
    });

    const created = await Attendance.findByPk(record.id, { include: includeRelations });
    res.status(201).json(created);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Attendance for this student on this date already exists.' });
    }
    res.status(400).json({ message: 'Failed to add the attendance record.', error: err.message });
  }
};

// PUT /api/attendance/:id
exports.updateAttendance = async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });

    await record.update(req.body);
    const updated = await Attendance.findByPk(record.id, { include: includeRelations });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update attendance.', error: err.message });
  }
};

// DELETE /api/attendance/:id
exports.deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });

    await record.destroy();
    res.json({ message: 'Attendance record removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
