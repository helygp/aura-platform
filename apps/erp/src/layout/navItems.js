/**
 * layout/navItems.js
 *
 * Fonte única de verdade para itens de navegação do ERP.
 * roles: null = qualquer usuário autenticado
 * newTab: true = abre em nova aba ao clicar
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
    key:    'stock-panel',
    path:   '/stock-panel',
    icon:   'Monitor',
    roles:  ['admin', 'estoque'],
    newTab: true,
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
    key:   'receivables',
    path:  '/receivables',
    icon:  'Wallet',
    roles: ['admin', 'financeiro'],
  },
  {
    key:   'reports',
    path:  '/reports',
    icon:  'BarChart2',
    roles: ['admin', 'financeiro'],
  },
  {
    key:   'users',
    path:  '/users',
    icon:  'UserCog',
    roles: ['admin'],
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
  NAV_ITEMS[0],  // dashboard
  NAV_ITEMS[4],  // orders
  NAV_ITEMS[1],  // products
  NAV_ITEMS[5],  // customers
  NAV_ITEMS[11], // settings
]
