const mongoose = require('mongoose');

const inputNodeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  label: { type: String, required: true },
  factors: [{ type: String }], // Dropdown options
  dependsOn: { type: String, default: null }, // Which field this input depends on
  order: { type: Number, default: 0 }, // UI render order
});

module.exports = mongoose.model('InputNode', inputNodeSchema);
