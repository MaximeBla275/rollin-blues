'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { useRealtime } from '@/lib/useRealtime'
import {
  getTresoComplete, getCoffre, transfererVersCoffre, transfererDepuisCoffre,
  ajusterTreso, ajusterCoffre, resetTresoManuel, setCoffreObjectif, cloturerSemaineTreso
} from '@/lib/db'
import { Treso, Coffre } from '@/types'
import { formatMoney, getSemaine } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowLeftRight, Lock, Wallet, History, Settings, RefreshCw } from 'lucide-react'

export default function CoffrePage() {
  const { hasPermission, isLead } = useAuth()
  const router = useRouter()
  const [treso, setTreso] = useState<Treso | null>(null)
  const [coffre, setCoffre] = useState<Coffre | null>(null)
  const [loading, setLoading] = useState(true)

  // Transfert tréso → coffre
  const [transfertMontant, setTransfertMontant] = useState('')
  const [transfertLabel, setTransfertLabel] = useState('')
  const [transfertDir, setTransfertDir] = useState<'to' | 'from'>('to')

  // Ajustement tréso manuel
  const [ajustTresoMontant, setAjustTresoMontant] = useState('')
  const [ajustTresoLabel, setAjustTresoLabel] = useState('')
  const [ajustTresoType, setAjustTresoType] = useState<'entree' | 'sortie'>('entree')

  // Ajustement coffre manuel
  const [ajustCoffreMontant, setAjustCoffreMontant] = useState('')
  const [ajustCoffreLabel, setAjustCoffreLabel] = useState('')
  const [ajustCoffreType, setAjustCoffreType] = useState<'entree' | 'sortie'>('entree')

  // Objectif coffre

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!hasPermission('voir_coffre')) router.replace('/dashboard')
  }, [])

  const load = async () => {
    const [t, c] = await Promise.all([getTresoComplete(), getCoffre()])
    setTreso(t); setCoffre(c); setLoading(false)
  }

  useEffect(() => { load() }, [])
  useRealtime(load)

  const notify = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const handleTransfert = async () => {
    const m = Number(transfertMontant)
    if (!m || m <= 0) return setError('Montant invalide')
    if (!transfertLabel.trim()) return setError('Label requis')
    setSaving(true); setError('')
    try {
      if (transfertDir === 'to') {
        if (treso && m > treso.solde) return setError('Solde tréso insuffisant')
        await transfererVersCoffre(m, transfertLabel)
        notify(`${formatMoney(m)} transféré vers le coffre`)
      } else {
        if (coffre && m > coffre.solde) return setError('Solde coffre insuffisant')
        await transfererDepuisCoffre(m, transfertLabel)
        notify(`${formatMoney(m)} transféré vers la tréso`)
      }
      setTransfertMontant(''); setTransfertLabel(''); await load()
    } finally { setSaving(false) }
  }

  const handleAjustTreso = async () => {
    const m = Number(ajustTresoMontant)
    if (!m || m <= 0) return setError('Montant invalide')
    if (!ajustTresoLabel.trim()) return setError('Label requis')
    setSaving(true); setError('')
    try {
      await ajusterTreso(m, ajustTresoLabel, ajustTresoType)
      notify(`Tréso ajustée : ${ajustTresoType === 'entree' ? '+' : '-'}${formatMoney(m)}`)
      setAjustTresoMontant(''); setAjustTresoLabel(''); await load()
    } finally { setSaving(false) }
  }

  const handleAjustCoffre = async () => {
    const m = Number(ajustCoffreMontant)
    if (!m || m <= 0) return setError('Montant invalide')
    if (!ajustCoffreLabel.trim()) return setError('Label requis')
    setSaving(true); setError('')
    try {
      await ajusterCoffre(m, ajustCoffreLabel, ajustCoffreType)
      notify(`Coffre ajusté : ${ajustCoffreType === 'entree' ? '+' : '-'}${formatMoney(m)}`)
      setAjustCoffreMontant(''); setAjustCoffreLabel(''); await load()
    } finally { setSaving(false) }
  }

  const handleReset = async () => {
    if (!confirm('Remettre la trésorerie à zéro ? Le solde sera archivé dans l\'historique.')) return
    setSaving(true)
    await resetTresoManuel()
    notify('Trésorerie remise à zéro — semaine archivée')
    await load(); setSaving(false)
  }

  const handleCloture = async () => {
    if (!confirm(`Clôturer la semaine ${getSemaine()} ? La tréso sera remise à zéro et le solde archivé.`)) return
    setSaving(true)
    await cloturerSemaineTreso()
    notify('Semaine clôturée — tréso remise à zéro')
    await load(); setSaving(false)
  }

  const tresoObjectif = 1500000 // Objectif CA hebdomadaire
  const tresoPct = treso ? Math.min(100, (treso.solde / tresoObjectif) * 100) : 0

  const getMovColor = (type: string) => {
    if (['entree', 'transfert_treso'].includes(type)) return '#4ade80'
    if (['sortie', 'transfert_coffre', 'reset'].includes(type)) return '#f87171'
    return '#60a5fa'
  }

  const getMovSign = (type: string) => ['entree', 'transfert_treso'].includes(type) ? '+' : '-'

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <Lock size={22} style={{ color: '#fbbf24' }} /> Coffre & Trésorerie
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>
            Semaine en cours : {getSemaine()} · Accès restreint
          </p>
        </div>

        {error && <div className="text-sm text-red-400 px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
        {success && <div className="text-sm text-green-400 px-4 py-3 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>{success}</div>}

        {/* Deux soldes côte à côte */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tréso courante */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} style={{ color: '#60a5fa' }} />
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Tréso courante</div>
              <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>Hebdo</span>
            </div>
            <div className="text-4xl font-black mb-1" style={{ color: '#60a5fa' }}>{formatMoney(treso?.solde || 0)}</div>
            <div className="text-xs mb-3" style={{ color: 'var(--blocc-muted)' }}>Objectif CA semaine : {formatMoney(tresoObjectif)}</div>
            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${tresoPct}%`, background: tresoPct >= 100 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : 'linear-gradient(90deg,#1e6bff,#00bfff)' }} />
            </div>
            {isLead && (
              <div className="flex gap-2 flex-wrap">
                <button className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1" onClick={handleReset} disabled={saving}>
                  <RefreshCw size={12} /> Reset
                </button>
                <button className="text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 font-semibold" 
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
                  onClick={handleCloture} disabled={saving}>
                  Clôturer la semaine
                </button>
              </div>
            )}
          </div>

          {/* Coffre sécurisé */}
          <div className="card p-6" style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={16} style={{ color: '#fbbf24' }} />
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Coffre sécurisé</div>
              <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Cumulatif</span>
            </div>
            <div className="text-4xl font-black mb-1" style={{ color: '#fbbf24' }}>{formatMoney(coffre?.solde || 0)}</div>
            <div className="text-xs mt-2" style={{ color: 'var(--blocc-muted)' }}>
              Argent sale mis en sécurité — suivi cumulatif
            </div>
          </div>
        </div>

        {/* Transferts */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <ArrowLeftRight size={16} style={{ color: '#a78bfa' }} />
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Transfert entre tréso et coffre</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="label">Direction</label>
              <div className="flex gap-2">
                <button onClick={() => setTransfertDir('to')}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: transfertDir === 'to' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)', color: transfertDir === 'to' ? '#fbbf24' : 'var(--blocc-muted)', border: `1px solid ${transfertDir === 'to' ? 'rgba(251,191,36,0.3)' : 'var(--blocc-border)'}` }}>
                  Tréso → Coffre
                </button>
                <button onClick={() => setTransfertDir('from')}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: transfertDir === 'from' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)', color: transfertDir === 'from' ? '#60a5fa' : 'var(--blocc-muted)', border: `1px solid ${transfertDir === 'from' ? 'rgba(96,165,250,0.3)' : 'var(--blocc-border)'}` }}>
                  Coffre → Tréso
                </button>
              </div>
            </div>
            <div>
              <label className="label">Montant ($)</label>
              <input className="input" type="number" min="1" placeholder="ex: 50000" value={transfertMontant} onChange={e => setTransfertMontant(e.target.value)} />
            </div>
            <div>
              <label className="label">Label / motif</label>
              <input className="input" placeholder="ex: Mise en sécurité semaine S26" value={transfertLabel} onChange={e => setTransfertLabel(e.target.value)} />
            </div>
            <button className="self-end px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
              onClick={handleTransfert} disabled={saving}>
              <ArrowLeftRight size={14} /> Transférer
            </button>
          </div>
        </div>

        {/* Ajustements manuels */}
        {hasPermission('modifier_treso') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ajust tréso */}
            <div className="card p-6">
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>
                Ajustement manuel — Tréso
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setAjustTresoType('entree')}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: ajustTresoType === 'entree' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', color: ajustTresoType === 'entree' ? '#4ade80' : 'var(--blocc-muted)', border: `1px solid ${ajustTresoType === 'entree' ? 'rgba(34,197,94,0.3)' : 'var(--blocc-border)'}` }}>
                    <ArrowUp size={12} /> Ajouter
                  </button>
                  <button onClick={() => setAjustTresoType('sortie')}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: ajustTresoType === 'sortie' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', color: ajustTresoType === 'sortie' ? '#f87171' : 'var(--blocc-muted)', border: `1px solid ${ajustTresoType === 'sortie' ? 'rgba(239,68,68,0.3)' : 'var(--blocc-border)'}` }}>
                    <ArrowDown size={12} /> Retirer
                  </button>
                </div>
                <input className="input" type="number" min="1" placeholder="Montant ($)" value={ajustTresoMontant} onChange={e => setAjustTresoMontant(e.target.value)} />
                <input className="input" placeholder="Motif (ex: Correction entrée stock)" value={ajustTresoLabel} onChange={e => setAjustTresoLabel(e.target.value)} />
                <button className="btn-primary w-full" onClick={handleAjustTreso} disabled={saving}>Appliquer</button>
              </div>
            </div>

            {/* Ajust coffre */}
            <div className="card p-6">
              <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--blocc-muted)' }}>
                Ajustement manuel — Coffre
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={() => setAjustCoffreType('entree')}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: ajustCoffreType === 'entree' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', color: ajustCoffreType === 'entree' ? '#4ade80' : 'var(--blocc-muted)', border: `1px solid ${ajustCoffreType === 'entree' ? 'rgba(34,197,94,0.3)' : 'var(--blocc-border)'}` }}>
                    <ArrowUp size={12} /> Ajouter
                  </button>
                  <button onClick={() => setAjustCoffreType('sortie')}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    style={{ background: ajustCoffreType === 'sortie' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', color: ajustCoffreType === 'sortie' ? '#f87171' : 'var(--blocc-muted)', border: `1px solid ${ajustCoffreType === 'sortie' ? 'rgba(239,68,68,0.3)' : 'var(--blocc-border)'}` }}>
                    <ArrowDown size={12} /> Retirer
                  </button>
                </div>
                <input className="input" type="number" min="1" placeholder="Montant ($)" value={ajustCoffreMontant} onChange={e => setAjustCoffreMontant(e.target.value)} />
                <input className="input" placeholder="Motif (ex: Dépense exceptionnelle)" value={ajustCoffreLabel} onChange={e => setAjustCoffreLabel(e.target.value)} />
                <button className="btn-primary w-full" onClick={handleAjustCoffre} disabled={saving}>Appliquer</button>
              </div>
            </div>
          </div>
        )}

        {/* Historique semaines tréso */}
        {treso && treso.historique && treso.historique.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--blocc-border)' }}>
              <History size={14} style={{ color: 'var(--blocc-muted)' }} />
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Historique semaines</div>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--blocc-border)' }}>
              {treso.historique.map(s => (
                <div key={s.semaine} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{s.semaine}</div>
                    <div className="text-xs mt-0.5 flex gap-3" style={{ color: 'var(--blocc-muted)' }}>
                      <span style={{ color: '#4ade80' }}>+{formatMoney(s.totalEntrees)}</span>
                      <span style={{ color: '#f87171' }}>-{formatMoney(s.totalSorties)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: '#60a5fa' }}>{formatMoney(s.soldeFinal)}</div>
                    <div className="text-xs" style={{ color: 'var(--blocc-muted)' }}>solde final</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Derniers mouvements tréso */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Mouvements tréso</div>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'var(--blocc-border)' }}>
              {(treso?.mouvements || []).slice(0, 20).map(m => (
                <div key={m.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div style={{ color: 'var(--blocc-muted)' }}>{m.label}</div>
                  <div className="font-bold" style={{ color: getMovColor(m.type) }}>
                    {getMovSign(m.type)}{formatMoney(m.montant)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--blocc-border)' }}>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blocc-muted)' }}>Mouvements coffre</div>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'var(--blocc-border)' }}>
              {(coffre?.mouvements || []).slice(0, 20).map(m => (
                <div key={m.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div style={{ color: 'var(--blocc-muted)' }}>{m.label}</div>
                  <div className="font-bold" style={{ color: getMovColor(m.type) }}>
                    {getMovSign(m.type)}{formatMoney(m.montant)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
