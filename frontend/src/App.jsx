import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import History from './pages/History'
import Compare from './pages/Compare'
import Sources from './pages/Sources'
import ConstellationPage from './pages/ConstellationPage'
import PeerTeachingPage from './pages/PeerTeachingPage'
import LearningProfile from './pages/LearningProfile'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(7,13,26,0.95)',
              border: '1px solid rgba(0,229,255,0.25)',
              borderRadius: 2,
              color: '#E8F4FF',
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: '11px',
              letterSpacing: '0.08em',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 0 30px rgba(0,229,255,0.08)',
            },
          }}
        />
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <Compare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/sources"
            element={
              <ProtectedRoute>
                <Sources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/constellation"
            element={
              <ProtectedRoute>
                <ConstellationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/peer"
            element={
              <ProtectedRoute>
                <PeerTeachingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/learning"
            element={
              <ProtectedRoute>
                <LearningProfile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
