import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'

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

  useEffect(() => {
    fetchReminders()
    fetchCompletions()
    fetchKioskState()

    socket.emit('caregiver-connect')

    socket.on('reminders-updated', () => {
      fetchReminders()
      fetchCompletions()
    })

    socket.on('kiosk-state-update', (state) => {
      setKioskState(state)
    })

    return () => {
      socket.off('reminders-updated')
      socket.off('kiosk-state-update')
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
        <p>Manage medication reminders and monitor activity</p>
        <nav className="dashboard-nav">
          <Link to="/caregiver" className="active">Dashboard</Link>
          <Link to="/mirror">Mirror View</Link>
          <Link to="/">Kiosk Preview</Link>
        </nav>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-grid">
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

          {/* Recent Activity */}
          <div className="dashboard-card">
            <h2>Recent Activity (7 days)</h2>
            {completions.length > 0 ? (
              <div className="activity-list">
                {completions.slice(0, 10).map(completion => (
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

          {/* Reminders */}
          <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
            <h2>
              Reminders
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
        </div>
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
