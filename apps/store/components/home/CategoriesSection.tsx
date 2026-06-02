/**
 * components/home/CategoriesSection.tsx
 * Grade de categorias — links rápidos para o catálogo filtrado.
 */
import Link from 'next/link'

interface Props {
  categories: string[]
}

// Ícones por categoria — fallback para ícone genérico
const CATEGORY_ICONS: Record<string, () => JSX.Element> = {
  'camisetas':   ShirtIcon,
  'calças':      PantsIcon,
  'vestidos':    DressIcon,
  'acessórios':  AccessoryIcon,
  'calçados':    ShoesIcon,
}

export default function CategoriesSection({ categories }: Props) {
  if (categories.length === 0) return null

  return (
    <section className="bg-muted/40 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="mb-5 text-xl font-bold text-foreground sm:text-2xl">Categorias</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.toLowerCase()] ?? TagIcon
            return (
              <Link
                key={cat}
                href={`/catalogo?categoria=${encodeURIComponent(cat)}`}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                <Icon />
                {cat}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function ShirtIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
}
function PantsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v5l-3 13H6L3 8z"/><path d="M12 8v13"/></svg>
}
function DressIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 8 7l-5 13h18L16 7z"/><path d="M8 7h8"/></svg>
}
function AccessoryIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
}
function ShoesIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18l2-8 5 2 3-6 7 3-1 4-4-1-1 4-4-1z"/></svg>
}
function TagIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.3-7.3a1 1 0 0 0 0-1.42z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>
}
