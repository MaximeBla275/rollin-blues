export type Permission =
  | 'faire_ventes'
  | 'voir_stock'
  | 'gerer_stock'
  | 'voir_treso'
  | 'voir_membres'
  | 'gerer_demandes'
  | 'faire_demandes'
  | 'voir_rendements'
  | 'gerer_membres'
  | 'gerer_roles'
  | 'voir_dashboard_lead'
  | 'gerer_payes'
  | 'voir_coffre'
  | 'modifier_treso'
  | 'supprimer_ventes'
  | 'gerer_labo'
  | 'voir_labo'

export interface CustomRole {
  id: string
  nom: string
  permissions: Permission[]
  couleur: string
  ordre: number
  createdAt: string
}

export interface UserProfile {
  uid: string
  pseudo: string
  role: string
  customRoleId?: string
  createdAt: string
  createdBy: string
}

export interface Member {
  uid: string
  pseudo: string
  role: string
  customRoleId?: string
  createdAt: string
}

export interface Item {
  id: string
  nom: string
  prixAchat: number
  prixVenteMoyen: number
  unite: string
  requireStock: boolean
  occupePlace: boolean
  compteQuota: boolean
  createdAt: string
}

export interface StockItem {
  itemId: string
  itemNom: string
  quantite: number
  prixAchatUnitaire: number
}

export interface Entrepot {
  id: string
  nom: string
  capaciteMax: number
  stocks: StockItem[]
  createdAt: string
}

export interface Vente {
  id: string
  membreId: string
  membrePseudo: string
  itemId: string
  itemNom: string
  quantite: number
  cashSale: number
  prixAchatUnitaire: number
  coutAchat: number
  benefSale: number
  type: 'normale' | 'nulle'
  semaine: string
  createdAt: string
}

export interface DemandeStock {
  id: string
  membreId: string
  membrePseudo: string
  itemId: string
  itemNom: string
  quantite: number
  prixAchat: number
  montantTotal: number
  statut: 'en_attente' | 'validee' | 'refusee'
  entrepotId: string
  createdAt: string
  traiteeBy?: string
  traiteeAt?: string
}

export interface Parametres {
  nomGang: string
  tresoCapitalInitial: number
  tresoObjectif: number
  quotaIndividuel: number
  objectifGlobal: number
  salaireBase: number
  bonusMontant: number
  bonusPalier: number
  coffreObjectif: number
}

export interface TresoMouvement {
  id: string
  type: 'entree' | 'sortie' | 'init' | 'transfert_coffre' | 'transfert_treso' | 'ajustement' | 'reset'
  montant: number
  label: string
  semaine?: string
  ref?: string
  createdAt: string
}

export interface TresoSemaine {
  semaine: string
  soldeFinal: number
  totalEntrees: number
  totalSorties: number
  createdAt: string
}

export interface Treso {
  solde: number
  semaine: string
  mouvements: TresoMouvement[]
  historique: TresoSemaine[]
}

export interface Coffre {
  solde: number
  objectif: number
  mouvements: TresoMouvement[]
}

export interface RendementItem {
  itemId: string
  itemNom: string
  prixAchatMoyen: number
  prixVenteConfig: number
  prixVenteReel: number
  rendementConfig: number
  rendementReel: number
  totalKgVendus: number
  totalCashSale: number
  nbVentes: number
}

export interface LaboItem {
  id: string
  nom: string
  unite: string
  poids: number
  prixAchat: number
  categorie: 'consommable' | 'branche'
  createdAt: string
}

export interface LaboStock {
  itemId: string
  itemNom: string
  quantite: number
  prixAchatUnitaire: number
}

export interface LaboConfig {
  prixVenteBranche: number
  recette: { itemId: string; itemNom: string; quantiteParLabo: number }[]
  capaciteMax: number
}

export interface LaboSession {
  id: string
  membreId: string
  membrePseudo: string
  nbBranches: number
  valeurMarchande: number
  consommablesUtilises: { itemId: string; itemNom: string; quantite: number }[]
  semaine: string
  createdAt: string
}

export interface LaboDemandeRestock {
  id: string
  membreId: string
  membrePseudo: string
  itemId: string
  itemNom: string
  quantite: number
  statut: 'en_attente' | 'validee' | 'refusee'
  createdAt: string
}
