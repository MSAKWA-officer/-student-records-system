const { ClassGateway, SchoolClass } = require('../models');

exports.getAllGateways = async (req, res) => {
  try {
    const gateways = await ClassGateway.findAll({ include: [SchoolClass] });
    res.json(gateways);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createGateway = async (req, res) => {
  try {
    const { class_id, gateway_name, gateway_url, gateway_api_key } = req.body;
    const gateway = await ClassGateway.create({ class_id, gateway_name, gateway_url, gateway_api_key });
    res.status(201).json(gateway);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateGateway = async (req, res) => {
  try {
    const { id } = req.params;
    const gateway = await ClassGateway.findByPk(id);
    if (!gateway) return res.status(404).json({ message: 'Gateway haikupatikana' });
    await gateway.update(req.body);
    res.json(gateway);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteGateway = async (req, res) => {
  try {
    const { id } = req.params;
    const gateway = await ClassGateway.findByPk(id);
    if (!gateway) return res.status(404).json({ message: 'Gateway haikupatikana' });
    await gateway.destroy();
    res.json({ message: 'Gateway imefutwa' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};