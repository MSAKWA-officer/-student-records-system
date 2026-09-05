const axios = require('axios');
const { ClassGateway } = require('../models');

function normalizePhone(phone) {
  let p = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '255' + p.slice(1);
  return p;
}

async function getGatewayForClass(classId) {
  const gateway = await ClassGateway.findOne({
    where: { class_id: classId, is_active: true },
  });
  if (!gateway) {
    throw new Error(`Hakuna SMS gateway iliyosanidiwa kwa darasa hili (class_id: ${classId})`);
  }
  return gateway;
}

async function sendSms(classId, phone, message) {
  const gateway = await getGatewayForClass(classId);
  const to = normalizePhone(phone);

  const response = await axios.post(
    `${gateway.gateway_url}/send`,
    { phoneNumbers: [to], message },
    {
      headers: gateway.gateway_api_key
        ? { Authorization: `Bearer ${gateway.gateway_api_key}` }
        : {},
      timeout: 10000,
    }
  );

  return response.data;
}

module.exports = { sendSms, normalizePhone };