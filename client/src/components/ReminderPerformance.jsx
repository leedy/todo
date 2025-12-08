import { useState, useEffect } from 'react'

function ReminderPerformance({ days = 30 }) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [days])

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats/reminders?days=${days}`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch reminder stats:', error)
    } finally {
      setLoading(false)
    }
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

  const getPerformanceColor = (rate) => {
    if (rate >= 90) return '#22c55e'
    if (rate >= 70) return '#84cc16'
    if (rate >= 50) return '#eab308'
    if (rate >= 25) return '#f97316'
    return '#ef4444'
  }

  const getPerformanceLabel = (rate) => {
    if (rate >= 90) return 'Excellent'
    if (rate >= 70) return 'Good'
    if (rate >= 50) return 'Fair'
    if (rate >= 25) return 'Poor'
    return 'Needs Attention'
  }

  if (loading) {
    return <div className="performance-loading">Loading...</div>
  }

  if (stats.length === 0) {
    return (
      <div className="empty-state">
        <p>No reminders to analyze yet</p>
      </div>
    )
  }

  return (
    <div className="reminder-performance">
      <div className="performance-list">
        {stats.map(reminder => (
          <div key={reminder._id} className="performance-item">
            <div className="performance-info">
              <div className="performance-title">
                {reminder.title}
                {!reminder.active && <span className="inactive-badge">Inactive</span>}
              </div>
              <div className="performance-meta">
                {formatTime(reminder.time)} &bull; {reminder.type}
              </div>
            </div>

            <div className="performance-stats">
              <div className="stat-group">
                <span className="stat-value completed">{reminder.completed}</span>
                <span className="stat-label">Done</span>
              </div>
              <div className="stat-group">
                <span className="stat-value skipped">{reminder.skipped}</span>
                <span className="stat-label">Skipped</span>
              </div>
              <div className="stat-group">
                <span className="stat-value missed">{reminder.missed}</span>
                <span className="stat-label">Missed</span>
              </div>
            </div>

            <div className="performance-rate">
              <div
                className="rate-bar"
                style={{
                  width: `${reminder.completionRate}%`,
                  backgroundColor: getPerformanceColor(reminder.completionRate)
                }}
              />
              <div className="rate-info">
                <span
                  className="rate-percentage"
                  style={{ color: getPerformanceColor(reminder.completionRate) }}
                >
                  {reminder.completionRate}%
                </span>
                <span className="rate-label">{getPerformanceLabel(reminder.completionRate)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ReminderPerformance
