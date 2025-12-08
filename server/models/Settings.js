const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  settingsId: {
    type: String,
    default: 'default',
    unique: true
  },
  reminderLeadTime: {
    type: Number,
    default: 30,
    min: 0,
    max: 120
  },
  displayOnly: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
