'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import { getEntrepots, getItems, createEntrepot, updateEntrepot, rechargerEntrepot, deleteEntrepot, transfererStock } from '@/lib/db'
import { Entrepot, Item } from '@/types'
import { formatKg, formatMoney } from '@/lib/utils'
import { Package, Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronUp, ArrowRightLeft } from 'lucide-react'

export default function StockPage() {
  const { profile, hasPermission, isLead } = useAuth()
  const router = useRouter()
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [rechargeId, setRechargeId] = useState<string | null>(null)
  const [transferId, setTransferId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [newNom, setNewNom] = useState('')
  const [newCapacite, setNewCapacite] = useState('1500')
  const [editNom, setEditNom] = useState('')
  const [editCapacite, setEditCapacite] = useState('')

  const [rechargeItemId, setRechargeItemId] = useState('')
  const [rechargeQty, setRechargeQty] = useState('')
  const [rechargePrix, setRechargePrix] = useState('')

  const [transferItemId, setTransferItemId] = useState('')
  const [transferQty, setTransferQty] = useState('')
  const [transferDestId, setTransferDestId] = useState('')

  const [error, setError] = useState('')

  const canGerer = isLead || hasPermission('gerer_stock')

  useEffect(() => {
    if (profile && !hasPermission('voir_stock') && !hasPermission('gerer_stock')) {
      router.replace('/dashboard')
    }
  }, [profile])

  const load = async () => {
    const [e, i] = await Promise.all([getEntrepots(), getItems()])
    setEntrepots(e); setItems(i); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError('')
    if (!newNom.trim() || Number(newCapacite) <= 0) return setError('Données invalides')
    await createEntrepot(newNom.trim(), Number(newCapacite))
    setNewNom(''); setNewCapacite('1500'); setShowCreate(false); load()
  }

  const handleEditSave = async (id: string) => {
    setError('')
    const e = entrepots.find(x => x.id === id)
    const stockActuel = e?.stocks.reduce((s, st) => s + st.quantite, 0) || 0
    if (Number(editCapacite) < stockActuel) return setError(`Capacité trop faible (stock: ${formatKg(stockActuel)})`)
    await updateEntrepot(id, { nom: editNom.trim(), capaciteMax: Number(editCapacite) })
    setEditId(null); load()
  }

  const handleRecharge = async (id: string) => {
    setError('')
    const qty = Number(rechargeQty); const prix = Number(rechargePrix)
    if (!rechargeItemId || qty <= 0 || prix <= 0) return setError('Données invalides')
    const e = entrepots.find(x => x.id === id)
    const stockActuel = e?.stocks.reduce((s, st) => s + st.quantite, 0) || 0
    if (e?.capaciteMax && stockActuel + qty > e.capaciteMax) return setError('Capacité dépassée')
    const item = items.find(i => i.id === rechargeItemId)
    await rechargerEntrepot(id, rechargeItemId, item?.nom || rechargeItemId, qty, prix)
    setRechargeId(null); setRechargeQty(''); setRechargePrix(''); setRechargeItemId(''); load()
  }

  const handleTransfert = async (fromId: string) => {
    setError('')
    const qty = Number(transferQty)
    if (!transferItemId) return setError('Choisis un item')
    if (qty <= 0) return setError('Quantité invalide')
    if (!transferDestId) return setError('Choisis un entrepôt de destination')
    if (transferDestId === fromId) return setError('Source et destination identiques')

    const from = entrepots.find(e => e.id === fromId)
    const stockFrom = from?.stocks.find(s => s.itemId === transferItemId)
    if (!stockFrom || stockFrom.quantite < qty) return setError(`Stock insuffisant : ${formatKg(stockFrom?.quantite || 0)} disponibles`)

    const to = entrepots.find(e => e.id === transferDestId)
    const stockTo = to?.stocks.reduce((s, st) => s + st.quantite, 0) || 0
    if (to?.capaciteMax && stockTo + qty > to.capaciteMax) return setError(`Capacité de destination dépassée`)

    const item = items.find(i => i.id === transferItemId)
    await transfererStock(fromId, transferDestId, transferItemId, item?.nom || transferItemId, qty)
    setTransferId(null); setTransferQty(''); setTransferItemId(''); setTransferDestId(''); load()
  }

  const openTransfert = (entrepotId: string) => {
    setTransferId(transferId === entrepotId ? null : entrepotId)
    setTransferItemId(''); setTransferQty(''); setTransferDestId('')
    setRechargeId(null)
  }

  const stockTotalGlobal = entrepots.reduce((s, e) => s + e.stocks.reduce((a, b) => a + ((b as any).occupePlace !== false ? b.quantite : 0), 0), 0)
  const stockTotalAvecHors = entrepots.reduce((s, e) => s + e.stocks.reduce((a, b) => a + b.quantite, 0), 0)
  const capaciteTotale = entrepots.reduce((s, e) => s + (e.capaciteMax || 0), 0)

  useRealtime(load)

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Stock</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>
              Total : <strong className="text-white">{formatKg(stockTotalGlobal)}</strong>
              {capaciteTotale > 0 && <> / <strong className="text-white">{formatKg(capaciteTotale)}</strong></>}
              {stockTotalAvecHors !== stockTotalGlobal && <span style={{ color: '#a78bfa' }}> · {formatKg(stockTotalAvecHors - stockTotalGlobal)} hors capacité</span>}
            </p>
          </div>
          {canGerer && (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Nouvel entrepôt
            </button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-400 px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {canGerer && showCreate && (
          <form onSubmit={handleCreate} className="card p-6 grid grid-cols-1 md:grid-cols-[1fr_180px_auto_auto] gap-3">
            <input className="input" placeholder="Nom entrepôt" value={newNom} onChange={e => setNewNom(e.target.value)} autoFocus />
            <input className="input" type="number" min="1" placeholder="Capacité max (kg)" value={newCapacite} onChange={e => setNewCapacite(e.target.value)} />
            <button type="submit" className="btn-primary">Créer</button>
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Annuler</button>
          </form>
        )}

        {entrepots.length === 0 ? (
          <div className="card p-12 text-center" style={{ color: 'var(--blocc-muted)' }}>
            <Package size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Aucun entrepôt</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entrepots.map(e => {
              const stockE = e.stocks.reduce((s, st) => s + st.quantite, 0)
              const stockOccupe = e.stocks.reduce((s, st) => s + ((st as any).occupePlace !== false ? st.quantite : 0), 0)
              const pct = e.capaciteMax > 0 ? Math.min(100, stockOccupe / e.capaciteMax * 100) : 0

              return (
                <div key={e.id} className="card p-6">
                  {editId === e.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_auto_auto] gap-3">
                      <input className="input" value={editNom} onChange={ev => setEditNom(ev.target.value)} autoFocus />
                      <input className="input" type="number" min="1" value={editCapacite} onChange={ev => setEditCapacite(ev.target.value)} />
                      <button className="btn-primary" onClick={() => handleEditSave(e.id)}>Sauver</button>
                      <button className="btn-ghost" onClick={() => setEditId(null)}>Annuler</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="text-lg font-bold text-white">{e.nom}</div>
                          <div className="text-3xl font-black mt-1" style={{ color: pct >= 90 ? '#f87171' : pct >= 60 ? '#fbbf24' : '#60a5fa' }}>
                            {formatKg(stockOccupe)} <span className="text-base font-normal" style={{ color: 'var(--blocc-muted)' }}>/ {formatKg(e.capaciteMax)}</span>
                          </div>
                          {stockE !== stockOccupe && (
                            <div className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>
                              + {formatKg(stockE - stockOccupe)} hors capacité (kits, équipements...)
                            </div>
                          )}
                          <div className="progress-bar mt-3">
                            <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? 'linear-gradient(90deg,#ef4444,#f87171)' : undefined }} />
                          </div>
                          <div className="text-xs mt-2" style={{ color: 'var(--blocc-muted)' }}>Remplissage : <strong className="text-white">{Math.round(pct)}%</strong></div>
                        </div>
                        {canGerer && (
                          <div className="flex gap-2 flex-wrap justify-end">
                            <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }}
                              onClick={() => { setRechargeId(rechargeId === e.id ? null : e.id); setTransferId(null); setRechargeItemId(items[0]?.id || ''); setRechargePrix(String(items[0]?.prixAchat || '')) }}
                              title="Recharger"><RefreshCw size={15} /></button>
                            <button className="p-2 rounded-lg" style={{ color: e.stocks.length > 0 ? '#a78bfa' : 'var(--blocc-muted)', background: e.stocks.length > 0 ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.05)' }}
                              onClick={() => openTransfert(e.id)}
                              title="Transférer vers un autre entrepôt" disabled={e.stocks.length === 0}>
                              <ArrowRightLeft size={15} />
                            </button>
                            <button className="p-2 rounded-lg" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }}
                              onClick={() => { setEditId(e.id); setEditNom(e.nom); setEditCapacite(String(e.capaciteMax)) }}
                              title="Modifier"><Pencil size={15} /></button>
                            <button className="p-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                              onClick={async () => { if (!confirm('Supprimer cet entrepôt ?')) return; await deleteEntrepot(e.id); load() }}
                              title="Supprimer"><Trash2 size={15} /></button>
                          </div>
                        )}
                      </div>

                      {/* Détail par item */}
                      {e.stocks.length > 0 && (
                        <div className="mt-3">
                          <button className="flex items-center gap-1 text-xs" style={{ color: 'var(--blocc-muted)' }}
                            onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                            {expandedId === e.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Détail items ({e.stocks.length})
                          </button>
                          {expandedId === e.id && (
                            <div className="mt-2 space-y-1">
                              {e.stocks.map(s => (
                                <div key={s.itemId} className="flex justify-between text-xs px-3 py-2 rounded"
                                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                                  <span className="font-semibold text-white">{s.itemNom}</span>
                                  <span style={{ color: 'var(--blocc-muted)' }}>
                                    {formatKg(s.quantite)} · {formatMoney(s.prixAchatUnitaire)}/kg · val: {formatMoney(s.quantite * s.prixAchatUnitaire)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Formulaire recharge */}
                      {canGerer && rechargeId === e.id && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--blocc-border)' }}>
                          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--blocc-muted)' }}>
                            Recharger — coût déduit de la tréso
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_auto_auto] gap-3">
                            <div>
                              <label className="label">Item</label>
                              <select className="input" value={rechargeItemId} onChange={ev => {
                                setRechargeItemId(ev.target.value)
                                const it = items.find(i => i.id === ev.target.value)
                                if (it) setRechargePrix(String(it.prixAchat))
                              }}>
                                <option value="">-- Choisir --</option>
                                {items.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">Quantité (kg)</label>
                              <input className="input" type="number" min="1" value={rechargeQty} onChange={ev => setRechargeQty(ev.target.value)} />
                            </div>
                            <div>
                              <label className="label">Prix achat $/kg</label>
                              <input className="input" type="number" min="1" value={rechargePrix} onChange={ev => setRechargePrix(ev.target.value)} />
                            </div>
                            <button className="btn-success self-end" onClick={() => handleRecharge(e.id)}>Recharger</button>
                            <button className="btn-ghost self-end" onClick={() => setRechargeId(null)}>Annuler</button>
                          </div>
                          {rechargeQty && rechargePrix && (
                            <div className="mt-2 text-xs" style={{ color: '#f87171' }}>
                              Sortie tréso : <strong>{formatMoney(Number(rechargeQty) * Number(rechargePrix))}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Formulaire transfert */}
                      {canGerer && transferId === e.id && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--blocc-border)' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <ArrowRightLeft size={14} style={{ color: '#a78bfa' }} />
                            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a78bfa' }}>
                              Transfert vers un autre entrepôt — neutre pour la tréso
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_140px_auto_auto] gap-3">
                            <div>
                              <label className="label">Item à transférer</label>
                              <select className="input" value={transferItemId} onChange={ev => setTransferItemId(ev.target.value)}>
                                <option value="">-- Choisir --</option>
                                {e.stocks.map(s => (
                                  <option key={s.itemId} value={s.itemId}>{s.itemNom} ({formatKg(s.quantite)} dispo)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Entrepôt destination</label>
                              <select className="input" value={transferDestId} onChange={ev => setTransferDestId(ev.target.value)}>
                                <option value="">-- Choisir --</option>
                                {entrepots.filter(dest => dest.id !== e.id).map(dest => {
                                  const stockDest = dest.stocks.reduce((s, st) => s + st.quantite, 0)
                                  const place = dest.capaciteMax - stockDest
                                  return <option key={dest.id} value={dest.id}>{dest.nom} ({formatKg(place)} libre)</option>
                                })}
                              </select>
                            </div>
                            <div>
                              <label className="label">Quantité (kg)</label>
                              <input className="input" type="number" min="1"
                                max={e.stocks.find(s => s.itemId === transferItemId)?.quantite || undefined}
                                value={transferQty} onChange={ev => setTransferQty(ev.target.value)} />
                            </div>
                            <button className="self-end px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
                              onClick={() => handleTransfert(e.id)}>
                              <ArrowRightLeft size={14} /> Transférer
                            </button>
                            <button className="btn-ghost self-end" onClick={() => setTransferId(null)}>Annuler</button>
                          </div>
                          {transferItemId && transferQty && (
                            <div className="mt-2 text-xs" style={{ color: '#a78bfa' }}>
                              Déplacement interne — aucune incidence sur la trésorerie
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
