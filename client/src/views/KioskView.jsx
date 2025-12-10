import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

const socket = io()

function KioskView() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [reminders, setReminders] = useState([])
  const [activeReminder, setActiveReminder] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [leadTime, setLeadTime] = useState(0)
  const [displayOnly, setDisplayOnly] = useState(false)
  const [autoSkipTimeout, setAutoSkipTimeout] = useState(0)
  const [reminderStartTime, setReminderStartTime] = useState(null)
  const activeReminderRef = useRef(null)

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setLeadTime(data.reminderLeadTime || 0)
      setDisplayOnly(data.displayOnly || false)
      setAutoSkipTimeout(data.autoSkipTimeout || 0)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // Fetch today's reminders
  const fetchReminders = useCallback(async (currentActiveReminder) => {
    try {
      const res = await fetch('/api/kiosk/today')
      const data = await res.json()
      setReminders(data)

      // Find next pending reminder (considering lead time)
      const now = new Date()
      // Add lead time to current time for comparison (show reminders early)
      const adjustedTime = new Date(now.getTime() + leadTime * 60 * 1000)
      const adjustedTimeStr = `${String(adjustedTime.getHours()).padStart(2, '0')}:${String(adjustedTime.getMinutes()).padStart(2, '0')}`

      // Calculate lookback time (don't show reminders more than 30 min past their time)
      const lookbackMinutes = 30
      const lookbackTime = new Date(now.getTime() - lookbackMinutes * 60 * 1000)
      const lookbackTimeStr = `${String(lookbackTime.getHours()).padStart(2, '0')}:${String(lookbackTime.getMinutes()).padStart(2, '0')}`

      // Show reminders that are:
      // - Due within lead time (r.time <= adjustedTime), AND
      // - Not too far in the past (r.time >= lookbackTime)
      const pending = data.find(r => !r.isCompleted && r.time <= adjustedTimeStr && r.time >= lookbackTimeStr)

      // Handle auto-actions when a new reminder becomes due
      if (currentActiveReminder && pending && pending._id !== currentActiveReminder._id) {
        if (displayOnly) {
          // In display-only mode, auto-complete current reminder when a new one becomes due
          await fetch(`/api/kiosk/complete/${currentActiveReminder._id}`, { method: 'POST' })
          socket.emit('kiosk-state-change', {
            currentReminderId: pending._id,
            currentView: 'reminder'
          })
          setActiveReminder(pending)
        } else if (pending.type === currentActiveReminder.type) {
          // In normal mode, auto-skip current reminder when a new one of the same type becomes due
          await fetch(`/api/kiosk/skip/${currentActiveReminder._id}`, { method: 'POST' })
          socket.emit('kiosk-state-change', {
            currentReminderId: pending._id,
            currentView: 'reminder'
          })
          setActiveReminder(pending)
        } else {
          // Different type - just show the new one (current stays unanswered)
          setActiveReminder(pending)
        }
      } else if (pending && !showSuccess) {
        setActiveReminder(pending)
      } else if (!pending) {
        setActiveReminder(null)
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error)
    }
  }, [showSuccess, leadTime, displayOnly])

  // Keep ref in sync with state for use in intervals
  useEffect(() => {
    activeReminderRef.current = activeReminder
  }, [activeReminder])

  // Track when a reminder becomes active (for auto-skip timeout)
  useEffect(() => {
    if (activeReminder) {
      setReminderStartTime(Date.now())
    } else {
      setReminderStartTime(null)
    }
  }, [activeReminder?._id])

  // Auto-skip timer effect
  useEffect(() => {
    if (!autoSkipTimeout || !activeReminder || !reminderStartTime || displayOnly) {
      return
    }

    const timeoutMs = autoSkipTimeout * 60 * 1000
    const elapsed = Date.now() - reminderStartTime
    const remaining = timeoutMs - elapsed

    if (remaining <= 0) {
      // Already past timeout, skip immediately
      fetch(`/api/kiosk/skip/${activeReminder._id}`, { method: 'POST' })
        .then(() => {
          socket.emit('kiosk-state-change', {
            currentReminderId: null,
            currentView: 'idle'
          })
          fetchReminders(null)
        })
      return
    }

    // Set timer for remaining time
    const timer = setTimeout(() => {
      if (activeReminderRef.current && activeReminderRef.current._id === activeReminder._id) {
        fetch(`/api/kiosk/skip/${activeReminder._id}`, { method: 'POST' })
          .then(() => {
            socket.emit('kiosk-state-change', {
              currentReminderId: null,
              currentView: 'idle'
            })
            fetchReminders(null)
          })
      }
    }, remaining)

    return () => clearTimeout(timer)
  }, [autoSkipTimeout, activeReminder, reminderStartTime, displayOnly, fetchReminders])

  useEffect(() => {
    fetchReminders(activeReminderRef.current)
    const interval = setInterval(() => fetchReminders(activeReminderRef.current), 30000) // Refresh every 30 seconds
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

    socket.on('settings-updated', (settings) => {
      setLeadTime(settings.reminderLeadTime || 0)
      setDisplayOnly(settings.displayOnly || false)
      setAutoSkipTimeout(settings.autoSkipTimeout || 0)
    })

    return () => {
      socket.off('reminders-updated')
      socket.off('reminder-due')
      socket.off('settings-updated')
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

  // Exclude the active reminder and past reminders from the upcoming list
  const nowTimeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`
  const upcomingReminders = reminders.filter(r =>
    !r.isCompleted &&
    (!activeReminder || r._id !== activeReminder._id) &&
    r.time > nowTimeStr // Only show future reminders
  )

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
            {!displayOnly && (
              <div className="reminder-buttons">
                <button className="confirm-button" onClick={handleComplete}>
                  <span className="checkmark">✓</span>
                  I did it
                </button>
                <button className="skip-button" onClick={handleSkip}>
                  Skip
                </button>
              </div>
            )}
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
