require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./database');
const Reminder = require('./models/Reminder');
const Completion = require('./models/Completion');
const KioskState = require('./models/KioskState');
const Settings = require('./models/Settings');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5176'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 5177;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the built frontend (production only)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  console.log('Production mode: Serving frontend from /dist');
} else {
  console.log('Development mode: API-only, use separate frontend dev server.');
}

// Connect to MongoDB
connectDB();

// Helper: Get today's day abbreviation
const getDayAbbr = () => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date().getDay()];
};

// Helper: Get current time as HH:MM
const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// Helper: Broadcast kiosk state to all mirror views
const broadcastKioskState = async () => {
  const state = await KioskState.findOne({ kioskId: 'default' }).populate('currentReminderId');
  io.emit('kiosk-state-update', state);
};

// ============ REST API ROUTES ============

// Get all reminders
app.get('/api/reminders', async (req, res) => {
  try {
    const reminders = await Reminder.find().sort({ time: 1 });
    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single reminder
app.get('/api/reminders/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    res.json(reminder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create reminder
app.post('/api/reminders', async (req, res) => {
  try {
    const reminder = new Reminder(req.body);
    await reminder.save();
    io.emit('reminders-updated');
    res.status(201).json(reminder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update reminder
app.put('/api/reminders/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    io.emit('reminders-updated');
    res.json(reminder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete reminder
app.delete('/api/reminders/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndDelete(req.params.id);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    io.emit('reminders-updated');
    res.json({ message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's reminders for kiosk
app.get('/api/kiosk/today', async (req, res) => {
  try {
    const today = getDayAbbr();
    const reminders = await Reminder.find({
      active: true,
      days: today
    }).sort({ time: 1 });

    // Get today's completions
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const completions = await Completion.find({
      scheduledFor: { $gte: startOfDay, $lte: endOfDay }
    });

    const completedIds = completions.map(c => c.reminderId.toString());

    const remindersWithStatus = reminders.map(r => ({
      ...r.toObject(),
      isCompleted: completedIds.includes(r._id.toString())
    }));

    res.json(remindersWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark reminder as complete (kiosk action)
app.post('/api/kiosk/complete/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const now = new Date();
    const scheduledFor = new Date();
    const [hours, minutes] = reminder.time.split(':');
    scheduledFor.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const completion = new Completion({
      reminderId: reminder._id,
      status: 'completed',
      scheduledFor,
      completedAt: now
    });
    await completion.save();

    io.emit('reminder-completed', { reminderId: reminder._id, completion });
    io.emit('reminders-updated');
    await broadcastKioskState();

    res.json({ message: 'Reminder completed', completion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark reminder as skipped (kiosk action)
app.post('/api/kiosk/skip/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

    const now = new Date();
    const scheduledFor = new Date();
    const [hours, minutes] = reminder.time.split(':');
    scheduledFor.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const completion = new Completion({
      reminderId: reminder._id,
      status: 'skipped',
      scheduledFor,
      completedAt: now
    });
    await completion.save();

    io.emit('reminder-skipped', { reminderId: reminder._id, completion });
    io.emit('reminders-updated');
    await broadcastKioskState();

    res.json({ message: 'Reminder skipped', completion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get completion history
app.get('/api/completions', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const completions = await Completion.find({
      scheduledFor: { $gte: startDate }
    })
      .populate('reminderId')
      .sort({ scheduledFor: -1 });

    res.json(completions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily stats for calendar heat map
app.get('/api/stats/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // Get all active reminders to know expected counts per day
    const reminders = await Reminder.find({ active: true });

    // Build a map of day -> expected reminder count
    const expectedByDay = {};
    dayNames.forEach(day => {
      expectedByDay[day] = reminders.filter(r => r.days.includes(day)).length;
    });

    // Get completions for the date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const completions = await Completion.find({
      scheduledFor: { $gte: startDate }
    });

    // Group completions by date
    const statsByDate = {};

    // Initialize all dates in range
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = dayNames[date.getDay()];

      statsByDate[dateStr] = {
        date: dateStr,
        expected: expectedByDay[dayOfWeek],
        completed: 0,
        skipped: 0
      };
    }

    // Count completions
    completions.forEach(c => {
      const dateStr = c.scheduledFor.toISOString().split('T')[0];
      if (statsByDate[dateStr]) {
        if (c.status === 'completed') {
          statsByDate[dateStr].completed++;
        } else if (c.status === 'skipped') {
          statsByDate[dateStr].skipped++;
        }
      }
    });

    // Convert to array and sort by date
    const result = Object.values(statsByDate).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get per-reminder performance stats
app.get('/api/stats/reminders', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    // Get all reminders (including inactive for historical data)
    const reminders = await Reminder.find();

    // Get completions for the date range
    const completions = await Completion.find({
      scheduledFor: { $gte: startDate }
    });

    // Calculate stats for each reminder
    const reminderStats = reminders.map(reminder => {
      // Count how many days this reminder was scheduled
      let expectedCount = 0;
      for (let i = 0; i < parseInt(days); i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayOfWeek = dayNames[date.getDay()];
        if (reminder.days.includes(dayOfWeek)) {
          expectedCount++;
        }
      }

      // Count completions for this reminder
      const reminderCompletions = completions.filter(
        c => c.reminderId.toString() === reminder._id.toString()
      );
      const completedCount = reminderCompletions.filter(c => c.status === 'completed').length;
      const skippedCount = reminderCompletions.filter(c => c.status === 'skipped').length;

      return {
        _id: reminder._id,
        title: reminder.title,
        time: reminder.time,
        type: reminder.type,
        active: reminder.active,
        expected: expectedCount,
        completed: completedCount,
        skipped: skippedCount,
        missed: Math.max(0, expectedCount - completedCount - skippedCount),
        completionRate: expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0
      };
    });

    // Sort by completion rate (lowest first to highlight problems)
    reminderStats.sort((a, b) => a.completionRate - b.completionRate);

    res.json(reminderStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed stats for a specific day
app.get('/api/stats/day/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    const targetDate = new Date(date + 'T12:00:00');
    const dayOfWeek = dayNames[targetDate.getDay()];

    // Get reminders scheduled for this day of week
    const reminders = await Reminder.find({
      days: dayOfWeek
    }).sort({ time: 1 });

    // Get completions for this specific day
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');

    const completions = await Completion.find({
      scheduledFor: { $gte: startOfDay, $lte: endOfDay }
    });

    // Build detailed list
    const details = reminders.map(reminder => {
      const completion = completions.find(
        c => c.reminderId.toString() === reminder._id.toString()
      );

      return {
        _id: reminder._id,
        title: reminder.title,
        time: reminder.time,
        type: reminder.type,
        status: completion ? completion.status : 'missed',
        completedAt: completion?.completedAt || null
      };
    });

    res.json({
      date,
      dayOfWeek,
      reminders: details,
      summary: {
        total: details.length,
        completed: details.filter(d => d.status === 'completed').length,
        skipped: details.filter(d => d.status === 'skipped').length,
        missed: details.filter(d => d.status === 'missed').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get kiosk state
app.get('/api/kiosk/state', async (req, res) => {
  try {
    let state = await KioskState.findOne({ kioskId: 'default' }).populate('currentReminderId');
    if (!state) {
      state = new KioskState({ kioskId: 'default' });
      await state.save();
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne({ settingsId: 'default' });
    if (!settings) {
      settings = new Settings({ settingsId: 'default' });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
app.put('/api/settings', async (req, res) => {
  try {
    const { reminderLeadTime, displayOnly, autoSkipTimeout } = req.body;
    const updateFields = {};
    if (reminderLeadTime !== undefined) updateFields.reminderLeadTime = reminderLeadTime;
    if (displayOnly !== undefined) updateFields.displayOnly = displayOnly;
    if (autoSkipTimeout !== undefined) updateFields.autoSkipTimeout = autoSkipTimeout;

    const settings = await Settings.findOneAndUpdate(
      { settingsId: 'default' },
      updateFields,
      { new: true, upsert: true, runValidators: true }
    );
    io.emit('settings-updated', settings);
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============ SOCKET.IO ============

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Kiosk connects
  socket.on('kiosk-connect', async () => {
    socket.join('kiosk');
    await KioskState.findOneAndUpdate(
      { kioskId: 'default' },
      { connectedAt: new Date(), lastActivity: new Date() },
      { upsert: true }
    );
    await broadcastKioskState();
    console.log('Kiosk connected');
  });

  // Caregiver dashboard connects
  socket.on('caregiver-connect', () => {
    socket.join('caregivers');
    console.log('Caregiver connected');
  });

  // Mirror view connects
  socket.on('mirror-connect', async () => {
    socket.join('mirrors');
    await broadcastKioskState();
    console.log('Mirror view connected');
  });

  // Kiosk updates its state
  socket.on('kiosk-state-change', async (data) => {
    await KioskState.findOneAndUpdate(
      { kioskId: 'default' },
      { ...data, lastActivity: new Date() },
      { upsert: true }
    );
    await broadcastKioskState();
  });

  // Kiosk activity (tap, etc)
  socket.on('kiosk-activity', async () => {
    await KioskState.findOneAndUpdate(
      { kioskId: 'default' },
      { lastActivity: new Date() }
    );
    await broadcastKioskState();
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ============ REMINDER SCHEDULER ============

// Check for due reminders every minute
setInterval(async () => {
  try {
    const today = getDayAbbr();
    const currentTime = getCurrentTime();

    const dueReminders = await Reminder.find({
      active: true,
      days: today,
      time: currentTime
    });

    if (dueReminders.length > 0) {
      // Get today's completions to filter out already completed
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const completions = await Completion.find({
        scheduledFor: { $gte: startOfDay },
        reminderId: { $in: dueReminders.map(r => r._id) }
      });
      const completedIds = completions.map(c => c.reminderId.toString());

      const pendingReminders = dueReminders.filter(
        r => !completedIds.includes(r._id.toString())
      );

      if (pendingReminders.length > 0) {
        io.to('kiosk').emit('reminder-due', pendingReminders[0]);
        await KioskState.findOneAndUpdate(
          { kioskId: 'default' },
          {
            currentReminderId: pendingReminders[0]._id,
            currentView: 'reminder'
          }
        );
        await broadcastKioskState();
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}, 60000); // Check every minute

// Catch-all route for React Router (production only, must be after API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Kiosk view: http://localhost:${PORT}`);
  console.log(`Caregiver dashboard: http://localhost:${PORT}/caregiver`);
});
