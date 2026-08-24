const { SchoolClass, Stream, Enrollment } = require('../models');

// ---------- SchoolClass ----------

// GET /api/classes
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await SchoolClass.findAll({
      include: [{ model: Stream }],
      order: [['level', 'ASC'], ['name', 'ASC']],
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch classes.', error: err.message });
  }
};

// GET /api/classes/:id
exports.getClassById = async (req, res) => {
  try {
    const schoolClass = await SchoolClass.findByPk(req.params.id, {
      include: [{ model: Stream }],
    });
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });
    res.json(schoolClass);
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// POST /api/classes
exports.createClass = async (req, res) => {
  try {
    const { name, level, education_level } = req.body;
    const schoolClass = await SchoolClass.create({ name, level, education_level });
    res.status(201).json(schoolClass);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add the class.', error: err.message });
  }
};

// PUT /api/classes/:id
exports.updateClass = async (req, res) => {
  try {
    const schoolClass = await SchoolClass.findByPk(req.params.id);
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });
    await schoolClass.update(req.body);
    res.json(schoolClass);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the class.', error: err.message });
  }
};

// DELETE /api/classes/:id
exports.deleteClass = async (req, res) => {
  try {
    const schoolClass = await SchoolClass.findByPk(req.params.id);
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });

    const enrollmentCount = await Enrollment.count({ where: { school_class_id: schoolClass.id } });
    if (enrollmentCount > 0) {
      return res.status(409).json({ message: 'This class has enrolled students and cannot be deleted.' });
    }

    await schoolClass.destroy();
    res.json({ message: 'Class removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// ---------- Stream ----------

// GET /api/classes/:id/streams
exports.getStreamsForClass = async (req, res) => {
  try {
    const streams = await Stream.findAll({
      where: { school_class_id: req.params.id },
      order: [['name', 'ASC']],
    });
    res.json(streams);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch streams.', error: err.message });
  }
};

// POST /api/classes/:id/streams
exports.createStream = async (req, res) => {
  try {
    const schoolClass = await SchoolClass.findByPk(req.params.id);
    if (!schoolClass) return res.status(404).json({ message: 'Class not found.' });

    const stream = await Stream.create({
      name: req.body.name,
      school_class_id: req.params.id,
    });
    res.status(201).json(stream);
  } catch (err) {
    res.status(400).json({ message: 'Failed to add the stream.', error: err.message });
  }
};

// PUT /api/classes/streams/:streamId
exports.updateStream = async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.streamId);
    if (!stream) return res.status(404).json({ message: 'Stream not found.' });
    await stream.update({ name: req.body.name });
    res.json(stream);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update the stream.', error: err.message });
  }
};

// DELETE /api/classes/streams/:streamId
exports.deleteStream = async (req, res) => {
  try {
    const stream = await Stream.findByPk(req.params.streamId);
    if (!stream) return res.status(404).json({ message: 'Stream not found.' });

    const enrollmentCount = await Enrollment.count({ where: { stream_id: stream.id } });
    if (enrollmentCount > 0) {
      return res.status(409).json({ message: 'This stream has enrolled students and cannot be deleted.' });
    }

    await stream.destroy();
    res.json({ message: 'Stream removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
};