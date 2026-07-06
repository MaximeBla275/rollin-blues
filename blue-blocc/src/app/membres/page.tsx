'use client'

import React, { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import { getMembers, getVentes, getParametres, getCustomRoles, updateMemberRole, updateMemberPassword, deleteMember, createMember, createCustomRole, updateCustomRole, deleteCustomRole, updateCustomRoleOrdre, ALL_PERMISSIONS } from '@/lib/db'
import { Member, Parametres, CustomRole, Permission, Vente } from '@/types'
import { formatKg, formatMoney, getSemaine, calculerSalaire, getRoleDisplay } from '@/lib/utils'
import { Pencil, Trash2, Plus, Check, X, Shield, ChevronUp, ChevronDown } from 'lucide-react'

export default function MembresPage() {
  const { profile, isLead, hasPermission } = useAuth()
  const [membres, setMembres] = useState<Member[]>([])
  const [ventes, setVentes] = useState<Vente[]>([])
  const [params, setParams] = useState<Parametres | null>(null)
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [newPseudo, setNewPseudo] = useState('')
  const [newRole, setNewRole] = useState('membre')
  const [newCustomRoleId, setNewCustomRoleId] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [editMemberId, setEditMemberId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editCustomRoleId, setEditCustomRoleId] = useState('')
  const [editPwdId, setEditPwdId] = useState<string | null>(null)
  const [newPwdValue, setNewPwdValue] = useState('')
  const [error, setError] = useState('')

  const [showRoles, setShowRoles] = useState(false)
  const [showCreateRole, setShowCreateRole] = useState(false)
  const [newRoleNom, setNewRoleNom] = useState('')
  const [newRoleCouleur, setNewRoleCouleur] = useState('#a78bfa')
  const [newRolePerms, setNewRolePerms] = useState<Permission[]>(['faire_ventes', 'faire_demandes', 'voir_membres', 'voir_rendements'])
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editRoleNom, setEditRoleNom] = useState('')
  const [editRoleCouleur, setEditRoleCouleur] = useState('')
  const [editRolePerms, setEditRolePerms] = useState<Permission[]>([])

  const semaine = getSemaine()

  const load = async () => {
    const [m, v, p, r] = await Promise.all([getMembers(), getVentes({ semaine }), getParametres(), getCustomRoles()])
    setMembres(m); setVentes(v); setParams(p); setCustomRoles(r)
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [profile])

  const ventesNormales = ventes.filter(v => v.type === 'normale')

  const statsParMembre = useMemo(() => {
    if (!params) return {} as Record<string, { kg: number; cashSale: number; pct: number; salaire: number }>
    return Object.fromEntries(membres.map(m => {
      const mv = ventesNormales.filter(v => v.membreId === m.uid)
      const kg = mv.reduce((s, v) => s + v.quantite, 0)
      const cashSale = mv.reduce((s, v) => s + v.cashSale, 0)
      const pct = Math.min(100, (kg / params.quotaIndividuel) * 100)
      const salaire = calculerSalaire(kg, params)
      return [m.uid, { kg, cashSale, pct, salaire }]
    }))
  }, [membres, ventes, params])



  const togglePerm = (perms: Permission[], perm: Permission): Permission[] =>
    perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError('')
    try {
      await createMember(newPseudo, newRole, newPwd || 'membre', profile?.uid || 'lead', newCustomRoleId || undefined)
      setNewPseudo(''); setNewPwd(''); setNewCustomRoleId(''); setShowCreate(false); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur') }
  }

  const handleCreateRole = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!newRoleNom.trim()) return
    await createCustomRole(newRoleNom.trim(), newRolePerms, newRoleCouleur)
    setNewRoleNom(''); setNewRolePerms(['faire_ventes', 'faire_demandes', 'voir_membres', 'voir_rendements']); setShowCreateRole(false); load()
  }

  useRealtime(load)

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">Membres</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>Semaine {semaine}</p>
          </div>
          <div className="flex gap-2">
            {isLead && hasPermission('gerer_roles') && (
              <button className="btn-ghost flex items-center gap-2" onClick={() => setShowRoles(!showRoles)}>
                <Shield size={15} /> Rôles
              </button>
            )}
            {isLead && hasPermission('gerer_membres') && (
              <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(!showCreate)}>
                <Plus size={15} /> Nouveau membre
              </button>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-400 px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

        {/* Gestion rôles */}
        {showRoles && isLead && (
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Rôles personnalisés</div>
              <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => setShowCreateRole(!showCreateRole)}><Plus size={13} /> Créer</button>
            </div>
            {showCreateRole && (
              <form onSubmit={handleCreateRole} className="p-4 rounded-lg space-y-3" style={{ background: 'rgba(30,107,255,0.08)', border: '1px solid rgba(30,107,255,0.2)' }}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
                  <input className="input" placeholder="Nom du rôle (ex: Gérant Drogue)" value={newRoleNom} onChange={e => setNewRoleNom(e.target.value)} autoFocus required />
                  <div className="flex items-center gap-2">
                    <input type="color" value={newRoleCouleur} onChange={e => setNewRoleCouleur(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                    <span className="text-xs" style={{ color: 'var(--blocc-muted)' }}>Couleur</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.id} className="flex items-start gap-2 cursor-pointer rounded-lg px-3 py-2"
                      style={{ background: newRolePerms.includes(p.id) ? 'rgba(30,107,255,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${newRolePerms.includes(p.id) ? 'rgba(30,107,255,0.3)' : 'var(--blocc-border)'}` }}>
                      <input type="checkbox" checked={newRolePerms.includes(p.id)} onChange={() => setNewRolePerms(prev => togglePerm(prev, p.id))} className="mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-white">{p.label}</div>
                        <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-xs py-1.5 px-3">Créer</button>
                  <button type="button" className="btn-ghost text-xs py-1.5 px-3" onClick={() => setShowCreateRole(false)}>Annuler</button>
                </div>
              </form>
            )}
            <div className="space-y-3">
              {customRoles.map(role => (
                <div key={role.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                  {editRoleId === role.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
                        <input className="input" value={editRoleNom} onChange={e => setEditRoleNom(e.target.value)} />
                        <input type="color" value={editRoleCouleur} onChange={e => setEditRoleCouleur(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ALL_PERMISSIONS.map(p => (
                          <label key={p.id} className="flex items-start gap-2 cursor-pointer rounded-lg px-3 py-2"
                            style={{ background: editRolePerms.includes(p.id) ? 'rgba(30,107,255,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${editRolePerms.includes(p.id) ? 'rgba(30,107,255,0.3)' : 'var(--blocc-border)'}` }}>
                            <input type="checkbox" checked={editRolePerms.includes(p.id)} onChange={() => setEditRolePerms(prev => togglePerm(prev, p.id))} className="mt-0.5" />
                            <div><div className="text-xs font-semibold text-white">{p.label}</div><div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>{p.desc}</div></div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-primary text-xs py-1.5 px-3" onClick={async () => { await updateCustomRole(role.id, { nom: editRoleNom, permissions: editRolePerms, couleur: editRoleCouleur }); setEditRoleId(null); load() }}>Sauver</button>
                        <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setEditRoleId(null)}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: role.couleur }} />
                        <div>
                          <div className="font-semibold text-white text-sm">{role.nom}</div>
                          <div className="text-xs mt-0.5 flex flex-wrap gap-1">
                            {role.permissions.map(p => {
                              const info = ALL_PERMISSIONS.find(x => x.id === p)
                              return <span key={p} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--blocc-muted)' }}>{info?.label || p}</span>
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }}
                          title="Monter"
                          onClick={async () => {
                            const idx = customRoles.findIndex(r => r.id === role.id)
                            if (idx <= 0) return
                            const newRoles = [...customRoles]
                            const tmp = newRoles[idx - 1]; newRoles[idx - 1] = newRoles[idx]; newRoles[idx] = tmp
                            await updateCustomRoleOrdre(newRoles.map((r, i) => ({ id: r.id, ordre: i })))
                            load()
                          }}><ChevronUp size={13} /></button>
                        <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }}
                          title="Descendre"
                          onClick={async () => {
                            const idx = customRoles.findIndex(r => r.id === role.id)
                            if (idx >= customRoles.length - 1) return
                            const newRoles = [...customRoles]
                            const tmp = newRoles[idx + 1]; newRoles[idx + 1] = newRoles[idx]; newRoles[idx] = tmp
                            await updateCustomRoleOrdre(newRoles.map((r, i) => ({ id: r.id, ordre: i })))
                            load()
                          }}><ChevronDown size={13} /></button>
                        <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }}
                          onClick={() => { setEditRoleId(role.id); setEditRoleNom(role.nom); setEditRoleCouleur(role.couleur); setEditRolePerms(role.permissions) }}><Pencil size={13} /></button>
                        <button className="p-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                          onClick={async () => { if (!confirm('Supprimer ce rôle ?')) return; await deleteCustomRole(role.id); load() }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Créer membre */}
        {showCreate && isLead && (
          <div className="card p-6">
            <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Nouveau membre</div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="label">Pseudo</label><input className="input" placeholder="Pseudo" value={newPseudo} onChange={e => setNewPseudo(e.target.value)} required /></div>
                <div><label className="label">Mot de passe</label><input className="input" placeholder="mot de passe" value={newPwd} onChange={e => setNewPwd(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Rôle système</label>
                  <select className="input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                    <option value="membre">Membre</option>
                    <option value="co-lead">Co-Lead</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
                <div>
                  <label className="label">Rôle personnalisé (optionnel)</label>
                  <select className="input" value={newCustomRoleId} onChange={e => setNewCustomRoleId(e.target.value)}>
                    <option value="">— Aucun —</option>
                    {customRoles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">Créer</button>
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
              </div>
            </form>
          </div>
        )}

        {/* Liste membres */}
        <div className="space-y-3">
          {[...membres].sort((a, b) => {
            // Rôle système d'abord (lead > co-lead > autre)
            const sysOrder = ['lead', 'co-lead']
            const ai = sysOrder.indexOf(a.role); const bi = sysOrder.indexOf(b.role)
            if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            // Ensuite par ordre du rôle secondaire
            const aCr = a.customRoleId ? customRoles.find(r => r.id === a.customRoleId) : null
            const bCr = b.customRoleId ? customRoles.find(r => r.id === b.customRoleId) : null
            const aOrdre = aCr ? aCr.ordre : 9999
            const bOrdre = bCr ? bCr.ordre : 9999
            if (aOrdre !== bOrdre) return aOrdre - bOrdre
            // Enfin par pseudo
            return a.pseudo.localeCompare(b.pseudo)
          }).map(m => {
            const stats = statsParMembre[m.uid]
            const rd = getRoleDisplay(m.role, m.customRoleId, customRoles)
            const isMe = m.uid === profile?.uid
            return (
              <div key={m.uid} className="card p-5" style={{ border: isMe ? '1px solid rgba(30,107,255,0.3)' : undefined }}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0" style={{ background: 'var(--blocc-blue)' }}>{m.pseudo[0].toUpperCase()}</div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        {m.pseudo}
                        {isMe && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(30,107,255,0.2)', color: '#60a5fa' }}>moi</span>}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block" style={{ background: `${rd.couleur}20`, color: rd.couleur }}>{rd.label}</span>
                    </div>
                  </div>

                  {stats && params && (
                    <div className="flex-1 min-w-0 max-w-xs">
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--blocc-muted)' }}>{formatKg(stats.kg)} / {formatKg(params.quotaIndividuel)}</span>
                        <span style={{ color: stats.pct >= 100 ? '#4ade80' : 'var(--blocc-muted)' }}>{Math.round(stats.pct)}%</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${stats.pct}%`, background: stats.pct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : undefined }} /></div>
                      <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--blocc-muted)' }}>
                        <span>Ventes: <strong style={{ color: '#60a5fa' }}>{formatMoney(stats.cashSale)}</strong></span>
                        <span>Salaire: <strong className="text-white">{formatMoney(stats.salaire)}</strong></span>
                      </div>
                    </div>
                  )}

                  {isLead && hasPermission('gerer_membres') && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {editMemberId === m.uid ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <select className="input text-xs py-1 h-8" value={editRole} onChange={e => setEditRole(e.target.value)}>
                            <option value="membre">Membre</option>
                            <option value="co-lead">Co-Lead</option>
                            <option value="lead">Lead</option>
                          </select>
                          <select className="input text-xs py-1 h-8" value={editCustomRoleId} onChange={e => setEditCustomRoleId(e.target.value)}>
                            <option value="">— Aucun —</option>
                            {customRoles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                          </select>
                          <button className="btn-primary text-xs py-1 px-2" onClick={async () => { await updateMemberRole(m.uid, editRole, editCustomRoleId || undefined); setEditMemberId(null); load() }}><Check size={13} /></button>
                          <button className="btn-ghost text-xs py-1 px-2" onClick={() => setEditMemberId(null)}><X size={13} /></button>
                        </div>
                      ) : (
                        <button className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
                          onClick={() => { setEditMemberId(m.uid); setEditRole(m.role); setEditCustomRoleId(m.customRoleId || '') }}>
                          <Pencil size={12} /> Rôle
                        </button>
                      )}
                      {editPwdId === m.uid ? (
                        <div className="flex items-center gap-2">
                          <input className="input text-xs py-1 h-8 w-28" placeholder="Nouveau mdp" value={newPwdValue} onChange={e => setNewPwdValue(e.target.value)} />
                          <button className="btn-primary text-xs py-1 px-2" onClick={async () => { if (!newPwdValue.trim()) return; await updateMemberPassword(m.uid, newPwdValue.trim()); setEditPwdId(null); setNewPwdValue('') }}><Check size={13} /></button>
                          <button className="btn-ghost text-xs py-1 px-2" onClick={() => setEditPwdId(null)}><X size={13} /></button>
                        </div>
                      ) : (
                        <button className="btn-ghost text-xs py-1 px-2 flex items-center gap-1" onClick={() => { setEditPwdId(m.uid); setNewPwdValue('') }}>
                          <Pencil size={12} /> Mdp
                        </button>
                      )}
                      <button className="p-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                        onClick={async () => { if (!confirm(`Supprimer ${m.pseudo} ?`)) return; await deleteMember(m.uid); load() }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
