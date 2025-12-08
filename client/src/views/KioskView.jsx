import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'

const socket = io()

function KioskView() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [reminders, setReminders] = useState([])
  const [activeReminder, setActiveReminder] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch today's reminders
  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch('/api/kiosk/today')
      const data = await res.json()
      setReminders(data)

      // Find next pending reminder
      const now = new Date()
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      const pending = data.find(r => !r.isCompleted && r.time <= currentTimeStr)
      if (pending && !showSuccess) {
        setActiveReminder(pending)
      } else if (!pending) {
        setActiveReminder(null)
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error)
    }
  }, [showSuccess])

  useEffect(() => {
    fetchReminders()
    const interval = setInterval(fetchReminders, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchReminders])

  // Socket.IO connections
  useEffect(() => {
    socket.emit('kiosk-connect')

    socket.on('reminders-updated', fetchReminders)

    socket.on('reminder-due', (reminder) => {
      setActiveReminder(reminder)
      socket.emit('kiosk-state-change', {
        currentReminderId: reminder._id,
        currentView: 'reminder'
      })
    })

    return () => {
      socket.off('reminders-updated')
      socket.off('reminder-due')
    }
  }, [fetchReminders])

  // Handle completion
  const handleComplete = async () => {
    if (!activeReminder) return

    try {
      await fetch(`/api/kiosk/complete/${activeReminder._id}`, { method: 'POST' })

      setSuccessMessage(activeReminder.title)
      setShowSuccess(true)
      setActiveReminder(null)

      socket.emit('kiosk-state-change', {
        currentReminderId: null,
        currentView: 'completed'
      })

      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false)
        setSuccessMessage('')
        socket.emit('kiosk-state-change', {
          currentReminderId: null,
          currentView: 'idle'
        })
        fetchReminders()
      }, 5000)
    } catch (error) {
      console.error('Failed to complete reminder:', error)
    }
  }

  // Handle skip
  const handleSkip = async () => {
    if (!activeReminder) return

    try {
      await fetch(`/api/kiosk/skip/${activeReminder._id}`, { method: 'POST' })

      setActiveReminder(null)

      socket.emit('kiosk-state-change', {
        currentReminderId: null,
        currentView: 'idle'
      })

      fetchReminders()
    } catch (error) {
      console.error('Failed to skip reminder:', error)
    }
  }

  // Track activity
  const handleActivity = () => {
    socket.emit('kiosk-activity')
  }

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

  const upcomingReminders = reminders.filter(r => !r.isCompleted)

  return (
    <div className="kiosk-container" onClick={handleActivity}>
      {/* Header with time */}
      <header className="kiosk-header">
        <div className="kiosk-time">{formatTime(currentTime)}</div>
        <div className="kiosk-date">{formatDate(currentTime)}</div>
      </header>

      {/* Main content area */}
      <main className="kiosk-content">
        {showSuccess ? (
          // Success message after completing
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>Great job!</h2>
            <p>{successMessage} - Done</p>
          </div>
        ) : activeReminder ? (
          // Active reminder card
          <div className="reminder-card">
            <div className="reminder-type">{activeReminder.type}</div>
            <h1 className="reminder-title">{activeReminder.title}</h1>
            {activeReminder.description && (
              <p className="reminder-description">{activeReminder.description}</p>
            )}
            <p className="reminder-time-scheduled">
              Scheduled for {formatReminderTime(activeReminder.time)}
            </p>
            <div className="reminder-buttons">
              <button className="confirm-button" onClick={handleComplete}>
                <span className="checkmark">✓</span>
                I did it
              </button>
              <button className="skip-button" onClick={handleSkip}>
                Skip
              </button>
            </div>
          </div>
        ) : (
          // Idle state
          <div className="kiosk-idle">
            <h1>All caught up!</h1>
            <p>No reminders right now</p>
          </div>
        )}
      </main>

      {/* Upcoming reminders */}
      {upcomingReminders.length > 0 && !showSuccess && (
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
  )
}

export default KioskView
