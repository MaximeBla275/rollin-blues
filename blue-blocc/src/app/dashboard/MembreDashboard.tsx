'use client'

import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import { getVentes, getMembers, getEntrepots, getParametres, getTreso, getSemaines, getCoffre, getItems } from '@/lib/db'
import { Vente, Member, Entrepot, Parametres, Treso, Coffre } from '@/types'
import { Item } from '@/types'
import { formatMoney, formatKg, getSemaine, calculerSalaire, getRoleDisplay } from '@/lib/utils'
import { ChevronLeft, ChevronRight, CheckCircle, Package } from 'lucide-react'

export default function MembreDashboard() {
  const { profile, hasPermission, customRoles } = useAuth()
  const [ventes, setVentes] = useState<Vente[]>([])
  const [membres, setMembres] = useState<Member[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [params, setParams] = useState<Parametres | null>(null)
  const [treso, setTreso] = useState<Treso | null>(null)
  const [coffre, setCoffre] = useState<Coffre | null>(null)
  const [semaines, setSemaines] = useState<string[]>([])
  const [semaine, setSemaine] = useState(getSemaine())
  const [loading, setLoading] = useState(true)

  const load = async () => {
      setLoading(true)
      const [v, m, e, p, t, s, it, cof] = await Promise.all([getVentes({ semaine }), getMembers(), getEntrepots(), getParametres(), getTreso(), getSemaines(), getItems(), getCoffre()])
      setVentes(v); setMembres(m); setItems(it || []); setEntrepots(e); setParams(p); setTreso(t); setCoffre(cof)
      setSemaines(Array.from(new Set([getSemaine(), ...s])).sort().reverse())
      setLoading(false)
  }

  useEffect(() => { load() }, [semaine])
  useRealtime(load)

  const ventesNormales = ventes.filter(v => v.type === 'normale')
  const totalVendu = ventesNormales.reduce((s, v) => s + v.quantite, 0)
  const totalCashSale = ventesNormales.reduce((s, v) => s + v.cashSale, 0)
  const totalBenefSale = ventesNormales.reduce((s, v) => s + v.benefSale, 0)

  const statsMembres = useMemo(() => {
    if (!params) return []
    return membres.map(m => {
      const mv = ventesNormales.filter(v => v.membreId === m.uid)
      const kg = mv.filter(v => items.find(i => i.id === v.itemId)?.compteQuota !== false).reduce((s, v) => s + v.quantite, 0)
      const cashSale = mv.reduce((s, v) => s + v.cashSale, 0)
      const benefSale = mv.reduce((s, v) => s + v.benefSale, 0)
      const pct = Math.min(100, (kg / params.quotaIndividuel) * 100)
      return { ...m, kg, cashSale, benefSale, pct }
    }).sort((a, b) => {
      // Rôle système d'abord
      const sysOrder = ['lead', 'co-lead']
      const ai = sysOrder.indexOf(a.role); const bi = sysOrder.indexOf(b.role)
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      // Ordre du rôle secondaire
      const aCr = a.customRoleId ? customRoles.find((r: any) => r.id === a.customRoleId) : null
      const bCr = b.customRoleId ? customRoles.find((r: any) => r.id === b.customRoleId) : null
      const aOrdre = aCr ? (aCr as any).ordre : 9999
      const bOrdre = bCr ? (bCr as any).ordre : 9999
      if (aOrdre !== bOrdre) return aOrdre - bOrdre
      // Enfin par kg vendus
      return b.kg - a.kg
    })
  }, [membres, ventes, params])

  const mesStats = statsMembres.find(m => m.uid === profile?.uid)
  const semaineIdx = semaines.indexOf(semaine)
  const tresoObjectif = params?.tresoObjectif || 1500000
  const tresoSolde = treso?.solde || 0
  const coffreSolde = coffre?.solde || 0
const totalCombine = tresoSolde + coffreSolde
  // Classement trié par kg pour la vue globale membre
  const classementVentes = useMemo(() => {
    return [...statsMembres].sort((a, b) => b.kg - a.kg)
  }, [statsMembres])

  const tresoPct = Math.min(100, (totalCombine / tresoObjectif) * 100)
  const objectifGlobal = params?.objectifGlobal || 3000
  const progressGlobal = Math.min(100, (totalVendu / objectifGlobal) * 100)

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Bonjour, {profile?.pseudo} 👋</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>Semaine {semaine}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2" onClick={() => semaineIdx < semaines.length - 1 && setSemaine(semaines[semaineIdx + 1])} disabled={semaineIdx >= semaines.length - 1}><ChevronLeft size={16} /></button>
            <div className="card px-3 py-2 text-sm font-bold text-white min-w-[110px] text-center">{semaine === getSemaine() ? '📅 En cours' : semaine}</div>
            <button className="btn-ghost p-2" onClick={() => semaineIdx > 0 && setSemaine(semaines[semaineIdx - 1])} disabled={semaineIdx <= 0}><ChevronRight size={16} /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* TRÉSO COMMUNE */}
            <div className="card p-6">
              <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Objectifs du gang</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Trésorerie</div>
                      <div className="text-2xl font-black" style={{ color: '#4ade80' }}>{formatMoney(tresoSolde)}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--blocc-muted)' }}>
                        Progression vers objectif : <strong style={{ color: '#4ade80' }}>{formatMoney(totalCombine)}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black" style={{ color: tresoPct >= 100 ? '#4ade80' : '#60a5fa' }}>{Math.round(tresoPct)}%</div>
                      <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>/ {formatMoney(tresoObjectif)}</div>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${tresoPct}%`, background: tresoPct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#1e6bff,#00bfff)' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Volume vendu</div>
                      <div className="text-2xl font-black" style={{ color: '#60a5fa' }}>{formatKg(totalVendu)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black" style={{ color: progressGlobal >= 100 ? '#4ade80' : '#a78bfa' }}>{Math.round(progressGlobal)}%</div>
                      <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>/ {formatKg(objectifGlobal)}</div>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressGlobal}%`, background: progressGlobal >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Stats groupe semaine */}
            <div className="card p-6">
              <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Groupe — semaine {semaine}</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-black text-white">{formatKg(totalVendu)}</div>
                  <div className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Kg vendus</div>
                </div>
                <div className="text-center border-x" style={{ borderColor: 'var(--blocc-border)' }}>
                  <div className="text-2xl font-black" style={{ color: '#60a5fa' }}>{formatMoney(totalCashSale)}</div>
                  <div className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Ventes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black" style={{ color: '#4ade80' }}>{formatMoney(totalBenefSale)}</div>
                  <div className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Profit</div>
                </div>
              </div>
            </div>

            {/* Mon quota */}
            {params && mesStats && (
              <div className="card p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--blocc-muted)' }}>Mon quota</div>
                    <div className="text-xl font-black text-white">{formatKg(mesStats.kg)} <span className="text-base font-normal" style={{ color: 'var(--blocc-muted)' }}>/ {formatKg(params.quotaIndividuel)}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black" style={{ color: mesStats.pct >= 100 ? '#4ade80' : '#60a5fa' }}>{Math.round(mesStats.pct)}%</div>
                    {mesStats.pct >= 100 && <div className="text-xs flex items-center gap-1 justify-end" style={{ color: '#4ade80' }}><CheckCircle size={12} /> Quota atteint</div>}
                  </div>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${mesStats.pct}%`, background: mesStats.pct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : undefined }} /></div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div><div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Ventes</div><div className="text-sm font-bold" style={{ color: '#60a5fa' }}>{formatMoney(mesStats.cashSale)}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Profit</div><div className="text-sm font-bold" style={{ color: '#4ade80' }}>{formatMoney(mesStats.benefSale)}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Salaire estimé</div><div className="text-sm font-bold text-white">{formatMoney(calculerSalaire(mesStats.kg, params))}</div></div>
                </div>
              </div>
            )}

            {/* Entrepôts — vue lecture */}
            <div className="card p-6">
              <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Stock des entrepôts</div>
              {entrepots.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--blocc-muted)' }}>Aucun entrepôt</p>
              ) : (
                <div className="space-y-4">
                  {entrepots.map(e => {
                    const stockTotal = e.stocks.reduce((s, st) => s + st.quantite, 0)
                    const pct = e.capaciteMax > 0 ? Math.min(100, stockTotal / e.capaciteMax * 100) : 0
                    return (
                      <div key={e.id}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-white text-sm flex items-center gap-2"><Package size={14} style={{ color: '#60a5fa' }} />{e.nom}</div>
                          <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>{formatKg(stockTotal)} / {formatKg(e.capaciteMax)} <span className="font-bold" style={{ color: pct >= 90 ? '#f87171' : pct >= 60 ? '#fbbf24' : '#60a5fa' }}>({Math.round(pct)}%)</span></div>
                        </div>
                        <div className="progress-bar mb-2"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                        {e.stocks.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {e.stocks.map(s => (
                              <div key={s.itemId} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                                <span className="font-semibold text-white">{s.itemNom}</span>
                                <span style={{ color: '#60a5fa' }}>{formatKg(s.quantite)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {e.stocks.length === 0 && <p className="text-xs" style={{ color: 'var(--blocc-muted)' }}>Entrepôt vide</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Classement */}
            {params && (
              <div className="card p-6">
                <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Classement membres</div>
                <div className="space-y-3">
                  {classementVentes.map((m, idx) => (
                    <div key={m.uid} className="rounded-xl p-4" style={{ background: m.uid === profile?.uid ? 'rgba(30,107,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${m.uid === profile?.uid ? 'rgba(30,107,255,0.3)' : 'var(--blocc-border)'}` }}>
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-bold w-5" style={{ color: idx === 0 ? '#fbbf24' : 'var(--blocc-muted)' }}>#{idx + 1}</div>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--blocc-blue)' }}>{m.pseudo[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                          {m.pseudo}
                          {m.uid === profile?.uid && <span className="text-xs" style={{ color: 'var(--blocc-muted)' }}>(moi)</span>}
                          {(() => { const rd = getRoleDisplay(m.role, m.customRoleId, customRoles); return <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: rd.couleur + '22', color: rd.couleur }}>{rd.label}</span> })()}
                        </span>
                            <span className="text-xs font-bold" style={{ color: m.pct >= 100 ? '#4ade80' : 'var(--blocc-muted)' }}>{Math.round(m.pct)}%</span>
                          </div>
                          <div className="progress-bar"><div className="progress-fill" style={{ width: `${m.pct}%`, background: m.pct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : undefined }} /></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 pl-10">
                        <div><div className="text-[10px] uppercase" style={{ color: 'var(--blocc-muted)' }}>Kg</div><div className="text-xs font-bold text-white">{formatKg(m.kg)}</div></div>
                        <div><div className="text-[10px] uppercase" style={{ color: 'var(--blocc-muted)' }}>Ventes</div><div className="text-xs font-bold" style={{ color: '#60a5fa' }}>{formatMoney(m.cashSale)}</div></div>
                        <div><div className="text-[10px] uppercase" style={{ color: 'var(--blocc-muted)' }}>Bénéf</div><div className="text-xs font-bold" style={{ color: '#4ade80' }}>{formatMoney(m.benefSale)}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
