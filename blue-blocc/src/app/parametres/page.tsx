'use client'

import React, { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/lib/auth-context'
import { getNbSemainesHistorique, setNbSemainesHistorique } from '@/lib/db'
import { Key, Clock } from 'lucide-react'

export default function ParametresPage() {
  const { isLead, changePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [nbSemaines, setNbSemaines] = useState(5)
  const [historiqueSaved, setHistoriqueSaved] = useState(false)

  useEffect(() => {
    if (isLead) getNbSemainesHistorique().then(setNbSemaines)
  }, [isLead])

  const handlePwChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(''); setPwSuccess('')
    if (newPassword.length < 6) { setPwError('Minimum 6 caractères'); return }
    if (newPassword !== confirmPassword) { setPwError('Les mots de passe ne correspondent pas'); return }
    setPwSaving(true)
    try {
      await changePassword(newPassword)
      setPwSuccess('Mot de passe mis à jour')
      setNewPassword(''); setConfirmPassword('')
    } catch { setPwError('Erreur lors du changement.') }
    finally { setPwSaving(false) }
  }

  const handleSaveHistorique = async () => {
    await setNbSemainesHistorique(nbSemaines)
    setHistoriqueSaved(true)
    setTimeout(() => setHistoriqueSaved(false), 2000)
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-8 pt-4">
        <div>
          <h1 className="text-2xl font-black text-white">Paramètres</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>
            {isLead ? 'Config avancée dans le Dashboard Lead' : 'Ton compte'}
          </p>
        </div>

        {/* Historique - leads seulement */}
        {isLead && (
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--blocc-muted)' }}>
              <Clock size={14} /> Historique des semaines
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--blocc-muted)' }}>
              Les ventes plus anciennes que ce nombre de semaines sont supprimées automatiquement. 
              Les semaines en cours et récentes sont toujours conservées.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <input
                  className="input w-24 text-center text-lg font-bold"
                  type="number" min="2" max="52"
                  value={nbSemaines}
                  onChange={e => setNbSemaines(Number(e.target.value))}
                />
                <span className="text-sm text-white">semaines</span>
              </div>
              <button className="btn-primary" onClick={handleSaveHistorique}>
                {historiqueSaved ? 'Sauvegardé ✓' : 'Sauvegarder'}
              </button>
            </div>
            <div className="mt-3 text-xs" style={{ color: 'var(--blocc-muted)' }}>
              Le nettoyage s'effectue automatiquement quand un lead ouvre le dashboard.
              Avec 5 semaines et 50 ventes/semaine ≈ 0.1 Mo utilisé.
            </div>
          </div>
        )}

        {/* Mot de passe */}
        <div className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: 'var(--blocc-muted)' }}>
            <Key size={14} /> Mon mot de passe
          </h2>
          <form onSubmit={handlePwChange} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Nouveau mot de passe</label>
                <input className="input" type="password" placeholder="min 6 caractères" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="label">Confirmer</label>
                <input className="input" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            {pwError && <div className="text-sm text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(239,68,68,0.1)' }}>{pwError}</div>}
            {pwSuccess && <div className="text-sm text-green-400 px-3 py-2 rounded" style={{ background: 'rgba(34,197,94,0.1)' }}>{pwSuccess}</div>}
            <button type="submit" className="btn-primary" disabled={pwSaving}>
              {pwSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
