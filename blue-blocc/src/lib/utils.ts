import { Parametres } from '@/types'

// Semaine ISO en heure de Paris — identique pour tous les utilisateurs
export function getSemaine(date?: Date): string {
  // Convertir en heure Paris (Europe/Paris)
  const now = date || new Date()
  const pariStr = now.toLocaleString('en-CA', { timeZone: 'Europe/Paris', hour12: false })
  // en-CA format: "2026-06-25, 14:30:00"
  const d = new Date(pariStr.replace(', ', 'T'))

  // Calcul semaine ISO (lundi = début de semaine)
  const dayOfWeek = d.getDay() || 7 // 1=lundi, 7=dimanche
  const monday = new Date(d)
  monday.setDate(d.getDate() - dayOfWeek + 1)
  monday.setHours(0, 0, 0, 0)

  const yearStart = new Date(monday.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((monday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

  return `${monday.getFullYear()}-S${weekNo.toString().padStart(2, '0')}`
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(amount).replace('$US', '$').replace('USD', '$')
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('fr-FR')} kg`
}

export function calculerSalaire(totalVendu: number, params: Parametres): number {
  if (totalVendu < params.quotaIndividuel) return 0
  const depassement = totalVendu - params.quotaIndividuel
  const nbPaliers = Math.floor(depassement / params.bonusPalier)
  return params.salaireBase + nbPaliers * params.bonusMontant
}

// Retourne les N dernières semaines ISO (Paris) à garder
export function getSemainesAGarder(nbSemaines: number): string[] {
  const semaines: string[] = []
  const now = new Date()
  for (let i = 0; i < nbSemaines; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    semaines.push(getSemaine(d))
  }
  return semaines
}

// Retourne le label et la couleur du rôle à afficher (secondaire en priorité)
export function getRoleDisplay(
  role: string,
  customRoleId: string | undefined,
  customRoles: { id: string; nom: string; couleur: string }[]
): { label: string; couleur: string } {
  // Rôle secondaire en priorité
  if (customRoleId) {
    const cr = customRoles.find(r => r.id === customRoleId)
    if (cr) return { label: cr.nom, couleur: cr.couleur }
  }
  // Sinon rôle principal
  if (role === 'lead') return { label: 'Lead', couleur: '#fbbf24' }
  if (role === 'co-lead') return { label: 'Co-Lead', couleur: '#60a5fa' }
  return { label: 'Membre', couleur: '#6b82a8' }
}
