/**
 * components/catalog/catalogTypes.ts
 * Tipos compartilhados entre os componentes do catálogo.
 */

export interface CatalogFilters {
  search?: string
  category?: string
  attributes?: Record<string, string[] | undefined>
  cursor?: string
}

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'name_asc'
