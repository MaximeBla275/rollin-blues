import { supabase } from './supabase'
import {
  Member, Vente, DemandeStock, Entrepot, Item,
  Parametres, StockItem, Treso, TresoMouvement,
  CustomRole, Permission, RendementItem
} from '@/types'
import { getSemaine } from './utils'

const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()

export const ALL_PERMISSIONS: { id: Permission; label: string; desc: string }[] = [
  { id: 'faire_ventes', label: 'Faire des ventes', desc: 'Enregistrer des ventes' },
  { id: 'faire_demandes', label: 'Faire des demandes', desc: 'Demander du stock' },
  { id: 'voir_stock', label: 'Voir le stock', desc: 'Accès page stock en lecture' },
  { id: 'gerer_stock', label: 'Gérer le stock', desc: 'Créer/recharger/modifier entrepôts' },
  { id: 'voir_treso', label: 'Voir la tréso', desc: 'Voir la trésorerie complète' },
  { id: 'voir_membres', label: 'Voir les membres', desc: 'Accès à la liste des membres' },
  { id: 'gerer_membres', label: 'Gérer les membres', desc: 'Créer/modifier/supprimer membres' },
  { id: 'gerer_demandes', label: 'Valider demandes', desc: 'Valider ou refuser les demandes de stock' },
  { id: 'voir_rendements', label: 'Voir les rendements', desc: 'Stats de rendement par produit' },
  { id: 'voir_dashboard_lead', label: 'Dashboard lead', desc: 'Accès au dashboard complet lead' },
  { id: 'gerer_payes', label: 'Gérer les payes', desc: "Accès onglet payes et config salaires" },
  { id: 'gerer_roles', label: 'Gérer les rôles', desc: 'Créer/modifier les rôles personnalisés' },
  { id: 'voir_coffre', label: 'Voir le coffre', desc: 'Accès à la page coffre et transferts' },
  { id: 'modifier_treso', label: 'Modifier la tréso', desc: 'Ajuster manuellement le solde de la tréso' },
  { id: 'supprimer_ventes', label: 'Supprimer des ventes', desc: 'Annuler une vente et revenir en arrière' },
  { id: 'gerer_labo', label: 'Gérer le labo', desc: 'Configurer, restocke et gérer la plantation' },
  { id: 'voir_labo', label: 'Voir le labo', desc: 'Déclarer des labos et voir la page plantation' },
]

const ALL_PERMS: Permission[] = ALL_PERMISSIONS.map(p => p.id) as Permission[]

export const SYSTEM_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  'lead': ALL_PERMS,
  'co-lead': ALL_PERMS,
  'membre': ['faire_ventes', 'faire_demandes', 'voir_membres', 'voir_rendements'],
}

export function getMemberPermissions(member: Member, customRoles: CustomRole[]): Permission[] {
  if (member.role === 'lead' || member.role === 'co-lead') return ALL_PERMS
  if (member.customRoleId) {
    const cr = customRoles.find(r => r.id === member.customRoleId)
    if (cr) return cr.permissions
  }
  return SYSTEM_ROLE_PERMISSIONS['membre']
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function mapMembre(row: Record<string, unknown>): Member & { password: string } {
  return {
    uid: String(row.uid),
    pseudo: String(row.pseudo),
    role: String(row.role),
    customRoleId: row.custom_role_id ? String(row.custom_role_id) : undefined,
    createdAt: String(row.created_at),
    password: String(row.password),
  }
}

function mapItem(row: Record<string, unknown>): Item {
  return {
    id: String(row.id),
    nom: String(row.nom),
    prixAchat: Number(row.prix_achat),
    prixVenteMoyen: Number(row.prix_vente_moyen),
    unite: String(row.unite),
    requireStock: row.require_stock !== false && row.require_stock !== 0,
    occupePlace: row.occupe_place !== false && row.occupe_place !== 0,
    compteQuota: row.compte_quota !== false && row.compte_quota !== 0,
    createdAt: String(row.created_at),
  }
}

function mapEntrepot(row: Record<string, unknown>, stocks: StockItem[]): Entrepot {
  return {
    id: String(row.id),
    nom: String(row.nom),
    capaciteMax: Number(row.capacite_max),
    stocks,
    createdAt: String(row.created_at),
  }
}

function mapVente(row: Record<string, unknown>): Vente {
  return {
    id: String(row.id),
    membreId: String(row.membre_id),
    membrePseudo: String(row.membre_pseudo),
    itemId: String(row.item_id),
    itemNom: String(row.item_nom),
    quantite: Number(row.quantite),
    cashSale: Number(row.cash_sale),
    prixAchatUnitaire: Number(row.prix_achat_unitaire),
    coutAchat: Number(row.cout_achat),
    benefSale: Number(row.benef_sale),
    type: row.type as 'normale' | 'nulle',
    semaine: String(row.semaine),
    createdAt: String(row.created_at),
  }
}

function mapDemande(row: Record<string, unknown>): DemandeStock {
  return {
    id: String(row.id),
    membreId: String(row.membre_id),
    membrePseudo: String(row.membre_pseudo),
    itemId: String(row.item_id),
    itemNom: String(row.item_nom),
    quantite: Number(row.quantite),
    prixAchat: Number(row.prix_achat),
    montantTotal: Number(row.montant_total),
    statut: row.statut as 'en_attente' | 'validee' | 'refusee',
    entrepotId: String(row.entrepot_id),
    createdAt: String(row.created_at),
    traiteeBy: row.traitee_by ? String(row.traitee_by) : undefined,
    traiteeAt: row.traitee_at ? String(row.traitee_at) : undefined,
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export async function loginMembre(pseudo: string, password: string): Promise<Member & { password: string }> {
  const { data, error } = await supabase
    .from('membres')
    .select('*')
    .ilike('pseudo', pseudo.trim())
    .single()
  if (error || !data) throw new Error('Pseudo ou mot de passe incorrect')
  const membre = mapMembre(data as Record<string, unknown>)
  if (membre.password !== password) throw new Error('Pseudo ou mot de passe incorrect')
  return membre
}

export async function updatePassword(uid: string, password: string): Promise<void> {
  await supabase.from('membres').update({ password, must_change_password: false }).eq('uid', uid)
}

// ─── CUSTOM ROLES ─────────────────────────────────────────────────────────────
export async function getCustomRoles(): Promise<CustomRole[]> {
  const { data } = await supabase.from('custom_roles').select('*').order('ordre', { ascending: true }).order('created_at')
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    nom: String(r.nom),
    permissions: (r.permissions as string[]) as Permission[],
    couleur: String(r.couleur),
    ordre: Number(r.ordre ?? 0),
    createdAt: String(r.created_at),
  }))
}

