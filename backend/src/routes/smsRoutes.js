const express = require('express');

const router = express.Router();

// GET /api/sms
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SMS API is working.'
  });
});

// POST /api/sms/send
router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required.'
      });
    }

    // SMS sending logic itawekwa hapa
    // Mfano: Africa's Talking, Beem, Twilio, n.k.

    return res.json({
      success: true,
      message: 'SMS request received.',
      data: {
        phone,
        message
      }
    });
  } catch (error) {
    console.error('SMS Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to process SMS request.'
    });
  }
});

module.exports = router;