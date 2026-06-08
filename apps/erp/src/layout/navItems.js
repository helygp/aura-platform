/**
 * layout/navItems.js
 *
 * Fonte única de verdade para itens de navegação do ERP.
 * roles: null = qualquer usuário autenticado
 * newTab: true = abre em nova aba ao clicar
 *
 * NOTA: Cockpit (stock-panel) foi movido para o Header como atalho
 * global — não faz mais parte do menu lateral.
 */

export const NAV_ITEMS = [
  {                            // 0
    key:   'dashboard',
    path:  '/dashboard',
    icon:  'LayoutDashboard',
    roles: null,
  },
  {                            // 1
    key:   'products',
    path:  '/products',
    icon:  'Package',
    roles: null,
  },
  {                            // 2
    key:   'inventory',
    path:  '/inventory',
    icon:  'Warehouse',
    roles: ['admin', 'estoque'],
  },
  {                            // 3
    key:   'orders',
    path:  '/orders',
    icon:  'ShoppingCart',
    roles: null,
  },
  {                            // 4
    key:   'customers',
    path:  '/customers',
    icon:  'Users',
    roles: null,
  },
  {                            // 5
    key:   'whatsapp',
    path:  '/whatsapp',
    icon:  'MessageCircle',
    roles: ['admin', 'operador'],
  },
  {                            // 6
    key:   'receivables',
    path:  '/receivables',
    icon:  'Wallet',
    roles: ['admin', 'financeiro'],
  },
  {                            // 7
    key:   'reports',
    path:  '/reports',
    icon:  'BarChart2',
    roles: ['admin', 'financeiro'],
  },
  {                            // 8
    key:   'users',
    path:  '/users',
    icon:  'UserCog',
    roles: ['admin'],
  },
  {                            // 9
    key:   'billing',
    path:  '/billing',
    icon:  'CreditCard',
    roles: ['admin'],
  },
  {                            // 10
    key:   'settings',
    path:  '/settings',
    icon:  'Settings',
    roles: ['admin'],
  },
]

/* Itens que aparecem no bottom nav mobile (máx. 5) */
export const BOTTOM_NAV_ITEMS = [
  NAV_ITEMS[0],  // dashboard
  NAV_ITEMS[3],  // orders
  NAV_ITEMS[1],  // products
  NAV_ITEMS[4],  // customers
  NAV_ITEMS[10], // settings
]
