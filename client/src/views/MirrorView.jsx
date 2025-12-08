import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'

const socket = io()

function MirrorView() {
  const [kioskState, setKioskState] = useState(null)
  const [reminders, setReminders] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [leadTime, setLeadTime] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchReminders = async () => {
    const res = await fetch('/api/kiosk/today')
    const data = await res.json()
    setReminders(data)
  }

  const fetchKioskState = async () => {
    const res = await fetch('/api/kiosk/state')
    const data = await res.json()
    setKioskState(data)
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setLeadTime(data.reminderLeadTime || 0)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  useEffect(() => {
    fetchReminders()
    fetchKioskState()
    fetchSettings()

    socket.emit('mirror-connect')

    socket.on('kiosk-state-update', (state) => {
      setKioskState(state)
    })

    socket.on('reminders-updated', fetchReminders)

    socket.on('settings-updated', (settings) => {
      setLeadTime(settings.reminderLeadTime || 0)
    })

    return () => {
      socket.off('kiosk-state-update')
      socket.off('reminders-updated')
      socket.off('settings-updated')
    }
  }, [])

  const isKioskOnline = kioskState?.connectedAt &&
    (new Date() - new Date(kioskState.lastActivity)) < 120000

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatReminderTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Mirror the same logic as KioskView - find pending reminders based on time
  const now = new Date()
  // Add lead time to current time for comparison
  const adjustedTime = new Date(now.getTime() + leadTime * 60 * 1000)
  const adjustedTimeStr = `${String(adjustedTime.getHours()).padStart(2, '0')}:${String(adjustedTime.getMinutes()).padStart(2, '0')}`

  // Find the active reminder (same logic as kiosk, with lead time)
  const activeReminder = reminders.find(r => !r.isCompleted && r.time <= adjustedTimeStr)
  // Exclude the active reminder from the upcoming list
  const upcomingReminders = reminders.filter(r =>
    !r.isCompleted && (!activeReminder || r._id !== activeReminder._id)
  )

  return (
    <div className="mirror-container">
      <header className="mirror-header">
        <h1>Kiosk Mirror View</h1>
        <div className="connection-status">
          <div className={`connection-dot ${isKioskOnline ? 'connected' : 'disconnected'}`}></div>
          <span>{isKioskOnline ? 'Kiosk Online' : 'Kiosk Offline'}</span>
        </div>
      </header>

      <nav style={{ marginBottom: 20 }}>
        <Link to="/caregiver" style={{ color: 'white', marginRight: 20 }}>
          ← Back to Dashboard
        </Link>
      </nav>

      {/* Mirror of kiosk screen */}
      <div className="mirror-frame">
        <div className="mirror-content">
          <div className="kiosk-container" style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '166.67%', height: '166.67%' }}>
            {/* Header with time */}
            <header className="kiosk-header">
              <div className="kiosk-time">{formatTime(currentTime)}</div>
              <div className="kiosk-date">{formatDate(currentTime)}</div>
            </header>

            {/* Main content area */}
            <main className="kiosk-content">
              {kioskState?.currentView === 'completed' ? (
                <div className="success-message">
                  <div className="success-icon">✓</div>
                  <h2>Great job!</h2>
                  <p>Task completed</p>
                </div>
              ) : activeReminder ? (
                <div className="reminder-card">
                  <div className="reminder-type">{activeReminder.type}</div>
                  <h1 className="reminder-title">{activeReminder.title}</h1>
                  {activeReminder.description && (
                    <p className="reminder-description">{activeReminder.description}</p>
                  )}
                  <p className="reminder-time-scheduled">
                    Scheduled for {formatReminderTime(activeReminder.time)}
                  </p>
                  <button className="confirm-button" disabled style={{ opacity: 0.7 }}>
                    <span className="checkmark">✓</span>
                    I did it
                  </button>
                </div>
              ) : (
                <div className="kiosk-idle">
                  <h1>All caught up!</h1>
                  <p>No reminders right now</p>
                </div>
              )}
            </main>

            {/* Upcoming reminders */}
            {upcomingReminders.length > 0 && (
              <section className="upcoming-section">
                <h3 className="upcoming-title">Coming up today</h3>
                <div className="upcoming-list">
                  {upcomingReminders.map(reminder => (
                    <div
                      key={reminder._id}
                      className={`upcoming-item ${reminder.isCompleted ? 'completed' : ''}`}
                    >
                      <div className="upcoming-item-time">
                        {formatReminderTime(reminder.time)}
                      </div>
                      <div className="upcoming-item-title">{reminder.title}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* Status info */}
      <div style={{ color: 'white', marginTop: 30, opacity: 0.7 }}>
        <p>
          <strong>Current View:</strong> {kioskState?.currentView || 'idle'}
          {' | '}
          <strong>Last Activity:</strong> {kioskState?.lastActivity ? new Date(kioskState.lastActivity).toLocaleString() : 'N/A'}
        </p>
      </div>
    </div>
  )
}

export default MirrorView
