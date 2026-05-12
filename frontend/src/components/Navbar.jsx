import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

export default function Navbar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout', { refresh_token: refreshToken }),
    onSettled: () => {
      clearAuth()
      toast.success('Logged out')
      navigate('/auth/login')
    },
  })

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-indigo-600 text-lg tracking-tight">
          ELIM
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/settings/sources" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Sources
              </Link>
              <Link to="/compare" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Compare
              </Link>
              <Link to="/history" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                History
              </Link>
              <Link
                to="/profile"
                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1.5"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                {user.name}
              </Link>
              <button
                onClick={() => logoutMutation.mutate()}
                className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
                Sign in
              </Link>
              <Link
                to="/auth/register"
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
