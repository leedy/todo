import { useState, useEffect } from 'react'

function CalendarHeatMap({ days = 30 }) {
  const [stats, setStats] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayDetails, setDayDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [days])

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats/daily?days=${days}`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch daily stats:', error)
    }
  }

  const fetchDayDetails = async (date) => {
    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/stats/day/${date}`)
      const data = await res.json()
      setDayDetails(data)
    } catch (error) {
      console.error('Failed to fetch day details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDayClick = (day) => {
    if (!day) return
    setSelectedDay(day)
    fetchDayDetails(day.date)
  }

  const getComplianceColor = (day) => {
    if (day.expected === 0) return '#f0f0f0' // No reminders expected
    const rate = day.completed / day.expected
    if (rate >= 0.9) return '#22c55e' // Green - 90%+ compliance
    if (rate >= 0.5) return '#eab308' // Yellow - 50-89% compliance
    if (rate > 0) return '#f97316' // Orange - some done
    return '#ef4444' // Red - nothing done
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
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

  const getWeeks = () => {
    const weeks = []
    let currentWeek = []

    // Get the day of week for the first date
    if (stats.length > 0) {
      const firstDate = new Date(stats[0].date + 'T12:00:00')
      const startPadding = firstDate.getDay()

      // Add empty cells for padding
      for (let i = 0; i < startPadding; i++) {
        currentWeek.push(null)
      }
    }

    stats.forEach((day) => {
      currentWeek.push(day)
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })

    // Add remaining days
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }

    return weeks
  }

  const weeks = getWeeks()

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return '✓'
      case 'skipped': return '⏭'
      case 'missed': return '✗'
      default: return '?'
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'status-completed'
      case 'skipped': return 'status-skipped'
      case 'missed': return 'status-missed'
      default: return ''
    }
  }

  return (
    <div className="calendar-heatmap">
      <div className="heatmap-header">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      <div className="heatmap-grid">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="heatmap-week">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`heatmap-day ${day ? 'has-data' : 'empty'} ${selectedDay?.date === day?.date ? 'selected' : ''}`}
                style={{ backgroundColor: day ? getComplianceColor(day) : 'transparent' }}
                onClick={() => handleDayClick(day)}
                title={day ? `${formatDate(day.date)}: ${day.completed}/${day.expected} completed` : ''}
              >
                {day && (
                  <span className="day-number">
                    {new Date(day.date + 'T12:00:00').getDate()}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="legend-label">Less</span>
        <div className="legend-color" style={{ backgroundColor: '#ef4444' }} title="0%"></div>
        <div className="legend-color" style={{ backgroundColor: '#f97316' }} title="1-49%"></div>
        <div className="legend-color" style={{ backgroundColor: '#eab308' }} title="50-89%"></div>
        <div className="legend-color" style={{ backgroundColor: '#22c55e' }} title="90-100%"></div>
        <span className="legend-label">More</span>
      </div>

      {/* Selected day details */}
      {selectedDay && (
        <div className="heatmap-details">
          <h4>{formatDate(selectedDay.date)}</h4>
          <div className="details-stats">
            <div className="stat completed">
              <span className="stat-number">{selectedDay.completed}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat skipped">
              <span className="stat-number">{selectedDay.skipped}</span>
              <span className="stat-label">Skipped</span>
            </div>
            <div className="stat expected">
              <span className="stat-number">{selectedDay.expected}</span>
              <span className="stat-label">Expected</span>
            </div>
          </div>
          {selectedDay.expected > 0 && (
            <div className="compliance-rate">
              {Math.round((selectedDay.completed / selectedDay.expected) * 100)}% compliance
            </div>
          )}

          {/* Detailed reminder list */}
          {loadingDetails ? (
            <div className="day-reminders-loading">Loading details...</div>
          ) : dayDetails?.reminders?.length > 0 ? (
            <div className="day-reminders">
              <h5>Reminder Details</h5>
              <div className="reminder-detail-list">
                {dayDetails.reminders.map(reminder => (
                  <div key={reminder._id} className={`reminder-detail-item ${getStatusClass(reminder.status)}`}>
                    <span className={`reminder-status-icon ${getStatusClass(reminder.status)}`}>
                      {getStatusIcon(reminder.status)}
                    </span>
                    <span className="reminder-detail-time">{formatTime(reminder.time)}</span>
                    <span className="reminder-detail-title">{reminder.title}</span>
                    <span className={`reminder-detail-status ${getStatusClass(reminder.status)}`}>
                      {reminder.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default CalendarHeatMap
