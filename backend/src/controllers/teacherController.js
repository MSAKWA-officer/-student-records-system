const { Teacher, Stream, ClassSubject, Subject, User } = require('../models');
const { Op } = require('sequelize');

const includeRelations = [
  { model: Stream, as: 'homeroomStream' },
  { model: Subject, as: 'subjectsExpertise', through: { attributes: [] } },
];

// GET /api/teachers?search=
exports.getAllTeachers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};
    if (search) {
      where[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { staff_number: { [Op.like]: `%${search}%` } },
      ];
    }

    const teachers = await Teacher.findAll({
      where,
      include: includeRelations,
      order: [['full_name', 'ASC']],
    });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch teachers.', error: err.message });
  }
};

// GET /api/teachers/:id
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findByPk(req.params.id, {
      include: includeRelations,
    });
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/teachers
// Body: { staff_number, full_name, phone, email, qualification, is_class_teacher_of, subject_ids: [] }
exports.createTeacher = async (req, res) => {
  try {
    const { staff_number, full_name, phone, email, qualification, is_class_teacher_of, subject_ids } = req.body;

    if (phone) {
      const phoneTaken = await Teacher.findOne({ where: { phone } });
      if (phoneTaken) {
        return res.status(409).json({ message: 'This phone number is already registered to another teacher.' });
      }
    }

    const teacher = await Teacher.create({
      staff_number,
      full_name,
      phone: phone || null,
      email,
      qualification,
      is_class_teacher_of: is_class_teacher_of || null,
    });

    if (Array.isArray(subject_ids)) {
      await teacher.setSubjectsExpertise(subject_ids);
    }

    const full = await Teacher.findByPk(teacher.id, { include: includeRelations });
    res.status(201).json(full);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = err.errors?.[0]?.path;
      if (field === 'phone') {
        return res.status(409).json({ message: 'This phone number is already registered to another teacher.' });
      }
      return res.status(409).json({ message: 'Staff number already exists.' });
    }
    res.status(400).json({ message: 'Failed to add teacher.', error: err.message });
  }
};

// PUT /api/teachers/:id
exports.updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByPk(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });

    const { subject_ids, phone, ...rest } = req.body;

    if (phone) {
      const phoneTaken = await Teacher.findOne({ where: { phone, id: { [Op.ne]: teacher.id } } });
      if (phoneTaken) {
        return res.status(409).json({ message: 'This phone number is already registered to another teacher.' });
      }
    }

    await teacher.update({ ...rest, phone: phone || null });

    if (Array.isArray(subject_ids)) {
      await teacher.setSubjectsExpertise(subject_ids);
    }

    const full = await Teacher.findByPk(teacher.id, { include: includeRelations });
    res.json(full);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = err.errors?.[0]?.path;
      if (field === 'phone') {
        return res.status(409).json({ message: 'This phone number is already registered to another teacher.' });
      }
      return res.status(409).json({ message: 'Staff number already exists.' });
    }
    res.status(400).json({ message: 'Failed to update teacher.', error: err.message });
  }
};

// DELETE /api/teachers/:id
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByPk(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });

    const usageCount = await ClassSubject.count({ where: { teacher_id: teacher.id } });
    if (usageCount > 0) {
      return res.status(409).json({ message: 'This teacher is already assigned to subjects and cannot be deleted.' });
    }

    await teacher.destroy();
    res.json({ message: 'Teacher removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/teachers/:id/create-login
// Body: { email, password }
// Creates a User account with role 'teacher' linked to this teacher record,
// so an already-registered teacher can be given a login without re-entering
// their details as a disconnected, separate account.
exports.createLogin = async (req, res) => {
  try {
    const teacher = await Teacher.findByPk(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found.' });

    if (teacher.user_id) {
      return res.status(400).json({ message: 'This teacher already has a login account.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const user = await User.create({
      full_name: teacher.full_name,
      email,
      password,
      role: 'teacher',
    });

    teacher.user_id = user.id;
    await teacher.save();

    res.status(201).json({ message: 'Teacher account created.', email: user.email });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    res.status(400).json({ message: 'Failed to create the account.', error: err.message });
  }
};
