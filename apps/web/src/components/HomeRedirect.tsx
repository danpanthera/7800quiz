import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getDefaultRoute } from '../lib/permissions'

export default function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? getDefaultRoute(user.role) : '/login'} replace />
}