export async function createCustomRole(nom: string, permissions: Permission[], couleur: string): Promise<void> {
  const { data: existing } = await supabase.from('custom_roles').select('ordre').order('ordre', { ascending: false }).limit(1)
  const nextOrdre = existing && existing.length > 0 ? Number((existing[0] as Record<string, unknown>).ordre) + 1 : 0
  await supabase.from('custom_roles').insert({ id: genId('role'), nom: nom.trim(), permissions, couleur, ordre: nextOrdre })
}

export async function updateCustomRole(roleId: string, data: Partial<Pick<CustomRole, 'nom' | 'permissions' | 'couleur'>>): Promise<void> {
  await supabase.from('custom_roles').update({
    ...(data.nom && { nom: data.nom }),
    ...(data.permissions && { permissions: data.permissions }),
    ...(data.couleur && { couleur: data.couleur }),
  }).eq('id', roleId)
}

export async function deleteCustomRole(roleId: string): Promise<void> {
  await supabase.from('custom_roles').delete().eq('id', roleId)
}

// ─── PARAMS ───────────────────────────────────────────────────────────────────
export async function getParametres(): Promise<Parametres> {
  const [{ data: p }, { data: t }] = await Promise.all([
    supabase.from('parametres').select('*').eq('id', 1).single(),
    supabase.from('treso').select('*').eq('id', 1).single(),
  ])
  return {
    nomGang: p ? String(p.nom_gang) : 'Rollin Blues',
    tresoCapitalInitial: t ? Number(t.capital_initial) : 0,
    tresoObjectif: t ? Number(t.objectif) : 1500000,
    quotaIndividuel: p ? Number(p.quota_individuel) : 600,
    objectifGlobal: p ? Number(p.objectif_global) : 3000,
    salaireBase: p ? Number(p.salaire_base) : 30000,
    bonusMontant: p ? Number(p.bonus_montant) : 2000,
    bonusPalier: p ? Number(p.bonus_palier) : 200,
    coffreObjectif: p ? Number(p.coffre_objectif ?? 500000) : 500000,
  }
}

export async function setParametres(params: Partial<Parametres>): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (params.nomGang !== undefined) updates.nom_gang = params.nomGang
  if (params.quotaIndividuel !== undefined) updates.quota_individuel = params.quotaIndividuel
  if (params.objectifGlobal !== undefined) updates.objectif_global = params.objectifGlobal
  if (params.salaireBase !== undefined) updates.salaire_base = params.salaireBase
  if (params.bonusMontant !== undefined) updates.bonus_montant = params.bonusMontant
  if (params.bonusPalier !== undefined) updates.bonus_palier = params.bonusPalier
  if (Object.keys(updates).length > 0) {
    await supabase.from('parametres').upsert({ id: 1, ...updates, updated_at: now() })
  }

  if (params.tresoCapitalInitial !== undefined || params.tresoObjectif !== undefined) {
    const tresoUpdates: Record<string, unknown> = {}
    if (params.tresoCapitalInitial !== undefined) {
      const { data: t } = await supabase.from('treso').select('capital_initial').eq('id', 1).single()
      const oldCapital = t ? Number(t.capital_initial) : 0
      const diff = params.tresoCapitalInitial - oldCapital
      tresoUpdates.capital_initial = params.tresoCapitalInitial
      // Adjust solde by the difference
      const { data: treso } = await supabase.from('treso').select('solde').eq('id', 1).single()
      tresoUpdates.solde = (treso ? Number(treso.solde) : 0) + diff
    }
    if (params.tresoObjectif !== undefined) tresoUpdates.objectif = params.tresoObjectif
    tresoUpdates.updated_at = now()
    await supabase.from('treso').upsert({ id: 1, ...tresoUpdates })
  }
}

// ─── TRESO ────────────────────────────────────────────────────────────────────
export async function getTreso(): Promise<Treso> {
  return getTresoComplete()
}

