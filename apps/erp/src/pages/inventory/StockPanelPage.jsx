/**
 * pages/inventory/StockPanelPage.jsx
 *
 * Cockpit de Estoque — portado fielmente do HTML de referência.
 * Adaptações: API real, botão voltar, useTheme(), nova aba.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@aura/theme'
import './StockPanel.css'

/* ══ AUTH ══════════════════════════════════════════════ */
function authFetch(url) {
  const tok = window.__aura_mem_token__ || ''
  return fetch(url, {
    credentials: 'include',
    headers: tok ? { Authorization: 'Bearer ' + tok } : {},
  })
}

/* ══ DATA ADAPTER ══════════════════════════════════════
   ERP:  { id, code, name, category, skus:[{code, stock, stockMin, attributes}] }
   HTML: { id, name, cat, min, vel, trend, colors[], sizes[], stock:{cor:{tam:qty}} }

   id display  = p.code (código cadastrado, ex: "CAM-M")
   Cor         → colunas (horizontal / thead)
   Tamanho     → linhas  (vertical  / tbody rows)
══════════════════════════════════════════════════════ */
const PREF_COLS = ['Cor', 'cor', 'COLOR', 'Color', 'Estampa']
const PREF_ROWS = ['Tamanho', 'tamanho', 'Size', 'size', 'Tam', 'tam']

