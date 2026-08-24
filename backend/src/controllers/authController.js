const jwt = require('jsonwebtoken');
const { User, Student } = require('../models');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid login credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid login credentials.' });
    }

    // If this is a student login, find the linked Student record so the
    // frontend and API know exactly whose data this account may access.
    let studentId = null;
    if (user.role === 'student') {
      const linkedStudent = await Student.findOne({ where: { user_id: user.id } });
      studentId = linkedStudent?.id || null;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, student_id: studentId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        student_id: studentId,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    let studentId = null;
    if (user?.role === 'student') {
      const linkedStudent = await Student.findOne({ where: { user_id: user.id } });
      studentId = linkedStudent?.id || null;
    }

    res.json({ ...user.toJSON(), student_id: studentId });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