async function addTresoMouvement(type: 'entree' | 'sortie', montant: number, label: string, ref?: string): Promise<void> {
  const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
  const currentSolde = t ? Number(t.solde) : 0
  const newSolde = type === 'entree' ? currentSolde + montant : currentSolde - montant
  await Promise.all([
    supabase.from('treso').update({ solde: newSolde, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').insert({ id: genId('mv'), type, montant, label, ref, created_at: now() }),
  ])
}

export async function resetTreso(): Promise<void> {
  const { data: t } = await supabase.from('treso').select('capital_initial').eq('id', 1).single()
  const capital = t ? Number(t.capital_initial) : 0
  await Promise.all([
    supabase.from('treso').update({ solde: capital, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').delete().neq('id', ''),
  ])
  if (capital > 0) {
    await supabase.from('treso_mouvements').insert({ id: genId('mv'), type: 'init', montant: capital, label: 'Capital initial (reset)', created_at: now() })
  }
}

// ─── ITEMS ────────────────────────────────────────────────────────────────────
export async function getItems(): Promise<Item[]> {
  const { data } = await supabase.from('items').select('*').order('created_at')
  return (data || []).map(r => mapItem(r as Record<string, unknown>))
}

export async function createItem(nom: string, prixAchat: number, unite: string, requireStock = true, occupePlace = true, compteQuota = true): Promise<void> {
  await supabase.from('items').insert({ id: genId('item'), nom: nom.trim(), prix_achat: prixAchat, prix_vente_moyen: 0, unite: unite || 'kg', require_stock: requireStock, occupe_place: occupePlace, compte_quota: compteQuota })
}

export async function updateItem(itemId: string, data: Partial<Pick<Item, 'nom' | 'prixAchat' | 'prixVenteMoyen' | 'unite' | 'requireStock' | 'occupePlace' | 'compteQuota'>>): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (data.nom !== undefined) updates.nom = data.nom
  if (data.prixAchat !== undefined) updates.prix_achat = data.prixAchat
  if (data.prixVenteMoyen !== undefined) updates.prix_vente_moyen = data.prixVenteMoyen
  if (data.unite !== undefined) updates.unite = data.unite
  if (data.requireStock !== undefined) updates.require_stock = data.requireStock
  if (data.occupePlace !== undefined) updates.occupe_place = data.occupePlace
  if (data.compteQuota !== undefined) updates.compte_quota = data.compteQuota
  await supabase.from('items').update(updates).eq('id', itemId)
}

export async function deleteItem(itemId: string): Promise<void> {
  await supabase.from('items').delete().eq('id', itemId)
}

export async function updateItemPrixVente(itemId: string, prixVenteMoyen: number): Promise<void> {
  await supabase.from('items').update({ prix_vente_moyen: prixVenteMoyen }).eq('id', itemId)
}

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
export async function getMembers(): Promise<Member[]> {
  const { data } = await supabase.from('membres').select('*').order('created_at')
  return (data || []).map(r => {
    const m = mapMembre(r as Record<string, unknown>)
    const { password, ...safe } = m
    void password
    return safe
  })
}

export async function createMember(pseudo: string, role: string, password: string, creatorUid: string, customRoleId?: string): Promise<void> {
  const clean = pseudo.trim()
  if (!clean) throw new Error('Pseudo requis')
  const { data: existing } = await supabase.from('membres').select('uid').ilike('pseudo', clean).single()
  if (existing) throw new Error('Ce pseudo existe déjà')
  await supabase.from('membres').insert({
    uid: genId('member'), pseudo: clean, role,
    password: password.trim() || 'membre',
    custom_role_id: customRoleId || null,
    must_change_password: true,
    created_by: creatorUid,
  })
}

export async function updateMemberRole(memberId: string, role: string, customRoleId?: string): Promise<void> {
  await supabase.from('membres').update({ role, custom_role_id: customRoleId || null }).eq('uid', memberId)
}

export async function updateMemberPassword(memberId: string, password: string): Promise<void> {
  await supabase.from('membres').update({ password }).eq('uid', memberId)
}

export async function deleteMember(memberId: string): Promise<void> {
  await supabase.from('membres').delete().eq('uid', memberId)
}

// ─── ENTREPOTS ────────────────────────────────────────────────────────────────
export async function getEntrepots(): Promise<Entrepot[]> {
  const [{ data: entrepots }, { data: stocks }] = await Promise.all([
    supabase.from('entrepots').select('*').order('created_at'),
    supabase.from('stocks').select('*'),
  ])
  // Récupérer les items pour savoir lesquels occupent de la place
  const { data: itemsData } = await supabase.from('items').select('id, occupe_place')
  const itemPlaceMap = new Map((itemsData || []).map((i: Record<string, unknown>) => [String(i.id), i.occupe_place !== false && i.occupe_place !== 0]))

  return (entrepots || []).map(e => {
    const eStocks = (stocks || [])
      .filter((s: Record<string, unknown>) => s.entrepot_id === e.id)
      .map((s: Record<string, unknown>): StockItem & { occupePlace: boolean } => ({
        itemId: String(s.item_id),
        itemNom: String(s.item_nom),
        quantite: Number(s.quantite),
        prixAchatUnitaire: Number(s.prix_achat_unitaire),
        occupePlace: itemPlaceMap.get(String(s.item_id)) ?? true,
      }))
    return mapEntrepot(e as Record<string, unknown>, eStocks)
  })
}

export async function createEntrepot(nom: string, capaciteMax = 1500): Promise<void> {
  await supabase.from('entrepots').insert({ id: genId('entrepot'), nom: nom.trim(), capacite_max: capaciteMax })
}

export async function updateEntrepot(entrepotId: string, data: Partial<Pick<Entrepot, 'nom' | 'capaciteMax'>>): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (data.nom !== undefined) updates.nom = data.nom
  if (data.capaciteMax !== undefined) updates.capacite_max = data.capaciteMax
  await supabase.from('entrepots').update(updates).eq('id', entrepotId)
}

export async function deleteEntrepot(entrepotId: string): Promise<void> {
  await supabase.from('entrepots').delete().eq('id', entrepotId)
}

async function upsertStock(entrepotId: string, itemId: string, itemNom: string, quantite: number, prixAchatUnitaire: number): Promise<void> {
  const { data: existing } = await supabase.from('stocks').select('*').eq('entrepot_id', entrepotId).eq('item_id', itemId).single()
  if (existing) {
    const totalQty = Number(existing.quantite) + quantite
    const newPrix = totalQty > 0 ? (Number(existing.quantite) * Number(existing.prix_achat_unitaire) + quantite * prixAchatUnitaire) / totalQty : prixAchatUnitaire
    await supabase.from('stocks').update({ quantite: totalQty, prix_achat_unitaire: newPrix }).eq('entrepot_id', entrepotId).eq('item_id', itemId)
  } else {
    await supabase.from('stocks').insert({ id: genId('stock'), entrepot_id: entrepotId, item_id: itemId, item_nom: itemNom, quantite, prix_achat_unitaire: prixAchatUnitaire })
  }
}

export async function rechargerEntrepot(entrepotId: string, itemId: string, itemNom: string, quantite: number, prixAchat: number): Promise<void> {
  const { data: e } = await supabase.from('entrepots').select('nom').eq('id', entrepotId).single()
  await upsertStock(entrepotId, itemId, itemNom, quantite, prixAchat)
  await addTresoMouvement('sortie', quantite * prixAchat, `Achat ${itemNom} — ${e?.nom || entrepotId}`, genId('recharge'))
}

export async function getStockDisponible(itemId: string): Promise<{ quantite: number; prixAchatUnitaire: number }> {
  const { data } = await supabase.from('stocks').select('*').eq('item_id', itemId)
  const stocks = data || []
  const totalQty = stocks.reduce((s: number, st: Record<string, unknown>) => s + Number(st.quantite), 0)
  const totalValue = stocks.reduce((s: number, st: Record<string, unknown>) => s + Number(st.quantite) * Number(st.prix_achat_unitaire), 0)
  return { quantite: totalQty, prixAchatUnitaire: totalQty > 0 ? totalValue / totalQty : 0 }
}

export async function transfererStock(fromEntrepotId: string, toEntrepotId: string, itemId: string, itemNom: string, quantite: number): Promise<void> {
  const { data: fromStock } = await supabase.from('stocks').select('*').eq('entrepot_id', fromEntrepotId).eq('item_id', itemId).single()
  if (!fromStock) return
  const prixUnitaire = Number(fromStock.prix_achat_unitaire)
  const newQty = Number(fromStock.quantite) - quantite
  if (newQty <= 0) {
    await supabase.from('stocks').delete().eq('entrepot_id', fromEntrepotId).eq('item_id', itemId)
  } else {
    await supabase.from('stocks').update({ quantite: newQty }).eq('entrepot_id', fromEntrepotId).eq('item_id', itemId)
  }
  await upsertStock(toEntrepotId, itemId, itemNom, quantite, prixUnitaire)
}

// ─── VENTES ───────────────────────────────────────────────────────────────────
export async function getVentes(options?: { membreId?: string; semaine?: string }): Promise<Vente[]> {
  let q = supabase.from('ventes').select('*').order('created_at', { ascending: false })
  if (options?.membreId) q = q.eq('membre_id', options.membreId)
  if (options?.semaine) q = q.eq('semaine', options.semaine)
  const { data } = await q
  return (data || []).map(r => mapVente(r as Record<string, unknown>))
}

export async function getSemaines(): Promise<string[]> {
  const { data } = await supabase.from('ventes').select('semaine')
  const semaines = Array.from(new Set((data || []).map((v: Record<string, unknown>) => String(v.semaine)))).sort().reverse()
  return semaines
}

export async function addVente(vente: Omit<Vente, 'id' | 'semaine' | 'createdAt'> & { requireStock?: boolean }): Promise<void> {
  const semaine = getSemaine()
  const id = genId('vente')
  // Déduire stock seulement si l'item le requiert
  if (vente.requireStock !== false) {
    const { data: stocks } = await supabase.from('stocks').select('*').eq('item_id', vente.itemId).order('quantite', { ascending: false })
    if (stocks && stocks.length > 0) {
      let remaining = vente.quantite
      for (const s of stocks as Record<string, unknown>[]) {
        if (remaining <= 0) break
        const qty = Math.min(Number(s.quantite), remaining)
        const newQty = Number(s.quantite) - qty
        if (newQty <= 0) {
          await supabase.from('stocks').delete().eq('entrepot_id', s.entrepot_id).eq('item_id', vente.itemId)
        } else {
          await supabase.from('stocks').update({ quantite: newQty }).eq('entrepot_id', s.entrepot_id).eq('item_id', vente.itemId)
        }
        remaining -= qty
      }
    }
  }
  await supabase.from('ventes').insert({
    id, membre_id: vente.membreId, membre_pseudo: vente.membrePseudo,
    item_id: vente.itemId, item_nom: vente.itemNom,
    quantite: vente.quantite, cash_sale: vente.cashSale,
    prix_achat_unitaire: vente.prixAchatUnitaire, cout_achat: vente.coutAchat,
    benef_sale: vente.benefSale, type: vente.type, semaine,
  })
  if (vente.type === 'normale' && vente.cashSale > 0) {
    await addTresoMouvement('entree', vente.cashSale, `Vente ${vente.itemNom} — ${vente.membrePseudo}`, id)
  }
}

// ─── DEMANDES ─────────────────────────────────────────────────────────────────
export async function getDemandes(options?: { membreId?: string; statut?: string }): Promise<DemandeStock[]> {
  let q = supabase.from('demandes').select('*').order('created_at', { ascending: false })
  if (options?.membreId) q = q.eq('membre_id', options.membreId)
  if (options?.statut) q = q.eq('statut', options.statut)
  const { data } = await q
  return (data || []).map(r => mapDemande(r as Record<string, unknown>))
}

export async function addDemande(demande: Omit<DemandeStock, 'id' | 'createdAt' | 'statut'>): Promise<void> {
  await supabase.from('demandes').insert({
    id: genId('demande'), membre_id: demande.membreId, membre_pseudo: demande.membrePseudo,
    item_id: demande.itemId, item_nom: demande.itemNom, quantite: demande.quantite,
    prix_achat: demande.prixAchat, montant_total: demande.montantTotal,
    entrepot_id: demande.entrepotId, statut: 'en_attente',
  })
}

export async function traiterDemande(demandeId: string, statut: 'validee' | 'refusee', traiteeBy: string): Promise<void> {
  const { data: demande } = await supabase.from('demandes').select('*').eq('id', demandeId).single()
  if (!demande) return
  await supabase.from('demandes').update({ statut, traitee_by: traiteeBy, traitee_at: now() }).eq('id', demandeId)
  if (statut === 'validee') {
    const d = mapDemande(demande as Record<string, unknown>)
    await upsertStock(d.entrepotId, d.itemId, d.itemNom, d.quantite, d.prixAchat)
    await addTresoMouvement('sortie', d.quantite * d.prixAchat, `Achat ${d.itemNom} — demande de ${d.membrePseudo}`, demandeId)
  }
}

// ─── RENDEMENTS ───────────────────────────────────────────────────────────────
export async function getRendements(): Promise<RendementItem[]> {
  const [items, ventes] = await Promise.all([getItems(), getVentes()])
  const ventesNormales = ventes.filter(v => v.type === 'normale')
  return items.map(item => {
    const vi = ventesNormales.filter(v => v.itemId === item.id)
    const totalKgVendus = vi.reduce((s, v) => s + v.quantite, 0)
    const totalCashSale = vi.reduce((s, v) => s + v.cashSale, 0)
    const prixVenteReel = totalKgVendus > 0 ? totalCashSale / totalKgVendus : 0
    const prixVenteConfig = item.prixVenteMoyen || 0
    const rendementConfig = prixVenteConfig > 0 && item.prixAchat > 0 ? ((prixVenteConfig - item.prixAchat) / item.prixAchat) * 100 : 0
    const rendementReel = prixVenteReel > 0 && item.prixAchat > 0 ? ((prixVenteReel - item.prixAchat) / item.prixAchat) * 100 : 0
    return { itemId: item.id, itemNom: item.nom, prixAchatMoyen: item.prixAchat, prixVenteConfig, prixVenteReel, rendementConfig, rendementReel, totalKgVendus, totalCashSale, nbVentes: vi.length }
  })
}

// ─── NETTOYAGE HISTORIQUE ────────────────────────────────────────────────────
export async function nettoyerHistorique(): Promise<void> {
  const { data: p } = await supabase.from('parametres').select('nb_semaines_historique').eq('id', 1).single()
  const nbSemaines = p ? Number(p.nb_semaines_historique) : 5

  // Calculer les semaines à garder
  const { getSemainesAGarder } = await import('./utils')
  const aGarder = getSemainesAGarder(nbSemaines)

  // Supprimer les ventes plus anciennes
  const { data: toutesVentes } = await supabase.from('ventes').select('semaine')
  const semainesDansDb = Array.from(new Set((toutesVentes || []).map((v: Record<string, unknown>) => String(v.semaine))))
  const aSupprimer = semainesDansDb.filter(s => !aGarder.includes(s))

  // Supprimer les demandes traitées de plus de X semaines
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - nbSemaines * 7)
  await supabase.from('demandes')
    .delete()
    .neq('statut', 'en_attente')
    .lt('created_at', cutoffDate.toISOString())

  if (aSupprimer.length > 0) {
    for (const semaine of aSupprimer) {
      await supabase.from('ventes').delete().eq('semaine', semaine)
    }
    // Aussi nettoyer les mouvements tréso trop anciens (garder 200 max)
    const { data: mouvements } = await supabase
      .from('treso_mouvements')
      .select('id')
      .order('created_at', { ascending: false })
    if (mouvements && mouvements.length > 200) {
      const aEffacer = (mouvements as Record<string, unknown>[]).slice(200).map(m => String(m.id))
      for (const id of aEffacer) {
        await supabase.from('treso_mouvements').delete().eq('id', id)
      }
    }
  }
}

export async function getNbSemainesHistorique(): Promise<number> {
  const { data } = await supabase.from('parametres').select('nb_semaines_historique').eq('id', 1).single()
  return data ? Number(data.nb_semaines_historique) : 5
}

export async function setNbSemainesHistorique(nb: number): Promise<void> {
  await supabase.from('parametres').update({ nb_semaines_historique: nb }).eq('id', 1)
}

export async function supprimerDemande(demandeId: string): Promise<void> {
  await supabase.from('demandes').delete().eq('id', demandeId)
}

export async function updateCustomRoleOrdre(roles: { id: string; ordre: number }[]): Promise<void> {
  await Promise.all(roles.map(r => supabase.from('custom_roles').update({ ordre: r.ordre }).eq('id', r.id)))
}

// ─── TRESO HEBDOMADAIRE ──────────────────────────────────────────────────────
export async function getTresoComplete(): Promise<import('@/types').Treso> {
  const semaine = getSemaine()
  const [{ data: t }, { data: m }, { data: h }] = await Promise.all([
    supabase.from('treso').select('*').eq('id', 1).single(),
    supabase.from('treso_mouvements').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('treso_semaines').select('*').order('semaine', { ascending: false }).limit(10),
  ])
  return {
    solde: t ? Number(t.solde) : 0,
    semaine,
    mouvements: (m || []).map((mv: Record<string, unknown>) => ({
      id: String(mv.id),
      type: mv.type as import('@/types').TresoMouvement['type'],
      montant: Number(mv.montant),
      label: String(mv.label),
      semaine: mv.semaine ? String(mv.semaine) : undefined,
      ref: mv.ref ? String(mv.ref) : undefined,
      createdAt: String(mv.created_at),
    })),
    historique: (h || []).map((s: Record<string, unknown>) => ({
      semaine: String(s.semaine),
      soldeFinal: Number(s.solde_final),
      totalEntrees: Number(s.total_entrees),
      totalSorties: Number(s.total_sorties),
      createdAt: String(s.created_at),
    })),
  }
}

export async function ajusterTreso(montant: number, label: string, type: 'entree' | 'sortie' | 'ajustement'): Promise<void> {
  const semaine = getSemaine()
  const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
  const currentSolde = t ? Number(t.solde) : 0
  const newSolde = type === 'sortie' ? currentSolde - Math.abs(montant) : currentSolde + Math.abs(montant)
  await Promise.all([
    supabase.from('treso').update({ solde: newSolde, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').insert({
      id: genId('mv'), type, montant: Math.abs(montant), label, semaine, created_at: now()
    }),
  ])
}

export async function cloturerSemaineTreso(): Promise<void> {
  const semaine = getSemaine()
  const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
  const soldeFinal = t ? Number(t.solde) : 0
  
  // Calculer totaux entrées/sorties de la semaine
  const { data: mouvements } = await supabase
    .from('treso_mouvements')
    .select('*')
    .eq('semaine', semaine)
  
  const totalEntrees = (mouvements || [])
    .filter((m: Record<string, unknown>) => m.type === 'entree')
    .reduce((s: number, m: Record<string, unknown>) => s + Number(m.montant), 0)
  const totalSorties = (mouvements || [])
    .filter((m: Record<string, unknown>) => m.type === 'sortie')
    .reduce((s: number, m: Record<string, unknown>) => s + Number(m.montant), 0)

  // Archiver la semaine
  await supabase.from('treso_semaines').upsert({
    id: genId('tresosem'),
    semaine,
    solde_final: soldeFinal,
    total_entrees: totalEntrees,
    total_sorties: totalSorties,
    created_at: now(),
  })

  // Reset le solde à zéro
  await Promise.all([
    supabase.from('treso').update({ solde: 0, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').insert({
      id: genId('mv'), type: 'reset', montant: soldeFinal,
      label: `Clôture semaine ${semaine} — solde archivé`, semaine, created_at: now()
    }),
  ])
}

export async function resetTresoManuel(label = 'Reset manuel par lead'): Promise<void> {
  const semaine = getSemaine()
  const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
  const soldeFinal = t ? Number(t.solde) : 0
  await Promise.all([
    supabase.from('treso').update({ solde: 0, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').insert({
      id: genId('mv'), type: 'reset', montant: soldeFinal,
      label, semaine, created_at: now()
    }),
  ])
}

// ─── COFFRE ──────────────────────────────────────────────────────────────────
export async function getCoffre(): Promise<import('@/types').Coffre> {
  const [{ data: c }, { data: m }] = await Promise.all([
    supabase.from('coffre').select('*').eq('id', 1).single(),
    supabase.from('coffre_mouvements').select('*').order('created_at', { ascending: false }).limit(50),
  ])
  return {
    solde: c ? Number(c.solde) : 0,
    objectif: c ? Number(c.objectif) : 500000,
    mouvements: (m || []).map((mv: Record<string, unknown>) => ({
      id: String(mv.id),
      type: mv.type as import('@/types').TresoMouvement['type'],
      montant: Number(mv.montant),
      label: String(mv.label),
      ref: mv.ref ? String(mv.ref) : undefined,
      createdAt: String(mv.created_at),
    })),
  }
}

export async function transfererVersCoffre(montant: number, label: string): Promise<void> {
  // Retirer de la tréso
  const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
  const newTreso = (t ? Number(t.solde) : 0) - montant
  // Ajouter au coffre
  const { data: cof } = await supabase.from('coffre').select('solde').eq('id', 1).single()
  const newCoffre = (cof ? Number(cof.solde) : 0) + montant
  const semaine = getSemaine()
  await Promise.all([
    supabase.from('treso').update({ solde: newTreso, updated_at: now() }).eq('id', 1),
    supabase.from('coffre').update({ solde: newCoffre, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').insert({ id: genId('mv'), type: 'transfert_coffre', montant, label: `→ Coffre : ${label}`, semaine, created_at: now() }),
    supabase.from('coffre_mouvements').insert({ id: genId('mv'), type: 'transfert_coffre', montant, label: `← Tréso : ${label}`, created_at: now() }),
  ])
}

export async function transfererDepuisCoffre(montant: number, label: string): Promise<void> {
  const { data: cof } = await supabase.from('coffre').select('solde').eq('id', 1).single()
  const newCoffre = (cof ? Number(cof.solde) : 0) - montant
  const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
  const newTreso = (t ? Number(t.solde) : 0) + montant
  const semaine = getSemaine()
  await Promise.all([
    supabase.from('coffre').update({ solde: newCoffre, updated_at: now() }).eq('id', 1),
    supabase.from('treso').update({ solde: newTreso, updated_at: now() }).eq('id', 1),
    supabase.from('coffre_mouvements').insert({ id: genId('mv'), type: 'transfert_treso', montant, label: `→ Tréso : ${label}`, created_at: now() }),
    supabase.from('treso_mouvements').insert({ id: genId('mv'), type: 'transfert_treso', montant, label: `← Coffre : ${label}`, semaine, created_at: now() }),
  ])
}

export async function ajusterCoffre(montant: number, label: string, type: 'entree' | 'sortie' | 'ajustement'): Promise<void> {
  const { data: cof } = await supabase.from('coffre').select('solde').eq('id', 1).single()
  const newSolde = type === 'sortie'
    ? (cof ? Number(cof.solde) : 0) - Math.abs(montant)
    : (cof ? Number(cof.solde) : 0) + Math.abs(montant)
  await Promise.all([
    supabase.from('coffre').update({ solde: newSolde, updated_at: now() }).eq('id', 1),
    supabase.from('coffre_mouvements').insert({ id: genId('mv'), type, montant: Math.abs(montant), label, created_at: now() }),
  ])
}

export async function setCoffreObjectif(objectif: number): Promise<void> {
  await supabase.from('coffre').update({ objectif, updated_at: now() }).eq('id', 1)
}

// Vérifie si la semaine a changé et clôture auto si besoin
export async function checkResetHebdo(): Promise<void> {
  const semaineCourante = getSemaine()
  // Chercher le dernier mouvement de type reset
  const { data } = await supabase
    .from('treso_mouvements')
    .select('semaine')
    .eq('type', 'reset')
    .order('created_at', { ascending: false })
    .limit(1)
  
  const dernierReset = data && data.length > 0 ? String((data[0] as Record<string, unknown>).semaine) : null
  
  // Si on n'a pas encore reset cette semaine et qu'il y a des mouvements
  if (dernierReset !== semaineCourante) {
    const { data: mouvSemaine } = await supabase
      .from('treso_mouvements')
      .select('id')
      .eq('semaine', semaineCourante)
      .limit(1)
    
    // S'il y a des mouvements cette semaine, vérifier si c'est une nouvelle semaine
    if (!mouvSemaine || mouvSemaine.length === 0) {
      // Nouvelle semaine détectée, clôturer la précédente
      const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
      if (t && Number(t.solde) !== 0) {
        await cloturerSemaineTreso()
      }
    }
  }
}

export async function resetTresPur(): Promise<void> {
  await Promise.all([
    supabase.from('treso').update({ solde: 0, updated_at: now() }).eq('id', 1),
    supabase.from('treso_mouvements').delete().neq('id', ''),
  ])
}

export async function supprimerVente(venteId: string): Promise<void> {
  const { data: vente } = await supabase.from('ventes').select('*').eq('id', venteId).single()
  if (!vente) return
  const v = vente as Record<string, unknown>

  // Remettre le stock si l'item le requiert
  if (v.type === 'normale') {
    const { data: item } = await supabase.from('items').select('require_stock').eq('id', String(v.item_id)).single()
    if (item && (item as Record<string, unknown>).require_stock !== false) {
      // Remettre dans le premier entrepôt disponible
      const { data: entrepots } = await supabase.from('entrepots').select('id').limit(1)
      if (entrepots && entrepots.length > 0) {
        const entrepotId = String((entrepots[0] as Record<string, unknown>).id)
        const { data: existing } = await supabase.from('stocks')
          .select('*').eq('entrepot_id', entrepotId).eq('item_id', String(v.item_id)).single()
        if (existing) {
          await supabase.from('stocks').update({
            quantite: Number((existing as Record<string, unknown>).quantite) + Number(v.quantite)
          }).eq('entrepot_id', entrepotId).eq('item_id', String(v.item_id))
        } else {
          await supabase.from('stocks').insert({
            id: genId('stock'), entrepot_id: entrepotId,
            item_id: String(v.item_id), item_nom: String(v.item_nom),
            quantite: Number(v.quantite), prix_achat_unitaire: Number(v.prix_achat_unitaire),
          })
        }
      }
    }

    // Déduire le cashSale de la tréso
    if (Number(v.cash_sale) > 0) {
      const { data: t } = await supabase.from('treso').select('solde').eq('id', 1).single()
      const newSolde = (t ? Number(t.solde) : 0) - Number(v.cash_sale)
      await Promise.all([
        supabase.from('treso').update({ solde: newSolde, updated_at: now() }).eq('id', 1),
        supabase.from('treso_mouvements').insert({
          id: genId('mv'), type: 'sortie', montant: Number(v.cash_sale),
          label: `Annulation vente ${String(v.item_nom)} — ${String(v.membre_pseudo)}`,
          semaine: String(v.semaine), created_at: now()
        }),
      ])
    }
  }

  // Supprimer la vente
  await supabase.from('ventes').delete().eq('id', venteId)
}

// ─── LABO ────────────────────────────────────────────────────────────────────

export async function getLaboItems(): Promise<import('@/types').LaboItem[]> {
  const { data } = await supabase.from('labo_items').select('*').order('categorie').order('nom')
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id), nom: String(r.nom), unite: String(r.unite),
    poids: Number(r.poids), prixAchat: Number(r.prix_achat),
    categorie: r.categorie as 'consommable' | 'branche',
    createdAt: String(r.created_at),
  }))
}

