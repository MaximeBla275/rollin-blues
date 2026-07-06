'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Package, ClipboardList, Users, Settings, LogOut, X, Menu, Lock } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { getRoleDisplay } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()
  const { profile, customRoles, isLead, hasPermission, logout } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/ventes', label: 'Ventes', icon: ShoppingBag, show: hasPermission('faire_ventes') },
    { href: '/stock', label: 'Stock', icon: Package, show: hasPermission('voir_stock') || hasPermission('gerer_stock') },
    { href: '/demandes', label: 'Demandes', icon: ClipboardList, show: hasPermission('faire_demandes') || hasPermission('gerer_demandes') },
    { href: '/membres', label: 'Membres', icon: Users, show: hasPermission('voir_membres') },
    { href: '/coffre', label: 'Coffre', icon: Lock, show: hasPermission('voir_coffre') },
    { href: '/labo', label: 'Labo 🌿', icon: Package, show: hasPermission('gerer_labo') || hasPermission('voir_labo') },
    { href: '/parametres', label: 'Paramètres', icon: Settings, show: true },
  ].filter(i => i.show)

  const handleLogout = async () => { await logout(); router.push('/login') }

  const rd = getRoleDisplay(profile?.role || 'membre', profile?.customRoleId, customRoles)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <Image src="/logo.png" alt="Rollin Blues" width={40} height={40} className="object-cover w-full h-full" />
          </div>
          <div>
            <div className="font-black text-sm text-white leading-none">ROLLIN BLUES</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--blocc-muted)' }}>Manager</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: active ? 'rgba(30,107,255,0.2)' : 'transparent', color: active ? '#fff' : 'var(--blocc-muted)', borderLeft: active ? '2px solid var(--blocc-blue)' : '2px solid transparent' }}>
              <Icon size={17} />{item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--blocc-border)' }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--blocc-blue)' }}>
            {profile?.pseudo?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{profile?.pseudo ?? '—'}</div>
            <div className="text-xs font-semibold" style={{ color: rd.couleur }}>{rd.label}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--blocc-muted)' }}
          onMouseOver={e => (e.currentTarget.style.color = '#f87171')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--blocc-muted)')}>
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: 'var(--blocc-card)', border: '1px solid var(--blocc-border)' }}
        onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileOpen(false)} />
      )}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-64 z-40 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--blocc-card)', borderRight: '1px solid var(--blocc-border)' }}>
        <SidebarContent />
      </div>
      <div className="hidden lg:flex flex-col w-60 flex-shrink-0 h-screen sticky top-0"
        style={{ background: 'var(--blocc-card)', borderRight: '1px solid var(--blocc-border)' }}>
        <SidebarContent />
      </div>
    </>
  )
}
