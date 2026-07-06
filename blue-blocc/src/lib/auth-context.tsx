'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { UserProfile, CustomRole, Permission } from '@/types'
import { loginMembre, updatePassword, getCustomRoles, getMemberPermissions } from '@/lib/db'

export interface LocalUser { uid: string; pseudo: string }

interface AuthContextType {
  user: LocalUser | null
  profile: UserProfile | null
  customRoles: CustomRole[]
  permissions: Permission[]
  loading: boolean
  hasPermission: (perm: Permission) => boolean
  isLead: boolean
  login: (pseudo: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  refreshRoles: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const SESSION_KEY = 'blue-blocc-session'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  const loadRoles = async () => {
    const roles = await getCustomRoles()
    setCustomRoles(roles)
    return roles
  }

  useEffect(() => {
    const init = async () => {
      try {
        const raw = window.localStorage.getItem(SESSION_KEY)
        if (raw) {
          const session = JSON.parse(raw) as { uid: string; pseudo: string; role: string; customRoleId?: string }
          const roles = await loadRoles()
          const memberForPerms = { uid: session.uid, pseudo: session.pseudo, role: session.role, customRoleId: session.customRoleId, createdAt: '' }
          const perms = getMemberPermissions(memberForPerms, roles)
          setUser({ uid: session.uid, pseudo: session.pseudo })
          setProfile({ uid: session.uid, pseudo: session.pseudo, role: session.role, customRoleId: session.customRoleId, createdAt: '', createdBy: 'system' })
          setPermissions(perms)
        }
      } catch {
        window.localStorage.removeItem(SESSION_KEY)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const login = async (pseudo: string, password: string) => {
    const membre = await loginMembre(pseudo, password)
    const roles = await loadRoles()
    const perms = getMemberPermissions(membre, roles)
    const sessionData = { uid: membre.uid, pseudo: membre.pseudo, role: membre.role, customRoleId: membre.customRoleId }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
    setUser({ uid: membre.uid, pseudo: membre.pseudo })
    setProfile({ uid: membre.uid, pseudo: membre.pseudo, role: membre.role, customRoleId: membre.customRoleId, createdAt: membre.createdAt, createdBy: 'system' })
    setPermissions(perms)
  }

  const logout = async () => {
    window.localStorage.removeItem(SESSION_KEY)
    setUser(null); setProfile(null); setPermissions([])
  }

  const changePassword = async (newPassword: string) => {
    if (!user) throw new Error('Non connecté')
    if (newPassword.trim().length < 3) throw new Error('Mot de passe trop court')
    await updatePassword(user.uid, newPassword.trim())
  }

  const refreshRoles = async () => {
    const roles = await loadRoles()
    if (profile) {
      const perms = getMemberPermissions(profile, roles)
      setPermissions(perms)
    }
  }

  const hasPerm = (perm: Permission) => permissions.includes(perm)
  const isLead = profile?.role === 'lead' || profile?.role === 'co-lead'

  return (
    <AuthContext.Provider value={{ user, profile, customRoles, permissions, loading, hasPermission: hasPerm, isLead: !!isLead, login, logout, changePassword, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