export async function createLaboItem(nom: string, unite: string, poids: number, prixAchat: number, categorie: 'consommable' | 'branche'): Promise<void> {
  await supabase.from('labo_items').insert({ id: genId('labo'), nom, unite, poids, prix_achat: prixAchat, categorie })
}

export async function updateLaboItem(id: string, data: Partial<{ nom: string; unite: string; poids: number; prixAchat: number }>): Promise<void> {
  const u: Record<string, unknown> = {}
  if (data.nom) u.nom = data.nom
  if (data.unite) u.unite = data.unite
  if (data.poids !== undefined) u.poids = data.poids
  if (data.prixAchat !== undefined) u.prix_achat = data.prixAchat
  await supabase.from('labo_items').update(u).eq('id', id)
}

export async function deleteLaboItem(id: string): Promise<void> {
  await supabase.from('labo_items').delete().eq('id', id)
}

export async function getLaboStocks(): Promise<import('@/types').LaboStock[]> {
  const { data } = await supabase.from('labo_stocks').select('*')
  return (data || []).map((r: Record<string, unknown>) => ({
    itemId: String(r.item_id), itemNom: String(r.item_nom),
    quantite: Number(r.quantite), prixAchatUnitaire: Number(r.prix_achat_unitaire),
  }))
}

export async function rechargerLaboStock(itemId: string, itemNom: string, quantite: number, prixAchat: number): Promise<void> {
  const { data: existing } = await supabase.from('labo_stocks').select('*').eq('item_id', itemId).single()
  if (existing) {
    const e = existing as Record<string, unknown>
    const totalQty = Number(e.quantite) + quantite
    const newPrix = (Number(e.quantite) * Number(e.prix_achat_unitaire) + quantite * prixAchat) / totalQty
    await supabase.from('labo_stocks').update({ quantite: totalQty, prix_achat_unitaire: newPrix }).eq('item_id', itemId)
  } else {
    await supabase.from('labo_stocks').insert({ id: genId('labostock'), item_id: itemId, item_nom: itemNom, quantite, prix_achat_unitaire: prixAchat })
  }
  // Déduire de la tréso
  await addTresoMouvement('sortie', quantite * prixAchat, `Achat labo ${itemNom}`, genId('labo'))
}

