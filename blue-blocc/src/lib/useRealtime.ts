'use client'

import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

type RealtimeCallback = () => void

const TABLES = ['ventes', 'stocks', 'demandes', 'treso', 'treso_mouvements', 'entrepots', 'items']

export function useRealtime(onUpdate: RealtimeCallback) {
  const callbackRef = useRef(onUpdate)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    // Debounce — avoid firing 10 times if multiple tables update at once
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const handleChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        callbackRef.current()
      }, 300)
    }

    const channels = TABLES.map(table =>
      supabase
        .channel(`realtime:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, handleChange)
        .subscribe()
    )

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [])
}
