'use client'

import React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pseudo || !password) {
      setError('Pseudo et mot de passe requis')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(pseudo, password)
      router.push('/dashboard')
    } catch (err: any) {
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        setError('Pseudo ou mot de passe incorrect')
      } else {
        setError('Erreur de connexion. Réessaie.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(30,107,255,0.12) 0%, #050a14 60%)',
      }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(30,107,255,0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: 'linear-gradient(135deg, #1e6bff, #00bfff)', boxShadow: '0 0 40px rgba(30,107,255,0.4)' }}
          >
            <span className="text-2xl font-black text-white">B</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight"
            style={{ background: 'linear-gradient(135deg, #fff, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            ROLLIN BLUES
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--blocc-muted)' }}>Système de gestion interne</p>
        </div>

        {/* Card */}
        <div className="card p-8 glow-blue">
          <h2 className="text-lg font-bold mb-6 text-white">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Pseudo</label>
              <input
                className="input"
                type="text"
                placeholder="Ton pseudo..."
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary w-full py-3 text-base"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--blocc-muted)' }}>
          Accès réservé aux membres du gang
        </p>
      </div>
    </div>
  )
}
