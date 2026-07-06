'use client'

import React, { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import { getVentes, addVente, getItems, getStockDisponible, getSemaines, getRendements, supprimerVente } from '@/lib/db'
import { Vente, Item, RendementItem } from '@/types'
import { formatMoney, formatKg, getSemaine } from '@/lib/utils'
import { Plus, AlertTriangle, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, BarChart2, Trash2 } from 'lucide-react'

export default function VentesPage() {
  const { profile, isLead, hasPermission } = useAuth()
  const [ventes, setVentes] = useState<Vente[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [rendements, setRendements] = useState<RendementItem[]>([])
  const [semaines, setSemaines] = useState<string[]>([])
  const [semaine, setSemaine] = useState(getSemaine())
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRendements, setShowRendements] = useState(false)

  const [formType, setFormType] = useState<'normale' | 'nulle'>('normale')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [quantite, setQuantite] = useState('')
  const [cashSale, setCashSale] = useState('')
  const [cashManual, setCashManual] = useState(false)
  const [stockDispo, setStockDispo] = useState<{ quantite: number; prixAchatUnitaire: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = isLead || hasPermission('voir_dashboard_lead')

  const load = async () => {
    setLoading(true)
    const [v, i, s, r] = await Promise.all([
      isAdmin ? getVentes({ semaine }) : getVentes({ membreId: profile?.uid, semaine }),
      getItems(), getSemaines(), getRendements(),
    ])
    setVentes(v); setItems(i); setRendements(r)
    setSemaines(Array.from(new Set([getSemaine(), ...s])).sort().reverse())
    if (i.length > 0 && !selectedItemId) {
      setSelectedItemId(i[0].id)
      const dispo = await getStockDisponible(i[0].id)
      setStockDispo(dispo)
    }
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [profile, semaine])

  const handleItemChange = async (itemId: string) => {
    setSelectedItemId(itemId)
    setCashManual(false)
    if (itemId) {
      const item = items.find(i => i.id === itemId)
      if (item?.requireStock !== false) {
        const dispo = await getStockDisponible(itemId)
        setStockDispo(dispo)
      } else {
        setStockDispo(null) // pas de stock requis
      }
      // Pre-fill cashSale if quantity already entered
      if (quantite) {
        const item = items.find(i => i.id === itemId)
        if (item?.prixVenteMoyen) setCashSale(String(Math.round(Number(quantite) * item.prixVenteMoyen)))
      }
    }
  }

  const handleQuantiteChange = (val: string) => {
    setQuantite(val)
    if (!cashManual && val) {
      const item = items.find(i => i.id === selectedItemId)
      if (item?.prixVenteMoyen && Number(val) > 0) {
        setCashSale(String(Math.round(Number(val) * item.prixVenteMoyen)))
      } else {
        setCashSale('')
      }
    }
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!profile || !selectedItemId) return
    setError('')
    const qty = Number(quantite)
    if (qty <= 0) { setError('Quantité invalide'); return }
    if (selectedItem?.requireStock !== false && (!stockDispo || stockDispo.prixAchatUnitaire <= 0)) { setError("Aucun stock disponible. Recharge d'abord l'entrepôt."); return }
    if (selectedItem?.requireStock !== false && stockDispo && stockDispo.quantite < qty) { setError(`Stock insuffisant : ${formatKg(stockDispo.quantite)} disponibles`); return }

    const item = selectedItem
    const prixAchat = stockDispo?.prixAchatUnitaire ?? 0
    const coutAchat = qty * prixAchat
    setSubmitting(true)

    if (formType === 'normale') {
      const cash = Number(cashSale)
      if (cash <= 0) { setError('Ventes encaissées invalide'); setSubmitting(false); return }
      await addVente({ requireStock: selectedItem?.requireStock !== false, membreId: profile.uid, membrePseudo: profile.pseudo, itemId: selectedItemId, itemNom: item?.nom || selectedItemId, quantite: qty, cashSale: cash, prixAchatUnitaire: prixAchat, coutAchat, benefSale: cash - coutAchat, type: 'normale' })
    } else {
      await addVente({ requireStock: selectedItem?.requireStock !== false, membreId: profile.uid, membrePseudo: profile.pseudo, itemId: selectedItemId, itemNom: item?.nom || selectedItemId, quantite: qty, cashSale: 0, prixAchatUnitaire: prixAchat, coutAchat, benefSale: -coutAchat, type: 'nulle' })
    }

    setQuantite(''); setCashSale(''); setCashManual(false); setShowForm(false); setSubmitting(false)
    const dispo = await getStockDisponible(selectedItemId)
    setStockDispo(dispo)
    await load()
  }

  const ventesNormales = ventes.filter(v => v.type === 'normale')
  const ventesNulles = ventes.filter(v => v.type === 'nulle')
  const totalVendu = ventesNormales.reduce((s, v) => s + v.quantite, 0)
  const totalCashSale = ventesNormales.reduce((s, v) => s + v.cashSale, 0)
  const totalBenefSale = ventesNormales.reduce((s, v) => s + v.benefSale, 0)
  const totalPertes = ventesNulles.reduce((s, v) => s + v.coutAchat, 0)

  const semaineIdx = semaines.indexOf(semaine)
  const qty = Number(quantite)
  const prix = stockDispo?.prixAchatUnitaire || 0
  const coutEstime = qty > 0 && prix > 0 ? qty * prix : null
  const benefEstime = coutEstime !== null && Number(cashSale) > 0 ? Number(cashSale) - coutEstime : null
  const selectedItem = items.find(i => i.id === selectedItemId)

  useRealtime(load)

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Ventes</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>Semaine {semaine}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-ghost p-2" onClick={() => semaineIdx < semaines.length - 1 && setSemaine(semaines[semaineIdx + 1])} disabled={semaineIdx >= semaines.length - 1}><ChevronLeft size={16} /></button>
            <div className="card px-3 py-2 text-sm font-bold text-white min-w-[110px] text-center">{semaine === getSemaine() ? '📅 En cours' : semaine}</div>
            <button className="btn-ghost p-2" onClick={() => semaineIdx > 0 && setSemaine(semaines[semaineIdx - 1])} disabled={semaineIdx <= 0}><ChevronRight size={16} /></button>
            <button className="btn-ghost flex items-center gap-2" onClick={() => setShowRendements(!showRendements)}>
              <BarChart2 size={15} /> Rendements
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
              <Plus size={16} /> Déclarer
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Kg vendus', value: formatKg(totalVendu), color: '#3b82f6' },
            { label: 'Ventes', value: formatMoney(totalCashSale), color: '#60a5fa' },
            { label: 'Profit', value: formatMoney(totalBenefSale), color: '#4ade80' },
            { label: 'Pertes', value: formatMoney(totalPertes), color: '#f87171' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--blocc-muted)' }}>{s.label}</div>
              <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rendements */}
        {showRendements && (
          <div className="card p-6">
            <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>Rendement par produit</div>
            <div className="space-y-3">
              {rendements.map(r => (
                <div key={r.itemId} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-white text-sm">{r.itemNom}</div>
                    <div className="flex items-center gap-3">
                      {r.rendementReel > 0 && (
                        <div className="text-right">
                          <div className="text-lg font-black" style={{ color: r.rendementReel >= 50 ? '#4ade80' : r.rendementReel >= 20 ? '#fbbf24' : '#f87171' }}>
                            {Math.round(r.rendementReel)}%
                          </div>
                          <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>rendement réel</div>
                        </div>
                      )}
                      {r.rendementConfig > 0 && r.rendementReel === 0 && (
                        <div className="text-right">
                          <div className="text-lg font-black" style={{ color: '#60a5fa' }}>{Math.round(r.rendementConfig)}%</div>
                          <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>rendement estimé</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div><div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Prix achat</div><div className="font-bold text-white">{formatMoney(r.prixAchatMoyen)}/kg</div></div>
                    <div>
                      <div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Prix vente estimé</div>
                      <div className="font-bold" style={{ color: '#60a5fa' }}>{r.prixVenteConfig > 0 ? `${formatMoney(r.prixVenteConfig)}/kg` : '—'}</div>
                    </div>
                    <div>
                      <div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Prix vente réel moy.</div>
                      <div className="font-bold" style={{ color: '#4ade80' }}>{r.prixVenteReel > 0 ? `${formatMoney(Math.round(r.prixVenteReel))}/kg` : <span style={{ color: 'var(--blocc-muted)' }}>Aucune vente</span>}</div>
                    </div>
                    <div>
                      <div className="uppercase" style={{ color: 'var(--blocc-muted)' }}>Volume total</div>
                      <div className="font-bold text-white">{r.totalKgVendus > 0 ? `${formatKg(r.totalKgVendus)} · ${r.nbVentes} ventes` : '—'}</div>
                    </div>
                  </div>
                  {r.totalKgVendus > 0 && (
                    <div className="mt-3">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, r.rendementReel)}%`, background: r.rendementReel >= 50 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : r.rendementReel >= 20 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)' }} />
                      </div>
                    </div>
                  )}
                  {r.totalKgVendus === 0 && (
                    <div className="text-xs mt-2" style={{ color: 'var(--blocc-muted)' }}>Aucune vente enregistrée — rendement estimé basé sur le prix configuré</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulaire */}
        {showForm && (
          <div className="card p-6">
            <h2 className="text-base font-bold text-white mb-5">Nouvelle vente</h2>
            <div className="flex gap-2 mb-5">
              {(['normale', 'nulle'] as const).map(t => (
                <button key={t} type="button" onClick={() => setFormType(t)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: formType === t ? (t === 'normale' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${formType === t ? (t === 'normale' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)') : 'var(--blocc-border)'}`,
                    color: formType === t ? (t === 'normale' ? '#4ade80' : '#f87171') : 'var(--blocc-muted)',
                  }}>
                  {t === 'normale' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {t === 'normale' ? 'Vente normale' : 'Vente nulle (saisie / arres.)'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Item vendu</label>
                  <select className="input" value={selectedItemId} onChange={ev => handleItemChange(ev.target.value)} required>
                    <option value="">-- Choisir --</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                  </select>
                </div>
                {selectedItemId && (() => {
                  const item = items.find(i => i.id === selectedItemId)
                  if (item?.requireStock === false) return (
                    <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                      <div className="text-xs font-semibold" style={{ color: '#a78bfa' }}>⚡ Item sans stock — pas de vérification d'entrepôt</div>
                    </div>
                  )
                  return null
                })()}
                {stockDispo !== null && selectedItemId && items.find(i => i.id === selectedItemId)?.requireStock !== false && (
                  <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                    <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>Stock dispo</div>
                    <div className="text-sm font-bold text-white">{formatKg(stockDispo.quantite)}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--blocc-muted)' }}>
                      Prix achat : <strong className="text-white">{formatMoney(stockDispo.prixAchatUnitaire)}/kg</strong>
                      {selectedItem?.prixVenteMoyen ? <> · Prix vente estimé : <strong className="text-white">{formatMoney(selectedItem.prixVenteMoyen)}/kg</strong></> : null}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label">{selectedItem?.requireStock === false ? 'Valeur ($)' : `Quantité (${selectedItem?.unite || 'kg'})`}</label>
                <input className="input" type="number" min="1" placeholder="ex: 50" value={quantite}
                  onChange={ev => handleQuantiteChange(ev.target.value)} required />
              </div>

              {formType === 'normale' && (
                <div>
                  <label className="label flex items-center gap-2">
                    Ventes encaissé ($)
                    {selectedItem?.prixVenteMoyen && qty > 0 && !cashManual && (
                      <span className="text-xs font-normal px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                        Pré-rempli · {formatMoney(selectedItem.prixVenteMoyen)}/kg × {qty}kg
                      </span>
                    )}
                  </label>
                  <input className="input" type="number" min="1" placeholder="ex: 22500" value={cashSale}
                    onChange={ev => { setCashSale(ev.target.value); setCashManual(true) }} required />
                </div>
              )}

              {/* Calcul auto */}
              {qty > 0 && prix > 0 && (
                <div className="rounded-lg p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--blocc-muted)' }}>Calcul automatique</div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--blocc-muted)' }}>Prix achat (depuis stock)</span>
                    <span className="font-semibold text-white">{formatMoney(prix)}/kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--blocc-muted)' }}>Coût marchandise</span>
                    <span className="font-semibold text-white">{coutEstime !== null ? formatMoney(coutEstime) : '—'}</span>
                  </div>
                  {formType === 'normale' && benefEstime !== null && (
                    <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: 'var(--blocc-border)' }}>
                      <span style={{ color: 'var(--blocc-muted)' }}>Profit estimé</span>
                      <span className="font-bold" style={{ color: benefEstime >= 0 ? '#4ade80' : '#f87171' }}>{formatMoney(benefEstime)}</span>
                    </div>
                  )}
                  {formType === 'normale' && benefEstime !== null && coutEstime !== null && coutEstime > 0 && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--blocc-muted)' }}>Rendement sur cette vente</span>
                      <span className="font-bold" style={{ color: benefEstime >= 0 ? '#4ade80' : '#f87171' }}>
                        {Math.round((benefEstime / coutEstime) * 100)}%
                      </span>
                    </div>
                  )}
                  {formType === 'nulle' && coutEstime !== null && (
                    <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: 'var(--blocc-border)' }}>
                      <span style={{ color: 'var(--blocc-muted)' }}>Perte totale</span>
                      <span className="font-bold text-red-400">-{formatMoney(coutEstime)}</span>
                    </div>
                  )}
                </div>
              )}

              {formType === 'nulle' && (
                <div className="flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  Le stock sera déduit, cash encaissé = 0$. Perte enregistrée dans les stats.
                </div>
              )}

              {error && <div className="text-sm text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer la vente'}</button>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              </div>
            </form>
          </div>
        )}

        {/* Liste */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Historique — semaine {semaine}</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : ventes.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--blocc-muted)' }}>
              <TrendingUp size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucune vente cette semaine</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
              {ventes.map(v => (
                <div key={v.id} className="px-6 py-4 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${v.type === 'nulle' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                    {v.type === 'nulle' ? <TrendingDown size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-green-400" />}
                  </div>
                  <div className="flex-1">
                    {isAdmin && <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--blocc-muted)' }}>{v.membrePseudo}</div>}
                    <div className="text-sm font-semibold text-white">
                      {v.type === 'nulle'
                        ? <span className="text-red-400">{formatKg(v.quantite)} {v.itemNom} perdus</span>
                        : <>{formatKg(v.quantite)} {v.itemNom} — {formatMoney(v.cashSale)} cash sale</>}
                    </div>
                    <div className="text-xs mt-0.5 flex flex-wrap gap-3" style={{ color: 'var(--blocc-muted)' }}>
                      <span>{new Date(v.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>Coût : {formatMoney(v.coutAchat)}</span>
                      {v.type === 'normale' && (
                        <>
                          <span style={{ color: v.benefSale >= 0 ? '#4ade80' : '#f87171' }}>Bénéf : {formatMoney(v.benefSale)}</span>
                          {v.coutAchat > 0 && <span style={{ color: '#818cf8' }}>Rendement : {Math.round((v.benefSale / v.coutAchat) * 100)}%</span>}
                        </>
                      )}
                    </div>
                  </div>
                  {(isAdmin || hasPermission('supprimer_ventes')) && (
                    <button className="p-2 rounded-lg flex-shrink-0" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                      title="Annuler cette vente"
                      onClick={async () => {
                        if (!confirm(`Annuler la vente de ${v.quantite} ${v.itemNom} par ${v.membrePseudo} ?`)) return
                        await supprimerVente(v.id)
                        await load()
                      }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
