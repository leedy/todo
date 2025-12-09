import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import CalendarHeatMap from '../components/CalendarHeatMap'
import ReminderPerformance from '../components/ReminderPerformance'

const socket = io()

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' }
]

function CaregiverDashboard() {
  const [reminders, setReminders] = useState([])
  const [completions, setCompletions] = useState([])
  const [kioskState, setKioskState] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingReminder, setEditingReminder] = useState(null)
  const [settings, setSettings] = useState({ reminderLeadTime: 0, displayOnly: false, autoSkipTimeout: 0 })
  const [activeTab, setActiveTab] = useState('overview')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    time: '08:00',
    type: 'medication',
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    active: true
  })

  // Fetch data
  const fetchReminders = async () => {
    const res = await fetch('/api/reminders')
    const data = await res.json()
    setReminders(data)
  }

  const fetchCompletions = async () => {
    const res = await fetch('/api/completions?days=7')
    const data = await res.json()
    setCompletions(data)
  }

  const fetchKioskState = async () => {
    const res = await fetch('/api/kiosk/state')
    const data = await res.json()
    setKioskState(data)
  }

  const fetchSettings = async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data)
  }

  const updateLeadTime = async (minutes) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderLeadTime: minutes })
    })
  }

  const updateDisplayOnly = async (enabled) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayOnly: enabled })
    })
  }

  const updateAutoSkipTimeout = async (minutes) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoSkipTimeout: minutes })
    })
  }

  useEffect(() => {
    fetchReminders()
    fetchCompletions()
    fetchKioskState()
    fetchSettings()

    socket.emit('caregiver-connect')

    socket.on('reminders-updated', () => {
      fetchReminders()
      fetchCompletions()
    })

    socket.on('kiosk-state-update', (state) => {
      setKioskState(state)
    })

    socket.on('settings-updated', (newSettings) => {
      setSettings(newSettings)
    })

    return () => {
      socket.off('reminders-updated')
      socket.off('kiosk-state-update')
      socket.off('settings-updated')
    }
  }, [])

  // Form handlers
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      time: '08:00',
      type: 'medication',
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      active: true
    })
    setEditingReminder(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (reminder) => {
    setFormData({
      title: reminder.title,
      description: reminder.description || '',
      time: reminder.time,
      type: reminder.type,
      days: reminder.days,
      active: reminder.active
    })
    setEditingReminder(reminder)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const url = editingReminder
      ? `/api/reminders/${editingReminder._id}`
      : '/api/reminders'

    const method = editingReminder ? 'PUT' : 'POST'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    closeModal()
    fetchReminders()
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return

    await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    fetchReminders()
  }

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }))
  }

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const isKioskOnline = kioskState?.connectedAt &&
    (new Date() - new Date(kioskState.lastActivity)) < 120000 // 2 minutes

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Caregiver Dashboard</h1>
        <div className="header-status">
          <div className={`status-indicator ${isKioskOnline ? 'online' : 'offline'}`}></div>
          <span>Kiosk {isKioskOnline ? 'Online' : 'Offline'}</span>
        </div>
        <nav className="dashboard-nav">
          <Link to="/mirror">Mirror View</Link>
          <Link to="/">Kiosk Preview</Link>
        </nav>
      </header>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveTab('reminders')}
        >
          Reminders
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      <main className="dashboard-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="dashboard-grid">
            {/* Today's Summary */}
            <div className="dashboard-card">
              <h2>Today's Reminders</h2>
              {reminders.length > 0 ? (
                <div className="reminder-list compact">
                  {reminders.map(reminder => (
                    <div key={reminder._id} className="reminder-item compact">
                      <div className="reminder-item-time">
                        {formatTime(reminder.time)}
                      </div>
                      <div className="reminder-item-info">
                        <div className="reminder-item-title">{reminder.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No reminders configured</p>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="dashboard-card">
              <h2>Recent Activity</h2>
              {completions.length > 0 ? (
                <div className="activity-list">
                  {completions.slice(0, 8).map(completion => (
                    <div key={completion._id} className="activity-item">
                      <div className={`activity-icon ${completion.status}`}>
                        {completion.status === 'completed' ? '✓' : '✗'}
                      </div>
                      <div className="activity-info">
                        <div className="activity-title">
                          {completion.reminderId?.title || 'Unknown'}
                        </div>
                        <div className="activity-time">
                          {formatDateTime(completion.completedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No activity recorded yet</p>
                </div>
              )}
            </div>

            {/* Compliance Calendar */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <h2>Compliance Calendar (Last 30 Days)</h2>
              <CalendarHeatMap days={30} />
            </div>
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="dashboard-card" style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2>
              Manage Reminders
              <button className="btn btn-primary" onClick={openAddModal}>
                + Add Reminder
              </button>
            </h2>
            {reminders.length > 0 ? (
              <div className="reminder-list">
                {reminders.map(reminder => (
                  <div key={reminder._id} className="reminder-item">
                    <div className="reminder-item-time">
                      {formatTime(reminder.time)}
                    </div>
                    <div className="reminder-item-info">
                      <div className="reminder-item-title">
                        {reminder.title}
                        {!reminder.active && (
                          <span style={{ color: '#999', marginLeft: 10 }}>(inactive)</span>
                        )}
                      </div>
                      <div className="reminder-item-days">
                        {reminder.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                      </div>
                    </div>
                    <div className="reminder-item-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEditModal(reminder)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(reminder._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>No reminders yet. Add your first reminder to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="dashboard-grid">
            {/* Compliance Calendar */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <h2>Compliance Calendar (Last 30 Days)</h2>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: 10 }}>
                Click on a day to see details. Green = 90%+ completed, Yellow = 50-89%, Red = under 50%
              </p>
              <CalendarHeatMap days={30} />
            </div>

            {/* Reminder Performance */}
            <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
              <h2>Reminder Performance (Last 30 Days)</h2>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: 10 }}>
                See which reminders are being completed vs missed. Sorted by lowest completion rate first.
              </p>
              <ReminderPerformance days={30} />
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-grid">
            {/* Kiosk Status */}
            <div className="dashboard-card">
              <h2>Kiosk Status</h2>
              <div className="kiosk-status">
                <div className={`status-indicator ${isKioskOnline ? 'online' : 'offline'}`}></div>
                <div>
                  <strong>{isKioskOnline ? 'Online' : 'Offline'}</strong>
                  {kioskState?.lastActivity && (
                    <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                      Last activity: {formatDateTime(kioskState.lastActivity)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Reminder Lead Time */}
            <div className="dashboard-card">
              <h2>Reminder Lead Time</h2>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 10 }}>
                Show reminders this many minutes before scheduled time
              </p>
              <select
                value={settings.reminderLeadTime || 0}
                onChange={(e) => updateLeadTime(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '1rem',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              >
                <option value={0}>At scheduled time (no lead)</option>
                <option value={5}>5 minutes early</option>
                <option value={10}>10 minutes early</option>
                <option value={15}>15 minutes early</option>
                <option value={30}>30 minutes early</option>
                <option value={45}>45 minutes early</option>
                <option value={60}>1 hour early</option>
                <option value={90}>1.5 hours early</option>
                <option value={120}>2 hours early</option>
              </select>
            </div>

            {/* Display Mode */}
            <div className="dashboard-card">
              <h2>Display Mode</h2>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.displayOnly || false}
                  onChange={(e) => updateDisplayOnly(e.target.checked)}
                  style={{ width: 'auto', marginTop: 3 }}
                />
                <div>
                  <strong>Display only (no buttons)</strong>
                  <p style={{ fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0' }}>
                    Hide action buttons on kiosk. Reminders will auto-complete when the next reminder becomes due.
                  </p>
                </div>
              </label>
            </div>

            {/* Auto-Skip Timeout */}
            <div className="dashboard-card">
              <h2>Auto-Skip Timeout</h2>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 10 }}>
                Automatically skip reminders if not completed within this time
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  value={Math.floor((settings.autoSkipTimeout || 0) / 60)}
                  onChange={(e) => {
                    const hours = parseInt(e.target.value)
                    const currentMinutes = (settings.autoSkipTimeout || 0) % 60
                    updateAutoSkipTimeout(hours * 60 + currentMinutes)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '1rem',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  {[...Array(13)].map((_, i) => (
                    <option key={i} value={i}>{i} hr</option>
                  ))}
                </select>
                <select
                  value={(settings.autoSkipTimeout || 0) % 60}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value)
                    const currentHours = Math.floor((settings.autoSkipTimeout || 0) / 60)
                    updateAutoSkipTimeout(currentHours * 60 + minutes)
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '1rem',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  {[0, 5, 10, 15, 20, 30, 45].map(m => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
              {(settings.autoSkipTimeout || 0) === 0 && (
                <p style={{ fontSize: '0.8rem', color: '#999', marginTop: 8 }}>
                  Set to 0 hr 0 min to disable auto-skip
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingReminder ? 'Edit Reminder' : 'Add Reminder'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Morning pills"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Take with food"
                />
              </div>

              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="medication">Medication</option>
                  <option value="task">Task</option>
                  <option value="appointment">Appointment</option>
                </select>
              </div>

              <div className="form-group">
                <label>Days</label>
                <div className="days-selector">
                  {DAYS.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      className={`day-btn ${formData.days.includes(day.key) ? 'selected' : ''}`}
                      onClick={() => toggleDay(day.key)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Active
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingReminder ? 'Save Changes' : 'Add Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CaregiverDashboard
