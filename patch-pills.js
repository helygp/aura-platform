
// patch-pills.js — substitui os pills de status no InventoryPage
const fs = require('fs');
const path = '/projetos/aura-platform/apps/erp/src/pages/inventory/InventoryPage.jsx';
let c = fs.readFileSync(path, 'utf8');

const OLD_PILLS = "          {['all', 'ok', 'baixo', 'zerado'].map(s => (\n            <button\n              key={s}\n              onClick={() => setFilters({ status: s })}\n              className={`\n                h-9 px-3 rounded-lg text-sm font-medium transition-colors\n                ${filters.status === s\n                  ? 'bg-[var(--color-primary)] text-white'\n                  : 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'\n                }\n              `}\n            >\n              {s === 'all' ? 'Todos' : s === 'ok' ? 'Em estoque' : s === 'baixo' ? 'Baixo' : 'Zerado'}\n            </button>\n          ))}";

const NEW_PILLS = "          {[\n            { value: 'all',     label: 'Todos' },\n            { value: 'ok',      label: 'Em estoque' },\n            { value: 'critico', label: '\\u26a0 Cr\\u00edtico', warn: true },\n            { value: 'baixo',   label: 'Baixo' },\n            { value: 'zerado',  label: 'Zerado' },\n          ].map(({ value, label, warn }) => {\n            const active = filters.status === value\n            const cls = [\n              'h-9 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',\n              active\n                ? (warn ? 'bg-amber-500 text-white' : 'bg-[var(--color-primary)] text-white')\n                : 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',\n            ].join(' ')\n            return (\n              <button key={value} onClick={() => setFilters({ status: value })} className={cls}>\n                {label}\n              </button>\n            )\n          })}";

if (!c.includes(OLD_PILLS)) {
  console.error('TRECHO NAO ENCONTRADO');
  console.error('Primeiro 80 chars do que procuro:', JSON.stringify(OLD_PILLS.substring(0, 80)));
  process.exit(1);
}

c = c.replace(OLD_PILLS, NEW_PILLS);
fs.writeFileSync(path, c);
console.log('OK — pills atualizados');
