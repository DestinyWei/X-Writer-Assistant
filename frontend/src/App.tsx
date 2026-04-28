import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import FeedPool from './pages/FeedPool'
import DraftWorkshop from './pages/DraftWorkshop'
import CalendarPage from './pages/CalendarPage'
import PublishedPage from './pages/PublishedPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/feeds" replace />} />
          <Route path="/feeds" element={<FeedPool />} />
          <Route path="/workshop/:postId?" element={<DraftWorkshop />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/published" element={<PublishedPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
