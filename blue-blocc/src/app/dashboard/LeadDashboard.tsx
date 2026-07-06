'use client'

import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import {
  getVentes, getMembers, getEntrepots, getParametres, getTreso, getDemandes, getSemaines,
  setParametres, createMember, updateMemberRole, updateMemberPassword, deleteMember,
  getItems, createItem, updateItem, deleteItem, updateItemPrixVente, getRendements, nettoyerHistorique,
  createEntrepot, updateEntrepot, rechargerEntrepot, deleteEntrepot, resetTreso, checkResetHebdo, resetTresoManuel, resetTresPur, getCoffre
} from '@/lib/db'
import { Vente, Member, Entrepot, Parametres, Treso, Coffre, Item, DemandeStock } from '@/types'
import { formatMoney, formatKg, getSemaine, calculerSalaire, getRoleDisplay } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Package,
  Users, DollarSign, Plus, Pencil, Trash2, Check, X, Save,
  AlertCircle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, Clock
} from 'lucide-react'

type Tab = 'global' | 'compta' | 'membres' | 'payes'

export default function LeadDashboard() {
  const { profile, hasPermission, isLead, customRoles } = useAuth()
  const [tab, setTab] = useState<Tab>('global')
  const [semaine, setSemaine] = useState(getSemaine())
  const [semaines, setSemaines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Data
  const [ventes, setVentes] = useState<Vente[]>([])
  const [membres, setMembres] = useState<Member[]>([])
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [params, setParams] = useState<Parametres | null>(null)
  const [treso, setTreso] = useState<Treso | null>(null)
  const [coffre, setCoffre] = useState<Coffre | null>(null)
  const [demandes, setDemandes] = useState<DemandeStock[]>([])
  const [items, setItems] = useState<Item[]>([])

  const load = async () => {
    setLoading(true)
    // Nettoyage auto de l'historique (lead seulement)
    nettoyerHistorique().catch(() => {})
    checkResetHebdo().catch(() => {})
    const [v, m, e, p, t, d, i, s, cof] = await Promise.all([
      getVentes({ semaine }), getMembers(), getEntrepots(), getParametres(),
      getTreso(), getDemandes({ statut: 'en_attente' }), getItems(), getSemaines(), getCoffre()
    ])
    setVentes(v); setMembres(m); setEntrepots(e); setParams(p)
    setTreso(t); setCoffre(cof); setDemandes(d); setItems(i)
    setSemaines(Array.from(new Set([getSemaine(), ...s])).sort().reverse())
    setLoading(false)
  }

  useEffect(() => { load() }, [semaine])

  const ventesNormales = ventes.filter(v => v.type === 'normale')
  const ventesNulles = ventes.filter(v => v.type === 'nulle')
  const totalVendu = ventesNormales.reduce((s, v) => s + v.quantite, 0)
  const totalCashSale = ventesNormales.reduce((s, v) => s + v.cashSale, 0)
  const totalBenefSale = ventesNormales.reduce((s, v) => s + v.benefSale, 0)
  const totalCouts = ventesNormales.reduce((s, v) => s + v.coutAchat, 0)
  const totalPertes = ventesNulles.reduce((s, v) => s + v.coutAchat, 0)
  const stockTotal = entrepots.reduce((s, e) => s + e.stocks.reduce((a, b) => a + b.quantite, 0), 0)
  const capaciteTotale = entrepots.reduce((s, e) => s + e.capaciteMax, 0)

  const statsMembres = useMemo(() => {
    if (!params) return []
    return membres.map(m => {
      const mv = ventesNormales.filter(v => v.membreId === m.uid)
      const mn = ventesNulles.filter(v => v.membreId === m.uid)
      const kg = mv.reduce((s, v) => s + v.quantite, 0)
      const cashSale = mv.reduce((s, v) => s + v.cashSale, 0)
      const benefSale = mv.reduce((s, v) => s + v.benefSale, 0)
      const pertes = mn.reduce((s, v) => s + v.coutAchat, 0)
      const salaire = calculerSalaire(kg, params)
      const pct = Math.min(100, (kg / params.quotaIndividuel) * 100)
      return { ...m, kg, cashSale, benefSale, pertes, salaire, pct }
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

  // Classement par kg pour le dashboard (vue globale)
  const classementVentes = useMemo(() => {
    return [...statsMembres].sort((a, b) => b.kg - a.kg)
  }, [statsMembres])

  const semaineIdx = semaines.indexOf(semaine)
  const tresoSolde = treso?.solde || 0
  const coffreSolde = coffre?.solde || 0
  const totalCombine = tresoSolde + coffreSolde
  const tresoObjectif = params?.tresoObjectif || 1500000
  const tresoPct = Math.min(100, (totalCombine / tresoObjectif) * 100)
  const progressGlobal = params ? Math.min(100, (totalVendu / params.objectifGlobal) * 100) : 0

  const tabs: { id: Tab; label: string }[] = [
    { id: 'global', label: '📊 Vue globale' },
    { id: 'compta', label: '💊 Compta drogue' },
    { id: 'membres', label: '👥 Membres' },
    { id: 'payes', label: '💰 Payes' },
  ]

  useRealtime(load)

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">{params?.nomGang || 'Rollin Blues'} — Lead Panel</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>Connecté : {profile?.pseudo} · {profile?.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2" onClick={() => semaineIdx < semaines.length - 1 && setSemaine(semaines[semaineIdx + 1])} disabled={semaineIdx >= semaines.length - 1}><ChevronLeft size={16} /></button>
            <div className="card px-3 py-2 text-sm font-bold text-white min-w-[110px] text-center">{semaine === getSemaine() ? '📅 En cours' : semaine}</div>
            <button className="btn-ghost p-2" onClick={() => semaineIdx > 0 && setSemaine(semaines[semaineIdx - 1])} disabled={semaineIdx <= 0}><ChevronRight size={16} /></button>
          </div>
        </div>

        {demandes.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer" onClick={() => window.location.href='/demandes'}
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
            <AlertCircle size={16} /> {demandes.length} demande{demandes.length > 1 ? 's' : ''} en attente de validation → Aller aux demandes
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t.id ? 'var(--blocc-blue)' : 'rgba(255,255,255,0.05)',
                color: tab === t.id ? '#fff' : 'var(--blocc-muted)',
                border: `1px solid ${tab === t.id ? 'var(--blocc-blue)' : 'var(--blocc-border)'}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {tab === 'global' && <TabGlobal {...{ tresoSolde, tresoObjectif, tresoPct, totalVendu, totalCashSale, totalBenefSale, totalCouts, totalPertes, stockTotal, capaciteTotale, progressGlobal, params, statsMembres: classementVentes, semaine, treso, customRoles, coffreSolde, totalCombine }} />}
            {tab === 'compta' && <TabCompta {...{ entrepots, items, ventes, semaine, params, load }} />}
            {tab === 'membres' && <TabMembres {...{ membres, statsMembres, params, semaine, load, customRoles }} />}
            {tab === 'payes' && <TabPayes {...{ statsMembres, params, load }} />}
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ─── TAB GLOBAL ──────────────────────────────────────────────────────────────
function TabGlobal({ tresoSolde, tresoObjectif, tresoPct, totalVendu, totalCashSale, totalBenefSale, totalCouts, totalPertes, stockTotal, capaciteTotale, progressGlobal, params, statsMembres, semaine, treso, customRoles, coffreSolde, totalCombine }: any) {
  const [editTreso, setEditTreso] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')
  const [objectifInput, setObjectifInput] = useState('')
  const [nomGangInput, setNomGangInput] = useState('')
  const [objectifKgInput, setObjectifKgInput] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSaveTreso = async () => {
    setSaving(true)
    await setParametres({
      ...(capitalInput ? { tresoCapitalInitial: Number(capitalInput) } : {}),
      ...(objectifInput ? { tresoObjectif: Number(objectifInput) } : {}),
      ...(nomGangInput ? { nomGang: nomGangInput } : {}),
      ...(objectifKgInput ? { objectifGlobal: Number(objectifKgInput) } : {}),
    })
    setEditTreso(false); setSaving(false)
    window.location.reload()
  }

  const mouvements = treso?.mouvements?.slice(0, 8) || []

  return (
    <div className="space-y-6">
      {/* Tréso */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Trésorerie commune</div>
          <button className="btn-ghost text-xs py-1 px-3 flex items-center gap-1" onClick={() => { setEditTreso(!editTreso); setCapitalInput(String(params?.tresoCapitalInitial || 0)); setObjectifInput(String(params?.tresoObjectif || 1500000)); setNomGangInput(params?.nomGang || ''); setObjectifKgInput(String(params?.objectifGlobal || 3000)) }}>
            <Pencil size={12} /> Configurer
          </button>
        </div>

        {editTreso && (
          <div className="mb-5 p-4 rounded-lg space-y-3" style={{ background: 'rgba(30,107,255,0.08)', border: '1px solid rgba(30,107,255,0.2)' }}>
            <div className="text-xs font-bold uppercase tracking-wide text-white mb-2">Configuration</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><label className="label">Nom du gang</label><input className="input" value={nomGangInput} onChange={e => setNomGangInput(e.target.value)} /></div>
              <div><label className="label">Capital initial ($)</label><input className="input" type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)} /></div>
              <div><label className="label">Objectif tréso ($)</label><input className="input" type="number" value={objectifInput} onChange={e => setObjectifInput(e.target.value)} /></div>
              <div><label className="label">Objectif ventes (kg)</label><input className="input" type="number" value={objectifKgInput} onChange={e => setObjectifKgInput(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" onClick={handleSaveTreso} disabled={saving}><Save size={12} /> Sauvegarder</button>
              <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setEditTreso(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-4xl font-black" style={{ color: tresoSolde >= 0 ? '#4ade80' : '#f87171' }}>{formatMoney(tresoSolde)}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>objectif : {formatMoney(tresoObjectif)}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--blocc-muted)' }}>Progression vers objectif : <strong style={{ color: '#4ade80' }}>{formatMoney(totalCombine)}</strong></div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black" style={{ color: tresoPct >= 100 ? '#4ade80' : '#60a5fa' }}>{Math.round(tresoPct)}%</div>
          </div>
        </div>
        <div className="progress-bar mb-4">
          <div className="progress-fill" style={{ width: `${tresoPct}%`, background: tresoPct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#1e6bff,#00bfff)' }} />
        </div>

        <div className="flex gap-2 mb-4">
          <button className="btn-danger text-xs py-1.5 px-3 flex items-center gap-2" onClick={() => {
            if (confirm('Reset complet ? Efface le solde ET tout l\'historique. Pour corriger une erreur uniquement.')) {
              resetTresPur().then(() => window.location.reload())
            }
          }}>
            Remettre la tréso à zéro
          </button>
        </div>

        {mouvements.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--blocc-muted)' }}>Derniers mouvements</div>
            <div className="space-y-1">
              {mouvements.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'var(--blocc-muted)' }}>{m.label}</span>
                  <span className="font-bold" style={{ color: m.type === 'entree' ? '#4ade80' : m.type === 'sortie' ? '#f87171' : '#60a5fa' }}>
                    {m.type === 'entree' ? '+' : m.type === 'sortie' ? '-' : ''}{formatMoney(m.montant)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats semaine */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Kg vendus', value: formatKg(totalVendu), color: '#3b82f6' },
          { label: 'Ventes', value: formatMoney(totalCashSale), color: '#60a5fa' },
          { label: 'Profit', value: formatMoney(totalBenefSale), color: '#4ade80' },
          { label: 'Coût', value: formatMoney(totalCouts), color: '#00bfff' },
          { label: 'Pertes', value: formatMoney(totalPertes), color: '#f87171' },
          { label: 'Stock total', value: capaciteTotale ? `${formatKg(stockTotal)}/${formatKg(capaciteTotale)}` : formatKg(stockTotal), color: '#818cf8' },
          { label: 'Membres', value: `${statsMembres.length}`, color: '#f472b6' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--blocc-muted)' }}>{s.label}</div>
            <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Objectif ventes */}
      <div className="card p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--blocc-muted)' }}>Objectif ventes — semaine {semaine}</div>
            <div className="text-3xl font-black" style={{ color: '#60a5fa' }}>{formatKg(totalVendu)}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black" style={{ color: progressGlobal >= 100 ? '#4ade80' : '#a78bfa' }}>{Math.round(progressGlobal)}%</div>
            <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>/ {params ? formatKg(params.objectifGlobal) : '—'}</div>
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressGlobal}%`, background: progressGlobal >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#7c3aed,#a78bfa)' }} />
        </div>
      </div>

      {/* Classement */}
      {params && (
        <div className="card p-6">
          <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Classement membres — semaine {semaine}</div>
          <div className="space-y-3">
            {statsMembres.map((m: any, idx: number) => (
              <div key={m.uid} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold w-5" style={{ color: idx === 0 ? '#fbbf24' : 'var(--blocc-muted)' }}>#{idx + 1}</div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--blocc-blue)' }}>{m.pseudo[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                        {m.pseudo}
                        {(() => { const rd = getRoleDisplay(m.role, m.customRoleId, customRoles); return <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: rd.couleur + '22', color: rd.couleur }}>{rd.label}</span> })()}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--blocc-muted)' }}>{formatKg(m.kg)} / {formatKg(params.quotaIndividuel)}</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${m.pct}%`, background: m.pct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : undefined }} /></div>
                  </div>
                  <div className="text-xs font-bold w-8 text-right" style={{ color: m.pct >= 100 ? '#4ade80' : 'var(--blocc-muted)' }}>{Math.round(m.pct)}%</div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 pl-10 text-xs">
                  <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Kg</div><div className="font-bold text-white">{formatKg(m.kg)}</div></div>
                  <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Ventes</div><div className="font-bold" style={{ color: '#60a5fa' }}>{formatMoney(m.cashSale)}</div></div>
                  <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Bénéf</div><div className="font-bold" style={{ color: '#4ade80' }}>{formatMoney(m.benefSale)}</div></div>
                  <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Pertes</div><div className="font-bold" style={{ color: '#f87171' }}>{formatMoney(m.pertes)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB COMPTA ──────────────────────────────────────────────────────────────
function TabCompta({ entrepots, items, ventes, semaine, params, load }: any) {
  const [showCreate, setShowCreate] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newCap, setNewCap] = useState('1500')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')
  const [editCap, setEditCap] = useState('')
  const [rechargeId, setRechargeId] = useState<string | null>(null)
  const [rechargeItemId, setRechargeItemId] = useState('')
  const [rechargeQty, setRechargeQty] = useState('')
  const [rechargePrix, setRechargePrix] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Items management
  const [showNewItem, setShowNewItem] = useState(false)
  const [newItemNom, setNewItemNom] = useState('')
  const [newItemPrix, setNewItemPrix] = useState('')
  const [newItemUnite, setNewItemUnite] = useState('kg')
  const [newItemRequireStock, setNewItemRequireStock] = useState(true)
  const [newItemOccupePlace, setNewItemOccupePlace] = useState(true)
  const [newItemCompteQuota, setNewItemCompteQuota] = useState(true)
  const [newItemPrixVente, setNewItemPrixVente] = useState('')
  const [editItemPrixVente, setEditItemPrixVente] = useState('')
  const [rendements, setRendements] = useState<import('@/types').RendementItem[]>([])
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [editItemNom, setEditItemNom] = useState('')
  const [editItemPrix, setEditItemPrix] = useState('')
  const [editItemUnite, setEditItemUnite] = useState('kg')

  useEffect(() => { getRendements().then(setRendements) }, [ventes, items])

  const handleCreateEntrepot = async (ev: any) => {
    ev.preventDefault(); setError('')
    if (!newNom.trim() || Number(newCap) <= 0) return setError('Données invalides')
    await createEntrepot(newNom.trim(), Number(newCap))
    setNewNom(''); setNewCap('1500'); setShowCreate(false); load()
  }

  const handleEditEntrepot = async (id: string) => {
    setError('')
    const e = entrepots.find((x: any) => x.id === id)
    const stockActuel = e?.stocks.reduce((s: number, st: any) => s + st.quantite, 0) || 0
    if (Number(editCap) < stockActuel) return setError(`Capacité trop faible (stock actuel: ${formatKg(stockActuel)})`)
    await updateEntrepot(id, { nom: editNom.trim(), capaciteMax: Number(editCap) })
    setEditId(null); load()
  }

  const handleRecharge = async (id: string) => {
    setError('')
    const qty = Number(rechargeQty); const prix = Number(rechargePrix)
    if (!rechargeItemId || qty <= 0 || prix <= 0) return setError('Données invalides')
    const e = entrepots.find((x: any) => x.id === id)
    const stockActuel = e?.stocks.reduce((s: number, st: any) => s + st.quantite, 0) || 0
    if (e?.capaciteMax && stockActuel + qty > e.capaciteMax) return setError(`Capacité dépassée`)
    const item = items.find((i: any) => i.id === rechargeItemId)
    await rechargerEntrepot(id, rechargeItemId, item?.nom || rechargeItemId, qty, prix)
    setRechargeId(null); setRechargeQty(''); setRechargePrix(''); setRechargeItemId(''); load()
  }

  const handleDeleteEntrepot = async (id: string) => {
    if (!confirm('Supprimer cet entrepôt ?')) return
    await deleteEntrepot(id); load()
  }

  const ventesNormales = ventes.filter((v: any) => v.type === 'normale')
  const ventesNulles = ventes.filter((v: any) => v.type === 'nulle')

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-red-400 px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {/* Items */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Produits / Items</div>
          <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => setShowNewItem(true)}><Plus size={13} /> Ajouter</button>
        </div>
        {showNewItem && (
          <div className="mb-4 p-4 rounded-lg" style={{ background: 'rgba(30,107,255,0.08)', border: '1px solid rgba(30,107,255,0.2)' }}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_130px_90px_auto_auto] gap-3">
              <input className="input" placeholder="Nom (Weed, Coke...)" value={newItemNom} onChange={e => setNewItemNom(e.target.value)} autoFocus />
              <input className="input" type="number" placeholder="Prix achat $" value={newItemPrix} onChange={e => setNewItemPrix(e.target.value)} />
              <input className="input" placeholder="Unité" value={newItemUnite} onChange={e => setNewItemUnite(e.target.value)} />
              <div className="flex gap-4 col-span-full">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--blocc-muted)' }}>
                  <input type="checkbox" checked={newItemRequireStock} onChange={e => setNewItemRequireStock(e.target.checked)} />
                  Nécessite du stock
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--blocc-muted)' }}>
                  <input type="checkbox" checked={newItemOccupePlace} onChange={e => setNewItemOccupePlace(e.target.checked)} />
                  Occupe de la place (capacité)
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--blocc-muted)' }}>
                  <input type="checkbox" checked={newItemCompteQuota} onChange={e => setNewItemCompteQuota(e.target.checked)} />
                  Compte dans le quota (kg)
                </label>
              </div>
              <button className="btn-primary py-2" onClick={async () => { if (!newItemNom || !newItemPrix) return; const newId = await createItem(newItemNom.trim(), Number(newItemPrix), newItemUnite, newItemRequireStock, newItemOccupePlace, newItemCompteQuota); void newId; setNewItemNom(''); setNewItemPrix(''); setNewItemUnite('kg'); setNewItemPrixVente(''); setNewItemRequireStock(true); setNewItemOccupePlace(true); setNewItemCompteQuota(true); setShowNewItem(false); load() }}><Check size={15} /></button>
              <button className="btn-ghost py-2" onClick={() => setShowNewItem(false)}><X size={15} /></button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item.id} className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
              {editItemId === item.id ? (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_130px_90px_auto_auto] gap-3">
                  <input className="input" value={editItemNom} onChange={e => setEditItemNom(e.target.value)} autoFocus />
                  <input className="input" type="number" value={editItemPrix} onChange={e => setEditItemPrix(e.target.value)} />
                  <input className="input" value={editItemUnite} onChange={e => setEditItemUnite(e.target.value)} />
                  <button className="btn-primary py-2" onClick={async () => { await updateItem(item.id, { nom: editItemNom, prixAchat: Number(editItemPrix), unite: editItemUnite }); setEditItemId(null); load() }}><Check size={15} /></button>
                  <button className="btn-ghost py-2" onClick={() => setEditItemId(null)}><X size={15} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div><span className="font-semibold text-white text-sm">{item.nom}</span><span className="text-xs ml-3" style={{ color: 'var(--blocc-muted)' }}>Prix réf: {formatMoney(item.prixAchat)}/{item.unite}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full ml-2 cursor-pointer" 
                      style={{ background: item.requireStock ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)', color: item.requireStock ? '#60a5fa' : '#a78bfa' }}
                      onClick={async () => { await updateItem(item.id, { requireStock: !item.requireStock }); load() }}
                      title="Cliquer pour changer">
                      {item.requireStock ? '📦 Stock requis' : '⚡ Sans stock'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full ml-1 cursor-pointer" 
                      style={{ background: item.occupePlace ? 'rgba(34,197,94,0.12)' : 'rgba(251,191,36,0.12)', color: item.occupePlace ? '#4ade80' : '#fbbf24' }}
                      onClick={async () => { await updateItem(item.id, { occupePlace: !item.occupePlace }); load() }}
                      title="Cliquer pour changer">
                      {item.occupePlace ? '📏 Occupe place' : '🔓 Hors capacité'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full ml-1 cursor-pointer" 
                      style={{ background: item.compteQuota ? 'rgba(251,191,36,0.12)' : 'rgba(107,130,168,0.12)', color: item.compteQuota ? '#fbbf24' : '#6b82a8' }}
                      onClick={async () => { await updateItem(item.id, { compteQuota: !item.compteQuota }); load() }}
                      title="Cliquer pour changer">
                      {item.compteQuota ? '🎯 Compte quota' : '💰 Hors quota'}
                    </span></div>
                  <div className="flex gap-2">
                    <button className="p-1.5 rounded" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }} onClick={() => { setEditItemId(item.id); setEditItemNom(item.nom); setEditItemPrix(String(item.prixAchat)); setEditItemUnite(item.unite) }}><Pencil size={13} /></button>
                    <button className="p-1.5 rounded" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }} onClick={async () => { if (!confirm('Supprimer ?')) return; await deleteItem(item.id); load() }}><Trash2 size={13} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Entrepôts */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Entrepôts</div>
          <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => setShowCreate(true)}><Plus size={13} /> Créer</button>
        </div>
        {showCreate && (
          <form onSubmit={handleCreateEntrepot} className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_160px_auto_auto] gap-3 p-4 rounded-lg" style={{ background: 'rgba(30,107,255,0.08)', border: '1px solid rgba(30,107,255,0.2)' }}>
            <input className="input" placeholder="Nom entrepôt" value={newNom} onChange={e => setNewNom(e.target.value)} autoFocus />
            <input className="input" type="number" placeholder="Capacité max (kg)" value={newCap} onChange={e => setNewCap(e.target.value)} />
            <button type="submit" className="btn-primary">Créer</button>
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
          </form>
        )}
        <div className="space-y-4">
          {entrepots.map((e: any) => {
            const stockE = e.stocks.reduce((s: number, st: any) => s + st.quantite, 0)
            const pct = e.capaciteMax > 0 ? Math.min(100, stockE / e.capaciteMax * 100) : 0
            return (
              <div key={e.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                {editId === e.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto_auto] gap-3">
                    <input className="input" value={editNom} onChange={ev => setEditNom(ev.target.value)} autoFocus />
                    <input className="input" type="number" value={editCap} onChange={ev => setEditCap(ev.target.value)} />
                    <button className="btn-primary" onClick={() => handleEditEntrepot(e.id)}>Sauver</button>
                    <button className="btn-ghost" onClick={() => setEditId(null)}>Annuler</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-white">{e.nom}</div>
                        <div className="text-2xl font-black mt-1" style={{ color: pct >= 90 ? '#f87171' : pct >= 60 ? '#fbbf24' : '#60a5fa' }}>{formatKg(stockE)} <span className="text-sm font-normal" style={{ color: 'var(--blocc-muted)' }}>/ {formatKg(e.capaciteMax)}</span></div>
                        <div className="progress-bar mt-2"><div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? 'linear-gradient(90deg,#ef4444,#f87171)' : undefined }} /></div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }} onClick={() => { setRechargeId(rechargeId === e.id ? null : e.id); setRechargeItemId(items[0]?.id || ''); setRechargePrix(String(items[0]?.prixAchat || '')) }} title="Recharger"><RefreshCw size={14} /></button>
                        <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }} onClick={() => { setEditId(e.id); setEditNom(e.nom); setEditCap(String(e.capaciteMax)) }} title="Modifier"><Pencil size={14} /></button>
                        <button className="p-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }} onClick={() => handleDeleteEntrepot(e.id)} title="Supprimer"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {e.stocks.length > 0 && (
                      <div className="mt-3">
                        <button className="flex items-center gap-1 text-xs" style={{ color: 'var(--blocc-muted)' }} onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                          {expandedId === e.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Détail ({e.stocks.length} item{e.stocks.length > 1 ? 's' : ''})
                        </button>
                        {expandedId === e.id && (
                          <div className="mt-2 space-y-1">
                            {e.stocks.map((s: any) => (
                              <div key={s.itemId} className="flex justify-between text-xs px-3 py-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                                <span className="font-semibold text-white">{s.itemNom}</span>
                                <span style={{ color: 'var(--blocc-muted)' }}>{formatKg(s.quantite)} · {formatMoney(s.prixAchatUnitaire)}/kg · val: {formatMoney(s.quantite * s.prixAchatUnitaire)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {rechargeId === e.id && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--blocc-border)' }}>
                        <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--blocc-muted)' }}>Recharger — coût déduit de la tréso</div>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_auto_auto] gap-3">
                          <div>
                            <label className="label">Item</label>
                            <select className="input" value={rechargeItemId} onChange={ev => { setRechargeItemId(ev.target.value); const it = items.find((i: any) => i.id === ev.target.value); if (it) setRechargePrix(String(it.prixAchat)) }}>
                              <option value="">-- Choisir --</option>
                              {items.map((i: any) => <option key={i.id} value={i.id}>{i.nom}</option>)}
                            </select>
                          </div>
                          <div><label className="label">Quantité (kg)</label><input className="input" type="number" min="1" value={rechargeQty} onChange={ev => setRechargeQty(ev.target.value)} /></div>
                          <div>
                            <label className="label">Prix achat $/kg</label>
                            <input className="input" type="number" min="1" value={rechargePrix} onChange={ev => setRechargePrix(ev.target.value)} />
                          </div>
                          <button className="btn-success self-end whitespace-nowrap" onClick={() => handleRecharge(e.id)}>Recharger</button>
                          <button className="btn-ghost self-end" onClick={() => setRechargeId(null)}>Annuler</button>
                        </div>
                        {rechargeQty && rechargePrix && (
                          <div className="mt-2 text-xs" style={{ color: '#f87171' }}>⚠ Sortie tréso : <strong>{formatMoney(Number(rechargeQty) * Number(rechargePrix))}</strong></div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>


      {/* Rendements */}
      <div className="card p-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Rendement par produit</div>
        <div className="space-y-3">
          {rendements.map((r: any) => (
            <div key={r.itemId} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
                <div className="font-bold text-white">{r.itemNom}</div>
                <div className="flex items-center gap-4">
                  {r.prixVenteConfig > 0 && <div className="text-xs text-right"><div style={{ color: 'var(--blocc-muted)' }}>Estimé config</div><div className="font-bold" style={{ color: '#60a5fa' }}>{r.prixVenteConfig.toLocaleString('fr-FR')} $/kg</div></div>}
                  {r.prixVenteReel > 0 && <div className="text-xs text-right"><div style={{ color: 'var(--blocc-muted)' }}>Réel moyen</div><div className="font-bold" style={{ color: '#4ade80' }}>{Math.round(r.prixVenteReel).toLocaleString('fr-FR')} $/kg</div></div>}
                  <div className="text-xl font-black" style={{ color: r.rendementReel > 0 ? (r.rendementReel >= 50 ? '#4ade80' : '#fbbf24') : '#60a5fa' }}>
                    {r.rendementReel > 0 ? Math.round(r.rendementReel) + '%' : r.rendementConfig > 0 ? '~' + Math.round(r.rendementConfig) + '%' : '—'}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs mb-2" style={{ color: 'var(--blocc-muted)' }}>
                <span>Achat : <strong className="text-white">{r.prixAchatMoyen.toLocaleString('fr-FR')} $/kg</strong></span>
                <span>Kg vendus : <strong className="text-white">{r.totalKgVendus > 0 ? r.totalKgVendus.toLocaleString('fr-FR') + ' kg' : '—'}</strong></span>
                <span>Ventes : <strong className="text-white">{r.nbVentes}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <input className="input text-xs py-1 h-7 w-36" type="number" placeholder="Prix vente $/kg" defaultValue={r.prixVenteConfig || ''}
                  onBlur={async (e: any) => { if (e.target.value) { await updateItemPrixVente(r.itemId, Number(e.target.value)); load() } }} />
                <span className="text-xs" style={{ color: 'var(--blocc-muted)' }}>Modifier prix vente estimé</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ventes semaine */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Ventes enregistrées — semaine {semaine}</div>
        </div>
        {ventes.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--blocc-muted)' }}><TrendingUp size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Aucune vente</p></div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
            {ventes.slice(0, 20).map((v: any) => (
              <div key={v.id} className="px-6 py-3 flex items-center gap-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${v.type === 'nulle' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                  {v.type === 'nulle' ? <TrendingDown size={13} className="text-red-400" /> : <TrendingUp size={13} className="text-green-400" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">
                    {v.membrePseudo} — {v.type === 'nulle' ? <span className="text-red-400">{formatKg(v.quantite)} {v.itemNom} perdus</span> : <>{formatKg(v.quantite)} {v.itemNom} — {formatMoney(v.cashSale)}</>}
                  </div>
                  <div className="text-xs mt-0.5 flex gap-3" style={{ color: 'var(--blocc-muted)' }}>
                    <span>{new Date(v.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>Coût: {formatMoney(v.coutAchat)}</span>
                    {v.type === 'normale' && <span style={{ color: v.benefSale >= 0 ? '#4ade80' : '#f87171' }}>Bénéf: {formatMoney(v.benefSale)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TAB MEMBRES ─────────────────────────────────────────────────────────────
function TabMembres({ membres, statsMembres, params, semaine, load, customRoles }: any) {
  const [showCreate, setShowCreate] = useState(false)
  const [newPseudo, setNewPseudo] = useState('')
  const [newRole, setNewRole] = useState('membre')
  const [newPwd, setNewPwd] = useState('')
  const [editRoleId, setEditRoleId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editCustomRoleId, setEditCustomRoleId] = useState<string>('')
  const [editPwdId, setEditPwdId] = useState<string | null>(null)
  const [newPwdValue, setNewPwdValue] = useState('')
  const [error, setError] = useState('')

  const handleCreate = async (ev: any) => {
    ev.preventDefault(); setError('')
    try { await createMember(newPseudo, newRole, newPwd || 'membre', 'lead'); setNewPseudo(''); setNewPwd(''); setShowCreate(false); load() }
    catch (e: any) { setError(e.message) }
  }

  return (
    <div className="space-y-6">
      {error && <div className="text-sm text-red-400 px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {/* Créer membre */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Gestion des membres</div>
          <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => setShowCreate(!showCreate)}><Plus size={13} /> Nouveau membre</button>
        </div>
        {showCreate && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_auto] gap-3 p-4 rounded-lg mb-4" style={{ background: 'rgba(30,107,255,0.08)', border: '1px solid rgba(30,107,255,0.2)' }}>
            <input className="input" placeholder="Pseudo" value={newPseudo} onChange={e => setNewPseudo(e.target.value)} autoFocus required />
            <select className="input" value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="membre">Membre</option>
              <option value="co-lead">Co-Lead</option>
              <option value="lead">Lead</option>
            </select>
            <input className="input" placeholder="Mot de passe" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <button type="submit" className="btn-primary">Créer</button>
          </form>
        )}

        <div className="space-y-3">
          {membres.map((m: any) => {
            const stats = statsMembres.find((s: any) => s.uid === m.uid)
            return (
              <div key={m.uid} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--blocc-blue)' }}>{m.pseudo[0].toUpperCase()}</div>
                    <div>
                      <div className="font-semibold text-white">{m.pseudo}</div>
                      {editRoleId === m.uid ? (
                        <div className="flex items-center gap-2 mt-1">
                          <select className="input py-0.5 text-xs h-7" value={editRole} onChange={e => setEditRole(e.target.value)}>
                            <option value="membre">Membre</option>
                            <option value="co-lead">Co-Lead</option>
                            <option value="lead">Lead</option>
                          </select>
                          <select className="input py-0.5 text-xs h-7" value={editCustomRoleId} onChange={e => setEditCustomRoleId(e.target.value)}>
                            <option value="">— Aucun —</option>
                            {customRoles.map((r: any) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                          </select>
                          <button className="text-xs btn-primary py-0.5 px-2" onClick={async () => { await updateMemberRole(m.uid, editRole, editCustomRoleId || undefined); setEditRoleId(null); load() }}>OK</button>
                          <button className="text-xs btn-ghost py-0.5 px-2" onClick={() => setEditRoleId(null)}>×</button>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-center gap-2">
                          {(() => { const rd = getRoleDisplay(m.role, m.customRoleId, customRoles); return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: rd.couleur + '22', color: rd.couleur }}>{rd.label}</span> })()}
                          <button className="opacity-60 hover:opacity-100" onClick={() => { setEditRoleId(m.uid); setEditRole(m.role); setEditCustomRoleId(m.customRoleId || '') }}><Pencil size={11} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {stats && params && (
                      <div className="text-right text-xs">
                        <div style={{ color: 'var(--blocc-muted)' }}>Semaine {semaine}</div>
                        <div className="font-bold text-white">{formatKg(stats.kg)} <span style={{ color: stats.pct >= 100 ? '#4ade80' : 'var(--blocc-muted)' }}>({Math.round(stats.pct)}%)</span></div>
                      </div>
                    )}
                    {editPwdId === m.uid ? (
                      <div className="flex items-center gap-2">
                        <input className="input py-0.5 text-xs h-7 w-32" placeholder="Nouveau mdp" value={newPwdValue} onChange={e => setNewPwdValue(e.target.value)} />
                        <button className="text-xs btn-primary py-0.5 px-2" onClick={async () => { if (!newPwdValue.trim()) return; await updateMemberPassword(m.uid, newPwdValue.trim()); setEditPwdId(null); setNewPwdValue('') }}>OK</button>
                        <button className="text-xs btn-ghost py-0.5 px-2" onClick={() => setEditPwdId(null)}>×</button>
                      </div>
                    ) : (
                      <button className="btn-ghost text-xs py-1 px-2 flex items-center gap-1" onClick={() => { setEditPwdId(m.uid); setNewPwdValue('') }}>
                        <Pencil size={11} /> Mdp
                      </button>
                    )}
                    <button className="p-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }} onClick={async () => { if (!confirm(`Supprimer ${m.pseudo} ?`)) return; await deleteMember(m.uid); load() }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {stats && params && (
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Ventes</div><div className="font-bold" style={{ color: '#60a5fa' }}>{formatMoney(stats.cashSale)}</div></div>
                    <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Profit</div><div className="font-bold" style={{ color: '#4ade80' }}>{formatMoney(stats.benefSale)}</div></div>
                    <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Pertes</div><div className="font-bold" style={{ color: '#f87171' }}>{formatMoney(stats.pertes)}</div></div>
                    <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Salaire</div><div className="font-bold text-white">{formatMoney(stats.salaire)}</div></div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── TAB PAYES ───────────────────────────────────────────────────────────────
function TabPayes({ statsMembres, params: initParams, load }: any) {
  const [params, setLocalParams] = useState(initParams)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setLocalParams(initParams) }, [initParams])

  const handleSave = async () => {
    setSaving(true)
    await setParametres({
      quotaIndividuel: params.quotaIndividuel,
      objectifGlobal: params.objectifGlobal,
      salaireBase: params.salaireBase,
      bonusMontant: params.bonusMontant,
      bonusPalier: params.bonusPalier,
    })
    setSaved(true); setSaving(false); setTimeout(() => setSaved(false), 2000)
    setEditing(false); load()
  }

  const masseSalariale = statsMembres.reduce((s: number, m: any) => s + calculerSalaire(m.kg, params), 0)

  return (
    <div className="space-y-6">
      {/* Config payes */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Variables de paye</div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1" onClick={handleSave} disabled={saving}><Save size={12} />{saved ? 'Sauvegardé ✓' : 'Sauvegarder'}</button>
                <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => { setLocalParams(initParams); setEditing(false) }}>Annuler</button>
              </>
            ) : (
              <button className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => setEditing(true)}><Pencil size={12} /> Modifier</button>
            )}
          </div>
        </div>

        {params && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Quota individuel (kg/sem)', key: 'quotaIndividuel', suffix: 'kg' },
              { label: 'Objectif groupe (kg/sem)', key: 'objectifGlobal', suffix: 'kg' },
              { label: 'Salaire de base', key: 'salaireBase', suffix: '$' },
              { label: 'Bonus par palier', key: 'bonusMontant', suffix: '$' },
              { label: 'Palier bonus (kg supp.)', key: 'bonusPalier', suffix: 'kg' },
            ].map(f => (
              <div key={f.key} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                <div className="text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>{f.label}</div>
                {editing ? (
                  <input className="input text-lg font-bold" type="number" value={(params as any)[f.key]}
                    onChange={e => setLocalParams((p: any) => ({ ...p, [f.key]: Number(e.target.value) }))} />
                ) : (
                  <div className="text-xl font-black text-white">{(params as any)[f.key].toLocaleString('fr-FR')} <span className="text-sm font-normal" style={{ color: 'var(--blocc-muted)' }}>{f.suffix}</span></div>
                )}
              </div>
            ))}
          </div>
        )}

        {params && (
          <div className="mt-5 p-4 rounded-lg" style={{ background: 'rgba(30,107,255,0.08)', border: '1px solid rgba(30,107,255,0.2)' }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-3 text-white">Simulation barème</div>
            <div className="grid grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map(i => {
                const kg = params.quotaIndividuel + i * params.bonusPalier
                const sal = i === 0 ? params.salaireBase : params.salaireBase + i * params.bonusMontant
                return (
                  <div key={i} className="text-center">
                    <div className="text-xs mb-1" style={{ color: 'var(--blocc-muted)' }}>{formatKg(kg)}</div>
                    <div className="text-sm font-black text-white">{formatMoney(sal)}</div>
                    {i > 0 && <div className="text-xs mt-0.5" style={{ color: '#4ade80' }}>+{formatMoney(i * params.bonusMontant)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Fiche de payes */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Fiche de payes — semaine en cours</div>
          <div className="text-sm font-bold" style={{ color: '#f472b6' }}>Masse salariale : {formatMoney(masseSalariale)}</div>
        </div>
        {params && (
          <div className="space-y-3">
            {statsMembres.map((m: any) => {
              const salaire = calculerSalaire(m.kg, params)
              const quotaOk = m.kg >= params.quotaIndividuel
              const depassement = Math.max(0, m.kg - params.quotaIndividuel)
              const nbPaliers = Math.floor(depassement / params.bonusPalier)
              return (
                <div key={m.uid} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${quotaOk ? 'rgba(34,197,94,0.2)' : 'var(--blocc-border)'}` }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--blocc-blue)' }}>{m.pseudo[0].toUpperCase()}</div>
                      <div>
                        <div className="font-semibold text-white">{m.pseudo}</div>
                        <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--blocc-muted)' }}>
                          {formatKg(m.kg)} vendus · quota {Math.round(m.pct)}%
                          {quotaOk ? <span className="flex items-center gap-1" style={{ color: '#4ade80' }}><CheckCircle size={11} /> Quota atteint</span>
                            : <span className="flex items-center gap-1" style={{ color: '#fbbf24' }}><Clock size={11} /> Quota non atteint</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black" style={{ color: quotaOk ? '#4ade80' : '#6b82a8' }}>{formatMoney(salaire)}</div>
                      {nbPaliers > 0 && (
                        <div className="text-xs" style={{ color: '#4ade80' }}>Base {formatMoney(params.salaireBase)} + {nbPaliers}×{formatMoney(params.bonusMontant)}</div>
                      )}
                      {!quotaOk && <div className="text-xs" style={{ color: '#fbbf24' }}>Pas de paye (quota non atteint)</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
