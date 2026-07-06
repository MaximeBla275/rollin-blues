'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import {
  getLaboItems, getLaboStocks, getLaboConfig, getLaboSessions, getLaboDemandes,
  createLaboItem, updateLaboItem, deleteLaboItem, rechargerLaboStock,
  updateLaboConfig, declarerLabo, addLaboDemande, traiterLaboDemande, supprimerLaboDemande
} from '@/lib/db'
import { LaboItem, LaboStock, LaboConfig, LaboSession, LaboDemandeRestock } from '@/types'
import { formatMoney, getSemaine } from '@/lib/utils'
import { Plus, Trash2, Pencil, Check, X, Package, Leaf, Settings, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'

type Tab = 'production' | 'stock' | 'config' | 'demandes'

export default function LaboPage() {
  const { profile, hasPermission, isLead } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('production')
  const [items, setItems] = useState<LaboItem[]>([])
  const [stocks, setStocks] = useState<LaboStock[]>([])
  const [config, setConfig] = useState<LaboConfig>({ prixVenteBranche: 500, recette: [], capaciteMax: 1000 })
  const [sessions, setSessions] = useState<LaboSession[]>([])
  const [demandes, setDemandes] = useState<LaboDemandeRestock[]>([])
  const [loading, setLoading] = useState(true)

  const [nbBranches, setNbBranches] = useState('')
  const [showDeclarer, setShowDeclarer] = useState(false)
  const [declaring, setDeclaring] = useState(false)
  const [declareError, setDeclareError] = useState('')

  const [showNewItem, setShowNewItem] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [editItemNom, setEditItemNom] = useState('')
  const [editItemUnite, setEditItemUnite] = useState('')
  const [editItemPoids, setEditItemPoids] = useState('')
  const [editItemPrix, setEditItemPrix] = useState('')
  const [newItemNom, setNewItemNom] = useState('')
  const [newItemUnite, setNewItemUnite] = useState('unité')
  const [newItemPoids, setNewItemPoids] = useState('1')
  const [newItemPrix, setNewItemPrix] = useState('')
  const [newItemCat, setNewItemCat] = useState<'consommable' | 'branche'>('consommable')

  const [rechargeId, setRechargeId] = useState<string | null>(null)
  const [rechargeQty, setRechargeQty] = useState('')
  const [rechargePrix, setRechargePrix] = useState('')

  const [editConfig, setEditConfig] = useState(false)
  const [prixBrancheInput, setPrixBrancheInput] = useState('')
  const [capaciteInput, setCapaciteInput] = useState('')

  const [demandeItemId, setDemandeItemId] = useState('')
  const [demandeQty, setDemandeQty] = useState('')
  const [showDemande, setShowDemande] = useState(false)

  const canGerer = isLead || hasPermission('gerer_labo')
  const canVoir = canGerer || hasPermission('voir_labo')
  const semaine = getSemaine()

  useEffect(() => {
    if (!canVoir) router.replace('/dashboard')
  }, [])

  const load = async () => {
    const [i, s, c, sess, d] = await Promise.all([
      getLaboItems(), getLaboStocks(), getLaboConfig(),
      getLaboSessions(semaine), getLaboDemandes(),
    ])
    setItems(i); setStocks(s); setConfig(c); setSessions(sess); setDemandes(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useRealtime(load)

  const getStock = (itemId: string) => stocks.find(s => s.itemId === itemId)

  const totalBranches = stocks.find(s => {
    const item = items.find(i => i.id === s.itemId)
    return item?.categorie === 'branche'
  })?.quantite || 0

  const valeurMarchandeTotale = totalBranches * config.prixVenteBranche

  const sessionsSemaine = sessions.filter(s => s.semaine === semaine)
  const totalBranchesSemaine = sessionsSemaine.reduce((s, sess) => s + sess.nbBranches, 0)

  const handleDeclarer = async () => {
    if (!profile) return
    setDeclareError('')
    const nb = Number(nbBranches)
    if (nb <= 0) { setDeclareError('Nombre de branches invalide'); return }

    // Vérif consommables suffisants
    for (const r of config.recette) {
      const needed = r.quantiteParLabo * nb
      const stock = getStock(r.itemId)
      if (!stock || stock.quantite < needed) {
        setDeclareError(`Stock insuffisant : ${r.itemNom} (besoin: ${needed}, dispo: ${stock?.quantite || 0})`)
        return
      }
    }

    setDeclaring(true)
    await declarerLabo(profile.uid, profile.pseudo, nb)
    setNbBranches(''); setShowDeclarer(false); setDeclaring(false)
    await load()
  }

  const handleSaveConfig = async () => {
    await updateLaboConfig({
      prixVenteBranche: Number(prixBrancheInput) || config.prixVenteBranche,
      capaciteMax: Number(capaciteInput) || config.capaciteMax,
    })
    setEditConfig(false); await load()
  }

  const handleAddRecetteItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || config.recette.find(r => r.itemId === itemId)) return
    const newRecette = [...config.recette, { itemId, itemNom: item.nom, quantiteParLabo: 1 }]
    updateLaboConfig({ recette: newRecette }).then(load)
  }

  const handleUpdateRecetteQty = (itemId: string, qty: number) => {
    const newRecette = config.recette.map(r => r.itemId === itemId ? { ...r, quantiteParLabo: qty } : r)
    updateLaboConfig({ recette: newRecette }).then(load)
  }

  const handleRemoveRecetteItem = (itemId: string) => {
    const newRecette = config.recette.filter(r => r.itemId !== itemId)
    updateLaboConfig({ recette: newRecette }).then(load)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'production', label: 'Production', icon: <Leaf size={15} /> },
    { id: 'stock', label: 'Stock', icon: <Package size={15} /> },
    { id: 'demandes', label: `Demandes${demandes.filter(d => d.statut === 'en_attente').length > 0 ? ` (${demandes.filter(d => d.statut === 'en_attente').length})` : ''}`, icon: <ClipboardList size={15} /> },
    ...(canGerer ? [{ id: 'config' as Tab, label: 'Config', icon: <Settings size={15} /> }] : []),
  ]

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <span style={{ fontSize: 28 }}>🌿</span> Labo / Plantation
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>Semaine {semaine}</p>
          </div>
          <button className="btn-primary flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #166534, #15803d)' }}
            onClick={() => setShowDeclarer(!showDeclarer)}>
            <Leaf size={16} /> Déclarer un labo
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Branches en stock</div>
            <div className="text-2xl font-black" style={{ color: '#4ade80' }}>{totalBranches.toLocaleString('fr-FR')}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Branches cette semaine</div>
            <div className="text-2xl font-black" style={{ color: '#60a5fa' }}>{totalBranchesSemaine.toLocaleString('fr-FR')}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Prix / branche</div>
            <div className="text-2xl font-black text-white">{formatMoney(config.prixVenteBranche)}</div>
          </div>
        </div>

        {/* Prévisions */}
        <div className="card p-6" style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>
            💰 Prévisions sur le stock actuel ({totalBranches.toLocaleString('fr-FR')} branches)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Valeur argent sale brut</div>
              <div className="text-3xl font-black" style={{ color: '#fbbf24' }}>{formatMoney(valeurMarchandeTotale)}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--blocc-muted)' }}>
                {totalBranches.toLocaleString('fr-FR')} × {formatMoney(config.prixVenteBranche)} / branche
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--blocc-muted)' }}>Après blanchiment (−30%)</div>
              <div className="text-3xl font-black" style={{ color: '#a78bfa' }}>{formatMoney(Math.round(valeurMarchandeTotale * 0.7))}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--blocc-muted)' }}>
                Taux de blanchiment : <strong style={{ color: '#a78bfa' }}>70%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Formulaire déclarer labo */}
        {showDeclarer && (
          <div className="card p-6" style={{ border: '1px solid rgba(34,197,94,0.3)' }}>
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Leaf size={16} style={{ color: '#4ade80' }} /> Déclarer un labo
            </h2>
            {config.recette.length > 0 && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div className="text-xs font-semibold mb-2" style={{ color: '#4ade80' }}>Recette par branche :</div>
                <div className="flex flex-wrap gap-3">
                  {config.recette.map(r => {
                    const stock = getStock(r.itemId)
                    return (
                      <span key={r.itemId} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--blocc-muted)' }}>
                        {r.quantiteParLabo} {r.itemNom}
                        {stock && <span style={{ color: stock.quantite >= r.quantiteParLabo ? '#4ade80' : '#f87171' }}> ({stock.quantite} dispo)</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="label">Nombre de branches produites</label>
                <input className="input" type="number" min="1" placeholder="ex: 50"
                  value={nbBranches} onChange={e => setNbBranches(e.target.value)} />
              </div>
              {Number(nbBranches) > 0 && (
                <div className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  Valeur : {formatMoney(Number(nbBranches) * config.prixVenteBranche)}
                </div>
              )}
            </div>
            {declareError && <div className="mt-3 text-sm text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>{declareError}</div>}
            <div className="flex gap-3 mt-4">
              <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#166534,#15803d)' }}
                onClick={handleDeclarer} disabled={declaring}>
                {declaring ? 'Enregistrement...' : '🌿 Valider le labo'}
              </button>
              <button className="btn-ghost" onClick={() => { setShowDeclarer(false); setDeclareError('') }}>Annuler</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: tab === t.id ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                color: tab === t.id ? '#4ade80' : 'var(--blocc-muted)',
                border: `1px solid ${tab === t.id ? 'rgba(34,197,94,0.3)' : 'var(--blocc-border)'}`,
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Production */}
        {tab === 'production' && (
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>
                  Labos cette semaine ({sessionsSemaine.length})
                </div>
              </div>
              {sessionsSemaine.length === 0 ? (
                <div className="p-12 text-center" style={{ color: 'var(--blocc-muted)' }}>
                  <Leaf size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Aucun labo déclaré cette semaine</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
                  {sessionsSemaine.map(s => (
                    <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
                          <Leaf size={14} style={{ color: '#4ade80' }} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{s.membrePseudo}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--blocc-muted)' }}>
                            {new Date(s.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black" style={{ color: '#4ade80' }}>+{s.nbBranches} branches</div>
                        <div className="text-xs" style={{ color: '#fbbf24' }}>{formatMoney(s.valeurMarchande)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Stock */}
        {tab === 'stock' && (
          <div className="space-y-4">
            {/* Demande restock */}
            <div className="flex justify-between items-center">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>
                Stock consommables
              </div>
              <button className="btn-ghost text-xs flex items-center gap-1" onClick={() => setShowDemande(!showDemande)}>
                <Plus size={13} /> Demander un restock
              </button>
            </div>

            {showDemande && (
              <div className="card p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--blocc-muted)' }}>Demande de restock</div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3">
                  <select className="input" value={demandeItemId} onChange={e => setDemandeItemId(e.target.value)}>
                    <option value="">-- Item --</option>
                    {items.filter(i => i.categorie === 'consommable').map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
                  </select>
                  <input className="input" type="number" min="1" placeholder="Quantité" value={demandeQty} onChange={e => setDemandeQty(e.target.value)} />
                  <button className="btn-primary text-xs" onClick={async () => {
                    if (!profile || !demandeItemId || !demandeQty) return
                    const item = items.find(i => i.id === demandeItemId)
                    await addLaboDemande(profile.uid, profile.pseudo, demandeItemId, item?.nom || '', Number(demandeQty))
                    setDemandeItemId(''); setDemandeQty(''); setShowDemande(false); load()
                  }}>Envoyer</button>
                </div>
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
                {items.map(item => {
                  const stock = getStock(item.id)
                  const qte = stock?.quantite || 0
                  return (
                    <div key={item.id} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: item.categorie === 'branche' ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)' }}>
                            {item.categorie === 'branche' ? '🌿' : '📦'}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                              {item.nom}
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--blocc-muted)' }}>
                                {item.categorie === 'branche' ? 'Produit fini' : 'Consommable'}
                              </span>
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--blocc-muted)' }}>
                              {item.poids} kg/unité · {formatMoney(item.prixAchat)}/{item.unite}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-black" style={{ color: item.categorie === 'branche' ? '#fbbf24' : qte > 10 ? '#4ade80' : '#f87171' }}>
                              {qte.toLocaleString('fr-FR')} {item.unite}
                            </div>
                            {item.categorie === 'branche' && qte > 0 && (
                              <div className="text-xs" style={{ color: '#fbbf24' }}>{formatMoney(qte * config.prixVenteBranche)}</div>
                            )}
                          </div>
                          {canGerer && (
                            <button className="p-2 rounded-lg" style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.1)' }}
                              onClick={() => { setRechargeId(rechargeId === item.id ? null : item.id); setRechargePrix(String(item.prixAchat)) }}>
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {canGerer && rechargeId === item.id && (
                        <div className="mt-3 pt-3 border-t flex gap-3 items-end" style={{ borderColor: 'var(--blocc-border)' }}>
                          <div>
                            <label className="label">Quantité</label>
                            <input className="input h-8 text-sm" type="number" min="1" value={rechargeQty} onChange={e => setRechargeQty(e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Prix unitaire ($)</label>
                            <input className="input h-8 text-sm" type="number" min="0" value={rechargePrix} onChange={e => setRechargePrix(e.target.value)} />
                          </div>
                          <button className="btn-success text-xs py-1.5 px-3" onClick={async () => {
                            if (!rechargeQty) return
                            await rechargerLaboStock(item.id, item.nom, Number(rechargeQty), Number(rechargePrix))
                            setRechargeId(null); setRechargeQty(''); load()
                          }}>Recharger</button>
                          <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setRechargeId(null)}>Annuler</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab Demandes */}
        {tab === 'demandes' && (
          <div className="space-y-4">
            {demandes.filter(d => d.statut === 'en_attente').length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#fbbf24' }}>
                    En attente ({demandes.filter(d => d.statut === 'en_attente').length})
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
                  {demandes.filter(d => d.statut === 'en_attente').map(d => (
                    <div key={d.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{d.membrePseudo} — {d.quantite} {d.itemNom}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--blocc-muted)' }}>
                          {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      {canGerer && (
                        <div className="flex gap-2">
                          <button className="btn-success text-xs py-1.5 px-3" onClick={async () => { await traiterLaboDemande(d.id, 'validee'); load() }}>
                            Valider
                          </button>
                          <button className="btn-danger text-xs py-1.5 px-3" onClick={async () => { await traiterLaboDemande(d.id, 'refusee'); load() }}>
                            Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {demandes.filter(d => d.statut !== 'en_attente').length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--blocc-border)' }}>
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Historique</div>
                  {canGerer && (
                    <button className="text-xs" style={{ color: '#f87171' }}
                      onClick={async () => { await Promise.all(demandes.filter(d => d.statut !== 'en_attente').map(d => supprimerLaboDemande(d.id))); load() }}>
                      Tout supprimer
                    </button>
                  )}
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
                  {demandes.filter(d => d.statut !== 'en_attente').map(d => (
                    <div key={d.id} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{d.membrePseudo} — {d.quantite} {d.itemNom}</div>
                        <span className="text-xs" style={{ color: d.statut === 'validee' ? '#4ade80' : '#f87171' }}>
                          {d.statut === 'validee' ? 'Validée' : 'Refusée'}
                        </span>
                      </div>
                      {canGerer && (
                        <button className="p-1.5 rounded" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                          onClick={async () => { await supprimerLaboDemande(d.id); load() }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {demandes.length === 0 && (
              <div className="card p-12 text-center" style={{ color: 'var(--blocc-muted)' }}>
                <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune demande</p>
              </div>
            )}
          </div>
        )}

        {/* Tab Config - gérant seulement */}
        {tab === 'config' && canGerer && (
          <div className="space-y-6">
            {/* Prix & capacité */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Configuration</div>
                <button className="btn-ghost text-xs" onClick={() => { setEditConfig(!editConfig); setPrixBrancheInput(String(config.prixVenteBranche)); setCapaciteInput(String(config.capaciteMax)) }}>
                  <Pencil size={13} /> Modifier
                </button>
              </div>
              {editConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prix de vente / branche ($)</label>
                    <input className="input" type="number" min="1" value={prixBrancheInput} onChange={e => setPrixBrancheInput(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Capacité max stock branches</label>
                    <input className="input" type="number" min="1" value={capaciteInput} onChange={e => setCapaciteInput(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={handleSaveConfig}>Sauvegarder</button>
                    <button className="btn-ghost" onClick={() => setEditConfig(false)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>Prix branche</div><div className="text-xl font-black text-white">{formatMoney(config.prixVenteBranche)}</div></div>
                  <div><div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>Capacité max</div><div className="text-xl font-black text-white">{config.capaciteMax.toLocaleString('fr-FR')}</div></div>
                </div>
              )}
            </div>

            {/* Recette */}
            <div className="card p-6">
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>
                Recette par labo (consommables / branche)
              </div>
              <div className="space-y-2 mb-4">
                {config.recette.map(r => (
                  <div key={r.itemId} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                    <span className="text-sm text-white flex-1">{r.itemNom}</span>
                    <input className="input h-8 w-20 text-sm text-center" type="number" min="0.1" step="0.1"
                      value={r.quantiteParLabo}
                      onChange={e => handleUpdateRecetteQty(r.itemId, Number(e.target.value))} />
                    <span className="text-xs" style={{ color: 'var(--blocc-muted)' }}>/ branche</span>
                    <button className="p-1.5 rounded" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                      onClick={() => handleRemoveRecetteItem(r.itemId)}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <select className="input text-sm" onChange={e => { if (e.target.value) { handleAddRecetteItem(e.target.value); e.target.value = '' } }}>
                  <option value="">+ Ajouter un consommable à la recette</option>
                  {items.filter(i => i.categorie === 'consommable' && !config.recette.find(r => r.itemId === i.id)).map(i => (
                    <option key={i.id} value={i.id}>{i.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Gestion items */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Items du labo</div>
                <button className="btn-primary text-xs flex items-center gap-1" onClick={() => setShowNewItem(!showNewItem)}>
                  <Plus size={13} /> Ajouter
                </button>
              </div>
              {showNewItem && (
                <div className="mb-4 p-4 rounded-lg space-y-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <input className="input text-sm" placeholder="Nom" value={newItemNom} onChange={e => setNewItemNom(e.target.value)} />
                    <input className="input text-sm" placeholder="Unité (ex: L, kg, unité)" value={newItemUnite} onChange={e => setNewItemUnite(e.target.value)} />
                    <input className="input text-sm" type="number" placeholder="Poids (kg)" value={newItemPoids} onChange={e => setNewItemPoids(e.target.value)} />
                    <input className="input text-sm" type="number" placeholder="Prix achat $" value={newItemPrix} onChange={e => setNewItemPrix(e.target.value)} />
                    <select className="input text-sm" value={newItemCat} onChange={e => setNewItemCat(e.target.value as 'consommable' | 'branche')}>
                      <option value="consommable">Consommable</option>
                      <option value="branche">Produit fini (branche)</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" onClick={async () => {
                      if (!newItemNom) return
                      await createLaboItem(newItemNom, newItemUnite, Number(newItemPoids), Number(newItemPrix), newItemCat)
                      setNewItemNom(''); setNewItemUnite('unité'); setNewItemPoids('1'); setNewItemPrix(''); setShowNewItem(false); load()
                    }}>Créer</button>
                    <button className="btn-ghost text-xs" onClick={() => setShowNewItem(false)}>Annuler</button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--blocc-border)' }}>
                    {editItemId === item.id ? (
                      <div className="p-3 space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <input className="input text-sm h-8" placeholder="Nom" value={editItemNom} onChange={e => setEditItemNom(e.target.value)} />
                          <input className="input text-sm h-8" placeholder="Unité" value={editItemUnite} onChange={e => setEditItemUnite(e.target.value)} />
                          <input className="input text-sm h-8" type="number" placeholder="Poids (kg)" value={editItemPoids} onChange={e => setEditItemPoids(e.target.value)} />
                          <input className="input text-sm h-8" type="number" placeholder="Prix achat $" value={editItemPrix} onChange={e => setEditItemPrix(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-primary text-xs py-1 px-2" onClick={async () => {
                            await updateLaboItem(item.id, { nom: editItemNom, unite: editItemUnite, poids: Number(editItemPoids), prixAchat: Number(editItemPrix) })
                            setEditItemId(null); load()
                          }}><Check size={12} /></button>
                          <button className="btn-ghost text-xs py-1 px-2" onClick={() => setEditItemId(null)}><X size={12} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        <span className="text-sm font-semibold text-white flex-1">{item.nom}</span>
                        <span className="text-xs" style={{ color: 'var(--blocc-muted)' }}>{item.poids}kg/unité · {formatMoney(item.prixAchat)}/{item.unite}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: item.categorie === 'branche' ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)', color: item.categorie === 'branche' ? '#fbbf24' : '#4ade80' }}>
                          {item.categorie === 'branche' ? 'Branche' : 'Consommable'}
                        </span>
                        <button className="p-1.5 rounded" style={{ color: 'var(--blocc-muted)', background: 'rgba(255,255,255,0.05)' }}
                          onClick={() => { setEditItemId(item.id); setEditItemNom(item.nom); setEditItemUnite(item.unite); setEditItemPoids(String(item.poids)); setEditItemPrix(String(item.prixAchat)) }}>
                          <Pencil size={13} />
                        </button>
                        <button className="p-1.5 rounded" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)' }}
                          onClick={async () => { if (!confirm('Supprimer cet item ?')) return; await deleteLaboItem(item.id); load() }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