export async function getLaboConfig(): Promise<import('@/types').LaboConfig> {
  const { data } = await supabase.from('labo_config').select('*').eq('id', 1).single()
  if (!data) return { prixVenteBranche: 500, recette: [], capaciteMax: 1000 }
  const d = data as Record<string, unknown>
  return {
    prixVenteBranche: Number(d.prix_vente_branche),
    capaciteMax: Number(d.capacite_max),
    recette: (d.recette as import('@/types').LaboConfig['recette']) || [],
  }
}

export async function updateLaboConfig(config: Partial<import('@/types').LaboConfig>): Promise<void> {
  const u: Record<string, unknown> = { updated_at: now() }
  if (config.prixVenteBranche !== undefined) u.prix_vente_branche = config.prixVenteBranche
  if (config.capaciteMax !== undefined) u.capacite_max = config.capaciteMax
  if (config.recette !== undefined) u.recette = config.recette
  await supabase.from('labo_config').update(u).eq('id', 1)
}

export async function declarerLabo(membreId: string, membrePseudo: string, nbBranches: number): Promise<void> {
  const config = await getLaboConfig()
  const semaine = getSemaine()
  const valeurMarchande = nbBranches * config.prixVenteBranche
  const consommablesUtilises: { itemId: string; itemNom: string; quantite: number }[] = []

  // Déduire les consommables selon la recette
  for (const r of config.recette) {
    const qte = r.quantiteParLabo * nbBranches
    consommablesUtilises.push({ itemId: r.itemId, itemNom: r.itemNom, quantite: qte })
    const { data: stock } = await supabase.from('labo_stocks').select('quantite').eq('item_id', r.itemId).single()
    if (stock) {
      const newQty = Math.max(0, Number((stock as Record<string, unknown>).quantite) - qte)
      await supabase.from('labo_stocks').update({ quantite: newQty }).eq('item_id', r.itemId)
    }
  }

  // Ajouter les branches au stock
  const brancheItem = await supabase.from('labo_items').select('*').eq('categorie', 'branche').limit(1)
  if (brancheItem.data && brancheItem.data.length > 0) {
    const b = brancheItem.data[0] as Record<string, unknown>
    await rechargerLaboStockSansDebit(String(b.id), String(b.nom), nbBranches, 0)
  }

  await supabase.from('labo_sessions').insert({
    id: genId('session'), membre_id: membreId, membre_pseudo: membrePseudo,
    nb_branches: nbBranches, valeur_marchande: valeurMarchande,
    consommables_utilises: consommablesUtilises, semaine, created_at: now(),
  })
}

