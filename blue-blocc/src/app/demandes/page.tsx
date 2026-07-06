'use client'

import React, { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import { getDemandes, addDemande, traiterDemande, supprimerDemande, getEntrepots, getItems } from '@/lib/db'
import { DemandeStock, Entrepot, Item } from '@/types'
import { formatMoney, formatKg } from '@/lib/utils'
import { Plus, CheckCircle, XCircle, Package, Trash2 } from 'lucide-react'

export default function DemandesPage() {
  const { profile, hasPermission, isLead } = useAuth()
  const [demandes, setDemandes] = useState<DemandeStock[]>([])
  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [quantite, setQuantite] = useState('')
  const [prixAchatInput, setPrixAchatInput] = useState('')
  const [entrepotId, setEntrepotId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canDemande = hasPermission('faire_demandes')
  const canValider = hasPermission('gerer_demandes')

  const load = async () => {
    const [d, e, i] = await Promise.all([
      canValider ? getDemandes() : getDemandes({ membreId: profile?.uid }),
      getEntrepots(), getItems(),
    ])
    setDemandes(d); setEntrepots(e); setItems(i)
    if (e.length > 0 && !entrepotId) setEntrepotId(e[0].id)
    if (i.length > 0 && !selectedItemId) {
      setSelectedItemId(i[0].id)
      setPrixAchatInput(String(i[0].prixAchat))
    }
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [profile])

  useRealtime(load)

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId)
    const item = items.find(i => i.id === itemId)
    if (item) setPrixAchatInput(String(item.prixAchat))
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!profile) return
    setError('')
    const qty = Number(quantite)
    const prixAchat = Number(prixAchatInput)
    if (qty <= 0) { setError('Quantité invalide'); return }
    if (prixAchat <= 0) { setError("Prix d'achat invalide"); return }
    if (!entrepotId) { setError('Choisis un entrepôt'); return }
    if (!selectedItemId) { setError('Choisis un item'); return }
    const item = items.find(i => i.id === selectedItemId)
    setSubmitting(true)
    await addDemande({
      membreId: profile.uid, membrePseudo: profile.pseudo,
      itemId: selectedItemId, itemNom: item?.nom || selectedItemId,
      quantite: qty, prixAchat, montantTotal: qty * prixAchat, entrepotId,
    })
    setQuantite(''); setShowForm(false); setSubmitting(false); await load()
  }

  const handleTraiter = async (id: string, statut: 'validee' | 'refusee') => {
    if (!profile) return
    await traiterDemande(id, statut, profile.uid); await load()
  }

  const handleSupprimer = async (id: string) => {
    if (!confirm("Supprimer cette demande de l'historique ?")) return
    await supprimerDemande(id); await load()
  }

  const en_attente = demandes.filter(d => d.statut === 'en_attente')
  const traitees = demandes.filter(d => d.statut !== 'en_attente')
  const selectedItem = items.find(i => i.id === selectedItemId)
  const qty = Number(quantite)
  const prixAchat = Number(prixAchatInput)

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Demandes de stock</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>
              {canValider ? "Valider une demande ajoute la quantité dans l'entrepôt" : 'Demander du stock'}
            </p>
          </div>
          {canDemande && (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
              <Plus size={16} /> Nouvelle demande
            </button>
          )}
        </div>

        {canDemande && showForm && (
          <div className="card p-6">
            <h2 className="text-base font-bold text-white mb-5">Demander du stock</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Item demandé</label>
                  <select className="input" value={selectedItemId} onChange={e => handleItemChange(e.target.value)} required>
                    <option value="">-- Choisir --</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Entrepôt de destination</label>
                  <select className="input" value={entrepotId} onChange={e => setEntrepotId(e.target.value)} required>
                    <option value="">-- Choisir --</option>
                    {entrepots.map(e => {
                      const stockActuel = e.stocks.reduce((s, st) => s + st.quantite, 0)
                      const place = e.capaciteMax - stockActuel
                      return <option key={e.id} value={e.id}>{e.nom} ({formatKg(place)} libre)</option>
                    })}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantité ({selectedItem?.unite || 'kg'})</label>
                  <input className="input" type="number" min="1" placeholder="ex: 100" value={quantite} onChange={e => setQuantite(e.target.value)} required />
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    Prix achat $/kg
                    {selectedItem && <span className="text-xs font-normal px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>Réf: {formatMoney(selectedItem.prixAchat)}</span>}
                  </label>
                  <input className="input" type="number" min="1" value={prixAchatInput} onChange={e => setPrixAchatInput(e.target.value)} required />
                </div>
              </div>
              {qty > 0 && prixAchat > 0 && (
                <div className="rounded-lg p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--blocc-muted)' }}>Quantité</span>
                    <span className="font-semibold text-white">{formatKg(qty)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--blocc-muted)' }}>Prix achat</span>
                    <span className="font-semibold text-white">{formatMoney(prixAchat)}/kg</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2" style={{ borderColor: 'var(--blocc-border)' }}>
                    <span style={{ color: 'var(--blocc-muted)' }}>Coût total (déduit de la tréso si validée)</span>
                    <span className="font-bold" style={{ color: '#f87171' }}>{formatMoney(qty * prixAchat)}</span>
                  </div>
                </div>
              )}
              {error && <div className="text-sm text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</div>}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Envoi...' : 'Envoyer'}</button>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <>
            {en_attente.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
                  <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#fbbf24' }}>En attente ({en_attente.length})</h2>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
                  {en_attente.map(d => (
                    <div key={d.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
                          <Package size={14} style={{ color: '#fbbf24' }} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{d.membrePseudo} — {formatKg(d.quantite)} {d.itemNom}</div>
                          <div className="text-xs mt-0.5 flex gap-3" style={{ color: 'var(--blocc-muted)' }}>
                            <span>{entrepots.find(e => e.id === d.entrepotId)?.nom}</span>
                            <span>{formatMoney(d.prixAchat)}/kg</span>
                            <span style={{ color: '#f87171' }}>{formatMoney(d.montantTotal)}</span>
                            <span>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {canValider && (
                          <>
                            <button className="btn-success text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => handleTraiter(d.id, 'validee')}>
                              <CheckCircle size={13} /> Valider
                            </button>
                            <button className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1" onClick={() => handleTraiter(d.id, 'refusee')}>
                              <XCircle size={13} /> Refuser
                            </button>
                          </>
                        )}
                        {isLead && (
                          <button className="p-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                            onClick={() => handleSupprimer(d.id)} title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {traitees.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--blocc-border)' }}>
                  <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Historique ({traitees.length})</h2>
                  {isLead && (
                    <button className="text-xs flex items-center gap-1" style={{ color: '#f87171' }}
                      onClick={async () => {
                        if (!confirm("Supprimer tout l'historique des demandes traitées ?")) return
                        await Promise.all(traitees.map(d => supprimerDemande(d.id)))
                        await load()
                      }}>
                      <Trash2 size={12} /> Tout supprimer
                    </button>
                  )}
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
                  {traitees.map(d => {
                    const color = d.statut === 'validee' ? '#4ade80' : '#f87171'
                    return (
                      <div key={d.id} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}20` }}>
                            {d.statut === 'validee' ? <CheckCircle size={14} style={{ color }} /> : <XCircle size={14} style={{ color }} />}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{d.membrePseudo} — {formatKg(d.quantite)} {d.itemNom}</div>
                            <div className="text-xs mt-0.5 flex gap-3" style={{ color: 'var(--blocc-muted)' }}>
                              <span style={{ color }}>{d.statut === 'validee' ? 'Validée' : 'Refusée'}</span>
                              <span>{entrepots.find(e => e.id === d.entrepotId)?.nom}</span>
                              <span>{formatMoney(d.prixAchat)}/kg</span>
                              <span>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                            </div>
                          </div>
                        </div>
                        {isLead && (
                          <button className="p-2 rounded-lg flex-shrink-0" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                            onClick={() => handleSupprimer(d.id)} title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {demandes.length === 0 && (
              <div className="card p-12 text-center" style={{ color: 'var(--blocc-muted)' }}>
                <Package size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Aucune demande</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
