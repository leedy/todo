const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  time: {
    type: String,
    required: true // Format: "HH:MM" (24-hour)
  },
  days: {
    type: [String],
    default: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  },
  type: {
    type: String,
    enum: ['medication', 'task', 'appointment'],
    default: 'medication'
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reminder', reminderSchema);
