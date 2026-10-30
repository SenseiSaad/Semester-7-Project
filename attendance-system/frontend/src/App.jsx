import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth, homeFor } from './auth'
import { Spinner } from './ui'
import Layout from './Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Attend from './pages/Attend'
import TDashboard from './pages/teacher/TDashboard'
import TCourses from './pages/teacher/TCourses'
import TCourseDetail from './pages/teacher/TCourseDetail'
import TSession from './pages/teacher/TSession'
import TManual from './pages/teacher/TManual'
import TViolations from './pages/teacher/TViolations'
import TEligibility from './pages/teacher/TEligibility'
import SDashboard from './pages/student/SDashboard'
import SHistory from './pages/student/SHistory'
import SNotifications from './pages/student/SNotifications'

function Gate({ role, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>
  if (!user) {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/attend" element={<Attend />} />

      <Route path="/t" element={<Gate role="teacher"><Layout /></Gate>}>
        <Route index element={<TDashboard />} />
        <Route path="courses" element={<TCourses />} />
        <Route path="courses/:id" element={<TCourseDetail />} />
        <Route path="sessions/:id" element={<TSession />} />
        <Route path="manual" element={<TManual />} />
        <Route path="violations" element={<TViolations />} />
        <Route path="eligibility" element={<TEligibility />} />
      </Route>

      <Route path="/s" element={<Gate role="student"><Layout /></Gate>}>
        <Route index element={<SDashboard />} />
        <Route path="history" element={<SHistory />} />
        <Route path="scan" element={<Attend />} />
        <Route path="notifications" element={<SNotifications />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
