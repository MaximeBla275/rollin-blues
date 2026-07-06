'use client'

import { useAuth } from '@/lib/auth-context'
import LeadDashboard from './LeadDashboard'
import MembreDashboard from './MembreDashboard'

export default function DashboardPage() {
  const { hasPermission } = useAuth()
  return hasPermission('voir_dashboard_lead') ? <LeadDashboard /> : <MembreDashboard />
}