const _SZ_LETTERS = ['PP','P','M','G','GG','XG']
function _szKey(v) {
  const s = String(v).trim()
  if (/^[0-9]+(\.[0-9]+)?$/.test(s)) return 'A' + String(parseFloat(s) + 1e5).padStart(12,'0')
  const i = _SZ_LETTERS.indexOf(s.toUpperCase())
  return 'B' + (i === -1 ? s.toUpperCase() : String(i).padStart(4,'0'))
}
function _sortSizes(arr) { return [...arr].sort((a,b)=>{ const ka=_szKey(a),kb=_szKey(b); return ka<kb?-1:ka>kb?1:0 }) }
function _sortColors(arr){ return [...arr].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR')) }

function pickAttrKeys(keys) {
  const col = keys.find(k => PREF_COLS.includes(k))
           ?? keys.find(k => !PREF_ROWS.includes(k))
           ?? keys[0]
  const row = keys.find(k => PREF_ROWS.includes(k))
           ?? keys.find(k => k !== col)
           ?? null
  return { col, row }
}

function adaptProduct(p) {
  const skus = p.skus ?? []
  if (!skus.length) return null

  const attrKeys = [...new Set(skus.flatMap(s => Object.keys(s.attributes ?? {})))]
  const { col: colKey, row: rowKey } = pickAttrKeys(attrKeys)

  const mins   = skus.map(s => s.stockMin ?? 0).filter(v => v > 0)
  const repMin = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 10

  const base = {
    id:    p.code || p.name,
    name:  p.name,
    cat:   p.category ?? '',
    min:   repMin,
    max:   repMin * 3,
    vel:   0,
    trend: 0,
  }

  if (!colKey) {
    const colors = ['Qtd']
    const sizes  = skus.map(s => (s.code || '?').slice(0, 8))
    const stock  = { Qtd: {} }
    sizes.forEach((sz, i) => { stock.Qtd[sz] = skus[i].stock ?? 0 })
    return { ...base, colors, sizes, stock }
  }

  if (!rowKey) {
    const colors = ['Qtd']
    const sizes  = _sortSizes([...new Set(skus.map(s => String(s.attributes[colKey] ?? s.code ?? '?')))])
    const stock  = { Qtd: {} }
    sizes.forEach(sz => { stock.Qtd[sz] = 0 })
    skus.forEach(s => {
      const sz = String(s.attributes[colKey] ?? s.code ?? '?')
      stock.Qtd[sz] = (stock.Qtd[sz] ?? 0) + (s.stock ?? 0)
    })
    return { ...base, colors, sizes, stock }
  }

  // grade colKey (Cor) × rowKey (Tamanho)
  const colors = _sortColors([...new Set(skus.map(s => String(s.attributes[colKey] ?? '?')))])
  const sizes  = _sortSizes([...new Set(skus.map(s => String(s.attributes[rowKey] ?? '?')))])
  const stock  = {}
  colors.forEach(c => { stock[c] = {}; sizes.forEach(sz => { stock[c][sz] = 0 }) })
  skus.forEach(s => {
    const c  = String(s.attributes[colKey] ?? '?')
    const sz = String(s.attributes[rowKey] ?? '?')
    if (stock[c]) stock[c][sz] = s.stock ?? 0
  })
  return { ...base, colors, sizes, stock }
}

/* ══ UTILS ═════════════════════════════════════════════ */
const LV = {
  zero:    { fg: '#ff2d55', bg: '#4a000d', cls: 'lz', sev: 5, lbl: 'Zerado'  },
  critical:{ fg: '#ff453a', bg: '#6b140f', cls: 'lc', sev: 4, lbl: 'Crítico' },
  warning: { fg: '#ff9f0a', bg: '#5c2b00', cls: 'lw', sev: 3, lbl: 'Atenção' },
  low:     { fg: '#ffd60a', bg: '#3a2e00', cls: 'll', sev: 2, lbl: 'Baixo'   },
  ok:      { fg: '#30d158', bg: '#0a3520', cls: 'lo', sev: 1, lbl: 'OK'      },
  excess:  { fg: '#0a84ff', bg: '#081d40', cls: 'le', sev: 0, lbl: 'Excesso' },
}
const LV_ORDER = ['zero', 'critical', 'warning', 'low', 'ok', 'excess']

function getLevel(q, min) {
  if (q === 0)        return 'zero'
  if (q < min * .25) return 'critical'
  if (q < min * .55) return 'warning'
  if (q < min * .85) return 'low'
  if (q < min * 1.6) return 'ok'
  return 'excess'
}

function calcStats(p) {
  const cnt = { zero: 0, critical: 0, warning: 0, low: 0, ok: 0, excess: 0 }
  let total = 0, skus = 0
  p.colors.forEach(c => p.sizes.forEach(s => {
    const q = (p.stock[c] || {})[s] ?? 0
    cnt[getLevel(q, p.min)]++
    total += q
    skus++
  }))
  const cov   = p.vel > 0 ? Math.round(total / p.vel) : 0
  const worst = LV_ORDER.find(k => cnt[k] > 0) || 'excess'
  return { ...cnt, total, skus, cov, worst, alerts: cnt.zero + cnt.critical }
}

/* ══ COMPONENTS ════════════════════════════════════════ */

function Tooltip({ tip }) {
  if (!tip) return null
  const lv   = LV[tip.d.lv]
  const maxY = window.innerHeight - 170
  return (
    <div className="tip" style={{ left: tip.x + 16, top: Math.min(tip.y - 10, maxY) }}>
      <div className="tit" style={{ color: lv.fg }}>{tip.d.prod}</div>
      <div className="trow"><span>Cor / Tam</span><b>{tip.d.c} · {tip.d.s}</b></div>
      <div className="trow"><span>Estoque</span><b>{tip.d.q} un</b></div>
      <div className="trow"><span>Mínimo</span><b>{tip.d.min} un</b></div>
      {tip.d.cov > 0 && <div className="trow"><span>Cobertura</span><b>{tip.d.cov}d</b></div>}
      <div>
        <span className="tstat" style={{ background: lv.bg, color: lv.fg, border: `1px solid ${lv.fg}44` }}>
          {lv.lbl}
        </span>
      </div>
    </div>
  )
}

function Cell({ q, min, vel, c, s, prod, onH, onL }) {
  const lv  = getLevel(q, min)
  const cov = vel > 0 ? Math.round(q / vel) : 0
  return (
    <td>
      <div
        className={`hcell ${LV[lv].cls}`}
        style={{ background: LV[lv].bg, color: LV[lv].fg }}
        onMouseEnter={e => onH(e, { lv, q, min, cov, prod, c, s })}
        onMouseLeave={onL}
      >
        {q >= 1000 ? (q / 1000).toFixed(1) + 'k' : String(q)}
      </div>
    </td>
  )
}

function Heatmap({ p, onH, onL }) {
  return (
    <div className="hmwrap">
      <table className="hmtbl">
        <thead>
          <tr>
            <th style={{ width: 20 }}></th>
            {p.colors.map(c => (
              <th key={c} className="hcol">{c.length > 5 ? c.slice(0, 5) : c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.sizes.map(s => (
            <tr key={s}>
              <td className="hrlbl">{s}</td>
              {p.colors.map(c => (
                <Cell
                  key={c}
                  q={(p.stock[c] || {})[s] ?? 0}
                  min={p.min} vel={p.vel}
                  c={c} s={s} prod={p.id}
                  onH={onH} onL={onL}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HealthBar({ st }) {
  const t   = st.skus || 1
  const pct = n => `${(n / t * 100).toFixed(0)}%`
  return (
    <div className="hbwrap">
      <div className="hbtrack">
        {LV_ORDER.map(k => st[k] > 0 && (
          <div
            key={k} className="hbseg"
            style={{ width: pct(st[k]), background: LV[k].fg, opacity: k === 'ok' ? .55 : k === 'excess' ? .4 : 1 }}
          />
        ))}
      </div>
      <div className="hblbl">
        <span style={{ color: LV.zero.fg }}>{st.zero}z</span>
        <span style={{ color: LV.critical.fg }}>{st.critical}c</span>
        <span style={{ color: LV.ok.fg }}>{st.ok + st.excess}✓</span>
      </div>
    </div>
  )
}

function Card({ p, onH, onL, chanIdx }) {
  const st   = useMemo(() => calcStats(p), [p])
  const fg   = LV[st.worst].fg
  const sv   = { zero: 'sz', critical: 'sc', warning: 'sw', ok: 'soo', low: 'sw', excess: 'soo' }[st.worst]
  const covC = st.cov > 0 ? (st.cov < 7 ? LV.critical.fg : st.cov < 14 ? LV.warning.fg : LV.ok.fg) : 'var(--cp-t3)'
  const repC = st.alerts > 0 ? (st.zero > 0 ? 'rep-urgente' : 'rep-breve') : 'rep-ok'
  const repL = st.zero > 0 ? 'URG. REPOSIÇÃO' : st.critical > 0 ? 'REPOR BREVE' : 'OK'

  return (
    <div className={`card ${sv}`}>
      <span className="channum">{String(chanIdx + 1).padStart(2, '0')}</span>
      <div className="ch">
        <div className="csdot" style={{ background: fg, boxShadow: st.worst === 'zero' ? `0 0 8px ${fg}88` : 'none' }} />
        <div className="ctg">
          <div className="cid" style={{ color: fg }}>{p.id}</div>
          <div className="cname">{p.name}</div>
          <div className="cmeta">{p.cat} · {st.skus} SKUs · mín {p.min}</div>
        </div>
      </div>
      <Heatmap p={p} onH={onH} onL={onL} />
      <div className="cf">
        <div className="fm">
          <div className="fv" style={{ color: covC }}>{st.cov > 0 ? `${st.cov}d` : '—'}</div>
          <div className="fl">Cobert.</div>
        </div>
        <div className="fm">
          <div className="fv" style={{ color: 'var(--cp-t2)' }}>{st.total.toLocaleString('pt-BR')}</div>
          <div className="fl">Un.</div>
        </div>
        <HealthBar st={st} />
        <span className={`repbadge ${repC}`}>{repL}</span>
      </div>
    </div>
  )
}

function EmptySlot({ idx }) {
  return (
    <div className="empty-slot">
      <span className="eslbl">{String(idx + 1).padStart(2, '0')}</span>
      <span className="eslbl">SEM PRODUTO</span>
    </div>
  )
}

function KPIs({ products }) {
  const all  = useMemo(() => products.map(calcStats), [products])
  const tSku = all.reduce((a, s) => a + s.skus, 0)
  const tZ   = all.reduce((a, s) => a + s.zero, 0)
  const tC   = all.reduce((a, s) => a + s.critical, 0)
  const tQ   = all.reduce((a, s) => a + s.total, 0)
  const hp   = tSku > 0 ? Math.round(((tSku - tZ - tC) / tSku) * 100) : 100

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="kpi-l">Total SKUs</div>
        <div className="kpi-v">{tSku}</div>
        <div className="kpi-s">{products.length} produtos</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Zerados</div>
        <div className="kpi-v" style={{ color: tZ > 0 ? LV.zero.fg : undefined }}>{tZ}</div>
        <div className="kpi-s">{tSku > 0 ? ((tZ / tSku) * 100).toFixed(1) : 0}% do mix</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Críticos</div>
        <div className="kpi-v" style={{ color: tC > 0 ? LV.critical.fg : undefined }}>{tC}</div>
        <div className="kpi-s">{'<'}25% do mín</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Estoque</div>
        <div className="kpi-v">{tQ.toLocaleString('pt-BR')}</div>
        <div className="kpi-s">unidades</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Baixo</div>
        <div className="kpi-v" style={{ color: all.reduce((a, s) => a + s.low, 0) > 0 ? LV.low.fg : undefined }}>
          {all.reduce((a, s) => a + s.low, 0)}
        </div>
        <div className="kpi-s">{'<'}85% do mín</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Mix Saudável</div>
        <div className="kpi-v" style={{ color: hp < 50 ? LV.critical.fg : hp < 75 ? LV.warning.fg : LV.ok.fg }}>
          {hp}%
        </div>
        <div className="kpi-s">SKUs OK+</div>
      </div>
      <div className="kpi">
        <div className="kpi-l">Excesso</div>
        <div className="kpi-v" style={{ color: 'var(--cp-t3)' }}>
          {all.reduce((a, s) => a + s.excess, 0)}
        </div>
        <div className="kpi-s">acima 1.6× mín</div>
      </div>
    </div>
  )
}

function Header({ products, onBack, loading, onRefresh, lastUpdate }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const all = products.map(calcStats)
  const tz  = all.reduce((a, s) => a + s.zero, 0)
  const tc  = all.reduce((a, s) => a + s.critical, 0)
  const tw  = all.reduce((a, s) => a + s.warning + s.low, 0)
  const tok = all.reduce((a, s) => a + s.ok + s.excess, 0)

  return (
    <div className="hdr">
      <button className="hdr-back" onClick={onBack} title="Voltar">←</button>
      <div className="brand">
        <div className={`live${loading ? ' loading' : ''}`} />
        <span>COCKPIT</span>
        <span style={{ color: 'var(--cp-t3)', margin: '0 3px' }}>·</span>
        <span>ESTOQUE</span>
      </div>
      <div className="vsep" />
      <div className="pills">
        {tz  > 0 && <div className="pill pz"><div className="pdot" />{tz} zer</div>}
        {tc  > 0 && <div className="pill pc"><div className="pdot" />{tc} crit</div>}
        {tw  > 0 && <div className="pill pw"><div className="pdot" />{tw} atenção</div>}
        {tok > 0 && <div className="pill po"><div className="pdot" />{tok} ok</div>}
      </div>
      <div className="sp" />
      <span className="htime">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        &nbsp;{time.toLocaleDateString('pt-BR')}
        {lastUpdate && (
          <span style={{ marginLeft: 8, color: 'var(--cp-t3)' }}>
            ↺ {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </span>
      <button className={`hdr-refresh${loading ? ' spin' : ''}`} onClick={onRefresh} title="Atualizar">↻</button>
    </div>
  )
}

/* ══ GRID CONFIG ══════════���═════════════════════════════ */
const GRID_CFG = {
  '1':    { cols: 1,    rows: 1,    cls: 'gm1'    },
  '4':    { cols: 2,    rows: 2,    cls: 'gm4'    },
  '9':    { cols: 3,    rows: 3,    cls: 'gm9'    },
  '16':   { cols: 4,    rows: 4,    cls: 'gm16'   },
  'auto': { cols: null, rows: null, cls: 'gmauto'  },
}

/* ══ PÁGINA PRINCIPAL ══════════════════════════════════ */
export function StockPanelPage() {
  const navigate       = useNavigate()
  const { isDark }     = useTheme()

  const [theme,       setTheme]       = useState(() => isDark ? 'dark' : 'light')
  const [filter,      setFilter]      = useState('all')
  const [search,      setSearch]      = useState('')
  const [sort,        setSort]        = useState('severity')
  const [tip,         setTip]         = useState(null)
  const [gridMode,    setGridMode]    = useState('4')
  const [currentPage, setCurrentPage] = useState(0)
  const [autoRotate,  setAutoRotate]  = useState(false)
  const [rotInterval, setRotInterval] = useState(10)
  const [rotatePct,   setRotatePct]   = useState(0)

  const [rawProducts, setRawProducts] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdate,  setLastUpdate]  = useState(null)

  const totalPagesRef = useRef(1)
  const rotStartRef   = useRef(Date.now())
  const refreshRef    = useRef(null)

  const onH = useCallback((e, d) => setTip({ x: e.clientX, y: e.clientY, d }), [])
  const onL = useCallback(() => setTip(null), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await authFetch('/api/products')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setRawProducts((json.products ?? []).filter(p => (p.skus ?? []).length > 0))
      setLastUpdate(new Date())
    } catch { /* mantém dados anteriores */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (refreshRef.current) clearInterval(refreshRef.current)
    refreshRef.current = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(refreshRef.current)
  }, [load])

  const products = useMemo(
    () => rawProducts.map(adaptProduct).filter(Boolean),
    [rawProducts]
  )

  const pool = useMemo(() => {
    let ps = products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !p.id.toLowerCase().includes(search.toLowerCase()) &&
          !p.cat.toLowerCase().includes(search.toLowerCase())) return false
      if (filter === 'all')      return true
      const s = calcStats(p)
      if (filter === 'zero')     return s.zero > 0
      if (filter === 'critical') return s.critical > 0 || s.zero > 0
      if (filter === 'warning')  return s.warning > 0 || s.low > 0
      if (filter === 'ok')       return s.worst === 'ok' || s.worst === 'excess'
      return true
    })
    return ps.sort((a, b) => {
      if (sort === 'severity') return LV[calcStats(b).worst].sev - LV[calcStats(a).worst].sev
      if (sort === 'name')     return a.name.localeCompare(b.name, 'pt-BR')
      if (sort === 'id')       return a.id.localeCompare(b.id)
      if (sort === 'total')    return calcStats(b).total - calcStats(a).total
      return 0
    })
  }, [products, filter, search, sort])

  const gc         = GRID_CFG[gridMode]
  const pageSize   = gc.cols ? gc.cols * gc.rows : Infinity
  const totalPages = isFinite(pageSize) ? Math.max(1, Math.ceil(pool.length / pageSize)) : 1
  const safePage   = Math.min(currentPage, totalPages - 1)
  const visible    = isFinite(pageSize) ? pool.slice(safePage * pageSize, (safePage + 1) * pageSize) : pool
  const slots      = isFinite(pageSize)
    ? [...visible, ...Array(Math.max(0, pageSize - visible.length)).fill(null)]
    : visible

  useEffect(() => { totalPagesRef.current = totalPages }, [totalPages])
  useEffect(() => { setCurrentPage(0) }, [pool.length, gridMode])

  useEffect(() => {
    if (!autoRotate) { setRotatePct(0); return }
    rotStartRef.current = Date.now()
    const ms   = rotInterval * 1000
    const tick = setInterval(() => {
      const elapsed = Date.now() - rotStartRef.current
      setRotatePct((elapsed % ms) / ms * 100)
      if (elapsed >= ms) {
        rotStartRef.current = Date.now()
        setCurrentPage(p => (p + 1) % Math.max(1, totalPagesRef.current))
      }
    }, 80)
    return () => clearInterval(tick)
  }, [autoRotate, rotInterval])

  const fcounts = {
    z: pool.filter(p => calcStats(p).zero > 0).length,
    c: pool.filter(p => { const s = calcStats(p); return s.critical > 0 || s.zero > 0 }).length,
    w: pool.filter(p => { const s = calcStats(p); return s.warning > 0 || s.low > 0 }).length,
    o: pool.filter(p => { const s = calcStats(p); return s.worst === 'ok' || s.worst === 'excess' }).length,
  }

  const isFixed = gridMode !== 'auto'

  return (
    <div className={`cockpit-root theme-${theme}`}>

      <Header
        products={products}
        onBack={() => navigate(-1)}
        loading={loading}
        onRefresh={load}
        lastUpdate={lastUpdate}
      />

      <KPIs products={products} />

      {/* DVR CONTROLS */}
      <div className="ctrl">
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'var(--cp-t3)', fontWeight: 700, letterSpacing: '.08em', marginRight: 2 }}>GRID</span>
          {['1', '4', '9', '16', 'auto'].map(m => (
            <button
              key={m}
              className={`gmbtn${gridMode === m ? ' on' : ''}`}
              onClick={() => setGridMode(m)}
              title={m === 'auto' ? 'Auto — todos' : `Modo ${m}`}
            >
              {m === 'auto' ? '⊞' : m}
            </button>
          ))}
        </div>

        <div className="vsep" />

        {isFixed && (
          <>
            <button className="pgbtn" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>◀</button>
            <span className="pglbl">{safePage + 1}/{totalPages}</span>
            <button className="pgbtn" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>▶</button>
            <div className="vsep" />
          </>
        )}

        <button className={`timerbtn${autoRotate ? ' on' : ''}`} onClick={() => setAutoRotate(v => !v)}>
          {autoRotate ? '⏸ Pausar' : '▶ Rotacionar'}
        </button>
        <select className="intsec" value={rotInterval} onChange={e => setRotInterval(Number(e.target.value))}>
          {[5, 10, 15, 30, 60].map(s => <option key={s} value={s}>{s}s</option>)}
        </select>

        <div className="vsep" />

        <input
          className="srch"
          placeholder="🔍 Código / produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {[
          { k: 'all',      l: `Todos(${pool.length})`  },
          { k: 'zero',     l: `Zer.(${fcounts.z})`     },
          { k: 'critical', l: `Crit.(${fcounts.c})`    },
          { k: 'warning',  l: `Aten.(${fcounts.w})`    },
          { k: 'ok',       l: `OK(${fcounts.o})`       },
        ].map(({ k, l }) => (
          <button key={k} className={`fbtn${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}

        <div className="sp" />

        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {LV_ORDER.map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: 'var(--cp-t3)', fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: LV[k].fg, opacity: k === 'ok' || k === 'excess' ? .45 : .85 }} />
              {LV[k].lbl}
            </div>
          ))}
        </div>

        <div className="vsep" />

        <button
          className={`tbtn2${theme === 'light' ? ' ton' : ''}`}
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>

        <select className="srt" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="severity">↓ Críticos</option>
          <option value="id">ID A→Z</option>
          <option value="name">Nome A→Z</option>
          <option value="total">↓ Estoque</option>
        </select>
      </div>

      {/* GRID AREA */}
      <div className="dvrarea">
        {loading && products.length === 0 ? (
          <div className="cp-loading">
            <div className="cp-spinner" />
            <span>Carregando estoque…</span>
          </div>
        ) : isFixed ? (
          <div className={`dvrgrid ${gc.cls}`}>
            {slots.map((p, i) => p
              ? <Card key={p.id} p={p} onH={onH} onL={onL} chanIdx={safePage * pageSize + i} />
              : <EmptySlot key={`e${i}`} idx={safePage * pageSize + i} />
            )}
          </div>
        ) : (
          <div className="dvrscroll">
            <div className={`dvrgrid ${gc.cls}`}>
              {pool.map((p, i) => <Card key={p.id} p={p} onH={onH} onL={onL} chanIdx={i} />)}
            </div>
          </div>
        )}
      </div>

      {autoRotate && (
        <div className="tbar">
          <div className="tbar-fill" style={{ width: `${rotatePct}%` }} />
        </div>
      )}

      <Tooltip tip={tip} />
    </div>
  )
}
