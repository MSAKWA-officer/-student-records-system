const { User } = require('../models');
const { Op } = require('sequelize');

const publicAttributes = { exclude: ['password'] };

// GET /api/users?search=&role=
exports.getAllUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const users = await User.findAll({
      where,
      attributes: publicAttributes,
      order: [['full_name', 'ASC']],
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.', error: err.message });
  }
};

// GET /api/users/:id
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: publicAttributes });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/users
// Body: { full_name, email, password, role, phone }
exports.createUser = async (req, res) => {
  try {
    const { full_name, email, password, role, phone } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Full name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const user = await User.create({
      full_name,
      email,
      password,
      role: role || 'teacher',
      phone: phone || null,
    });

    const { password: _pw, ...safeUser } = user.toJSON();
    res.status(201).json(safeUser);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    res.status(400).json({ message: 'Failed to add user.', error: err.message });
  }
};

// PUT /api/users/:id
// Body: any of { full_name, email, role, phone, is_active }
// Password is intentionally NOT accepted here - use /reset-password instead.
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { full_name, email, role, phone, is_active } = req.body;

    // Prevent an admin from locking themselves out by demoting/deactivating
    // their own last remaining admin account.
    if (req.user.id === user.id) {
      const wouldLoseAdmin =
        (role && role !== 'admin' && user.role === 'admin') ||
        (is_active === false && user.role === 'admin');

      if (wouldLoseAdmin) {
        const otherActiveAdmins = await User.count({
          where: { role: 'admin', is_active: true, id: { [Op.ne]: user.id } },
        });
        if (otherActiveAdmins === 0) {
          return res.status(400).json({
            message: 'You cannot remove yourself as the only remaining active admin.',
          });
        }
      }
    }

    await user.update({
      ...(full_name !== undefined && { full_name }),
      ...(email !== undefined && { email }),
      ...(role !== undefined && { role }),
      ...(phone !== undefined && { phone }),
      ...(is_active !== undefined && { is_active }),
    });

    const { password: _pw, ...safeUser } = user.toJSON();
    res.json(safeUser);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    res.status(400).json({ message: 'Failed to update user.', error: err.message });
  }
};

// PUT /api/users/:id/reset-password
// Body: { new_password }
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ message: 'The new password must be at least 8 characters.' });
    }

    user.password = new_password; // beforeUpdate hook hashes it
    await user.save();

    res.json({ message: 'Password changed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (req.user.id === user.id) {
      return res.status(400).json({ message: 'You cannot delete yourself.' });
    }

    if (user.role === 'admin') {
      const otherActiveAdmins = await User.count({
        where: { role: 'admin', is_active: true, id: { [Op.ne]: user.id } },
      });
      if (otherActiveAdmins === 0) {
        return res.status(400).json({ message: 'You cannot delete the only remaining active admin.' });
      }
    }

    await user.destroy();
    res.json({ message: 'User removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
