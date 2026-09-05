const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Student, PasswordReset } = require('../models');
const { sendPasswordResetEmail } = require('../services/mailService');

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

// POST /api/auth/forgot-password
// Body: { email }
// Always responds with a generic success message — never reveals whether
// the email exists, to avoid leaking which accounts are registered.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ where: { email } });

    if (user && user.is_active) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires_at = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await PasswordReset.create({ user_id: user.id, token, expires_at });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      try {
        await sendPasswordResetEmail(user.email, resetLink);
      } catch (mailErr) {
        console.error('Failed to send reset email:', mailErr.message);
        // Don't leak the mail-sending error to the client either.
      }
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/auth/reset-password
// Body: { token, new_password }
exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ message: 'Token and new password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ message: 'The new password must be at least 8 characters.' });
    }

    const reset = await PasswordReset.findOne({
      where: { token, used: false, expires_at: { [Op.gt]: new Date() } },
    });

    if (!reset) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }

    const user = await User.findByPk(reset.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.password = new_password; // beforeUpdate hook hashes it
    await user.save();

    reset.used = true;
    await reset.save();

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
