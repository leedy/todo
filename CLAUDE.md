# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Medication Kiosk - A Raspberry Pi touchscreen application for medication and daily reminders, designed for users with Parkinson's and cognitive decline. Features large touch targets, simple UI, and remote caregiver management.

## Development Commands

```bash
# Start both backend and frontend for development
npm run dev

# Start backend only (port 5177)
npm run server

# Start frontend only (port 5176)
npm run client

# Build frontend for production
npm run build

# Start production server
npm run start
```

## Architecture

### Backend (`server/`)
- **Express + Socket.IO** server on port 5177
- **MongoDB** via Mongoose for data persistence
- Real-time updates broadcast to all connected clients

**Models:**
- `Reminder` - Scheduled reminders with time, days, type
- `Completion` - Activity log (completed/skipped/missed status)
- `KioskState` - Current kiosk display state for mirror sync

**Key API endpoints:**
- `GET/POST /api/reminders` - CRUD for reminders
- `GET /api/kiosk/today` - Today's reminders with completion status
- `POST /api/kiosk/complete/:id` - Mark reminder done
- `POST /api/kiosk/skip/:id` - Mark reminder skipped
- `GET /api/completions` - Activity history

### Frontend (`client/`)
- **React + Vite** on port 5176 (proxies to backend)
- **Socket.IO client** for real-time sync
- **React Router** for views

**Views:**
- `/` - KioskView (large buttons for end user)
- `/caregiver` - CaregiverDashboard (manage reminders, view activity)
- `/mirror` - MirrorView (see what kiosk displays remotely)

### Real-time Flow
1. Kiosk connects via Socket.IO, emits `kiosk-connect`
2. Server checks reminders every 60 seconds, emits `reminder-due` to kiosk
3. User actions trigger `reminders-updated` broadcast
4. Mirror views receive `kiosk-state-update` for sync

## Environment Variables

Configure in `.env`:
```
MONGO_HOST, MONGO_PORT, MONGO_USERNAME, MONGO_PASSWORD, MONGO_DATABASE
PORT (backend port, default 5177)
```

## Design Constraints

- All kiosk UI must have large touch targets (40px+ padding on buttons)
- High contrast colors for visibility
- No complex navigation - single-screen interactions only
- System must recover automatically from power loss