async function rechargerLaboStockSansDebit(itemId: string, itemNom: string, quantite: number, prixAchat: number): Promise<void> {
  const { data: existing } = await supabase.from('labo_stocks').select('*').eq('item_id', itemId).single()
  if (existing) {
    await supabase.from('labo_stocks').update({ quantite: Number((existing as Record<string, unknown>).quantite) + quantite }).eq('item_id', itemId)
  } else {
    await supabase.from('labo_stocks').insert({ id: genId('labostock'), item_id: itemId, item_nom: itemNom, quantite, prix_achat_unitaire: prixAchat })
  }
}

export async function getLaboSessions(semaine?: string): Promise<import('@/types').LaboSession[]> {
  let q = supabase.from('labo_sessions').select('*').order('created_at', { ascending: false })
  if (semaine) q = q.eq('semaine', semaine)
  const { data } = await q
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id), membreId: String(r.membre_id), membrePseudo: String(r.membre_pseudo),
    nbBranches: Number(r.nb_branches), valeurMarchande: Number(r.valeur_marchande),
    consommablesUtilises: (r.consommables_utilises as import('@/types').LaboSession['consommablesUtilises']) || [],
    semaine: String(r.semaine), createdAt: String(r.created_at),
  }))
}

export async function getLaboDemandes(): Promise<import('@/types').LaboDemandeRestock[]> {
  const { data } = await supabase.from('labo_demandes').select('*').order('created_at', { ascending: false })
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id), membreId: String(r.membre_id), membrePseudo: String(r.membre_pseudo),
    itemId: String(r.item_id), itemNom: String(r.item_nom),
    quantite: Number(r.quantite), statut: r.statut as 'en_attente' | 'validee' | 'refusee',
    createdAt: String(r.created_at),
  }))
}

export async function addLaboDemande(membreId: string, membrePseudo: string, itemId: string, itemNom: string, quantite: number): Promise<void> {
  await supabase.from('labo_demandes').insert({ id: genId('labodem'), membre_id: membreId, membre_pseudo: membrePseudo, item_id: itemId, item_nom: itemNom, quantite, statut: 'en_attente' })
}

export async function traiterLaboDemande(id: string, statut: 'validee' | 'refusee'): Promise<void> {
  await supabase.from('labo_demandes').update({ statut }).eq('id', id)
}

export async function supprimerLaboDemande(id: string): Promise<void> {
  await supabase.from('labo_demandes').delete().eq('id', id)
}
