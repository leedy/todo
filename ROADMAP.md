# Medication Kiosk - Feature Roadmap

## Current Features (v1.0)
- [x] Kiosk view with large touch-friendly buttons
- [x] "I did it" completion button (green)
- [x] "Skip" button for missed medications (red)
- [x] Caregiver dashboard to manage reminders
- [x] Mirror view to see what kiosk displays
- [x] Real-time sync via WebSocket
- [x] Activity logging (completed/skipped)
- [x] Day-of-week scheduling

---

## Planned Enhancements

### High Priority
- [ ] **Audio alerts** - Play a sound/chime when a reminder is due
- [ ] **Snooze option** - "Remind me in 10 minutes" button
- [ ] **Caregiver notifications** - Alert when medication is skipped (email/push)
- [ ] **Better activity icons** - Visual distinction between completed/skipped in dashboard

### Medium Priority
- [ ] **Raspberry Pi auto-start** - Boot directly into kiosk mode
- [ ] **Screen dimming** - Dim screen at night, brighten for reminders
- [ ] **Voice announcements** - Text-to-speech for reminders
- [ ] **Multiple kiosks** - Support multiple users/devices
- [ ] **Timezone support** - Handle different timezones for remote caregivers

### Nice to Have
- [ ] **Photo confirmation** - Optional photo when marking complete
- [ ] **Recurring patterns** - "Every other day", "First of month", etc.
- [ ] **Medication inventory** - Track pill counts, refill reminders
- [ ] **Doctor/pharmacy contacts** - Quick access to important numbers
- [ ] **Emergency button** - One-tap call for help
- [ ] **Weather widget** - Show current weather on idle screen
- [ ] **Family photo slideshow** - Display photos when idle

### Technical Improvements
- [ ] **Production build** - Optimized build for deployment
- [ ] **Docker container** - Easy deployment option
- [ ] **Backup/restore** - Export/import reminder data
- [ ] **Offline support** - Cache reminders if network drops
- [ ] **Security** - Add authentication for caregiver dashboard

---

## Notes
- Target user has Parkinson's and cognitive decline
- All UI must remain simple with large touch targets
- System must auto-recover from power loss
- Caregiver manages remotely from different location
