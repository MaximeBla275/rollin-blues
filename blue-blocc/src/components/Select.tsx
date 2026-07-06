'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  placeholder?: string
  required?: boolean
}

export default function Select({ value, onChange, options, className = '', placeholder, required }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`} style={{ zIndex: open ? 1000 : 1 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input flex items-center justify-between gap-2 text-left"
        style={{ cursor: 'pointer' }}
      >
        <span style={{ color: selected ? 'var(--blocc-text)' : 'var(--blocc-muted)' }}>
          {selected ? selected.label : (placeholder || '-- Choisir --')}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--blocc-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden"
          style={{
            background: '#0a1628',
            border: '1px solid var(--blocc-border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 9999,
            top: '100%',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors"
              style={{
                background: opt.value === value ? 'rgba(30,107,255,0.2)' : 'transparent',
                color: opt.value === value ? '#60a5fa' : 'var(--blocc-text)',
              }}
              onMouseOver={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseOut={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
