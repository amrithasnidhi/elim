import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

export default function Navbar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const { data: profileData } = useQuery({
    queryKey: ['profile-navbar'],
    queryFn: () => api.get('/profile').then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const spacedRepDue = profileData?.spaced_rep_due ?? 0

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
                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1.5 relative"
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  {spacedRepDue > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {spacedRepDue > 9 ? '9+' : spacedRepDue}
                    </span>
                  )}
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
