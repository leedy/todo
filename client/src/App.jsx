import { BrowserRouter, Routes, Route } from 'react-router-dom'
import KioskView from './views/KioskView'
import CaregiverDashboard from './views/CaregiverDashboard'
import MirrorView from './views/MirrorView'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KioskView />} />
        <Route path="/caregiver" element={<CaregiverDashboard />} />
        <Route path="/mirror" element={<MirrorView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
