const { Student, SmsLog } = require('../models');
const { sendSms } = require('../services/smsService');

exports.sendResultSms = async (req, res) => {
  try {
    const { student_id, average, division } = req.body;
    const student = await Student.findByPk(student_id);
    if (!student) return res.status(404).json({ message: 'Mwanafunzi hakupatikana' });
    if (!student.guardian_phone) {
      return res.status(400).json({ message: 'Mzazi/mlezi hana namba ya simu' });
    }

    const message = `SIMS: Matokeo ya ${student.first_name} ${student.last_name} - Wastani: ${average}%, Daraja: ${division}. Asante.`;

    const log = await SmsLog.create({
      student_id, phone: student.guardian_phone, message, status: 'pending',
    });

    try {
      await sendSms(student.school_class_id, student.guardian_phone, message);
      await log.update({ status: 'sent', sent_at: new Date() });
      res.json({ message: 'SMS imetumwa', log });
    } catch (err) {
      await log.update({ status: 'failed', error_message: err.message });
      res.status(500).json({ message: 'Imeshindwa kutuma SMS', error: err.message });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.sendClassResultsSms = async (req, res) => {
  try {
    const { class_id } = req.body;
    const students = await Student.findAll({ where: { school_class_id: class_id } });

    const results = [];
    for (const student of students) {
      if (!student.guardian_phone) {
        results.push({ student_id: student.id, status: 'skipped', reason: 'no phone' });
        continue;
      }

      const message = `SIMS: Taarifa ya matokeo ya ${student.first_name} ${student.last_name} tayari. Wasiliana na shule kwa maelezo zaidi.`;

      try {
        await sendSms(class_id, student.guardian_phone, message);
        await SmsLog.create({ student_id: student.id, phone: student.guardian_phone, message, status: 'sent', sent_at: new Date() });
        results.push({ student_id: student.id, status: 'sent' });
      } catch (err) {
        await SmsLog.create({ student_id: student.id, phone: student.guardian_phone, message, status: 'failed', error_message: err.message });
        results.push({ student_id: student.id, status: 'failed', reason: err.message });
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    res.json({ message: 'Utumaji umekamilika', results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};