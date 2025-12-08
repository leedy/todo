const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
  reminderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'missed', 'snoozed', 'skipped'],
    default: 'completed'
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient querying by date
completionSchema.index({ scheduledFor: -1 });
completionSchema.index({ reminderId: 1, scheduledFor: -1 });

module.exports = mongoose.model('Completion', completionSchema);
