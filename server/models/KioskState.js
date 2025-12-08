const mongoose = require('mongoose');

const kioskStateSchema = new mongoose.Schema({
  kioskId: {
    type: String,
    default: 'default',
    unique: true
  },
  currentReminderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder',
    default: null
  },
  currentView: {
    type: String,
    enum: ['idle', 'reminder', 'completed', 'missed'],
    default: 'idle'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  screenOn: {
    type: Boolean,
    default: true
  },
  connectedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('KioskState', kioskStateSchema);
