/**
 * layout/navItems.js
 *
 * Fonte única de verdade para itens de navegação do ERP.
 * Cada item define: rota, chave i18n, ícone (nome Lucide) e papel mínimo.
 * roles: null = qualquer usuário autenticado
 */

export const NAV_ITEMS = [
  {
    key:   'dashboard',
    path:  '/dashboard',
    icon:  'LayoutDashboard',
    roles: null,
  },
  {
    key:   'products',
    path:  '/products',
    icon:  'Package',
    roles: null,
  },
  {
    key:   'inventory',
    path:  '/inventory',
    icon:  'Warehouse',
    roles: ['admin', 'estoque'],
  },
  {
    key:   'orders',
    path:  '/orders',
    icon:  'ShoppingCart',
    roles: null,
  },
  {
    key:   'customers',
    path:  '/customers',
    icon:  'Users',
    roles: null,
  },
  {
    key:   'whatsapp',
    path:  '/whatsapp',
    icon:  'MessageCircle',
    roles: ['admin', 'operador'],
  },
  {
    key:   'reports',
    path:  '/reports',
    icon:  'BarChart2',
    roles: ['admin', 'financeiro'],
  },
  {
    key:   'billing',
    path:  '/billing',
    icon:  'CreditCard',
    roles: ['admin'],
  },
  {
    key:   'settings',
    path:  '/settings',
    icon:  'Settings',
    roles: ['admin'],
  },
]

/* Itens que aparecem no bottom nav mobile (máx. 5) */
export const BOTTOM_NAV_ITEMS = [
  NAV_ITEMS[0], // dashboard
  NAV_ITEMS[3], // orders
  NAV_ITEMS[1], // products
  NAV_ITEMS[4], // customers
  NAV_ITEMS[6], // settings
]
