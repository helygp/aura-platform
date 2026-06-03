/**
 * pages/whatsapp/components/SessionCard.jsx
 *
 * Card de status da sessão WAHA.
 * Mostra: status com dot animado, número conectado, botões start/stop/restart.
 * Quando SCAN_QR: exibe QR code para escanear com o celular.
 *
 * Props:
 *   session      : { status, phone, name }
 *   qrCode       : string | null (base64 PNG)
 *   loading      : boolean
 *   onStart      : fn
 *   onStop       : fn
 */

import React from 'react'
import { Wifi, WifiOff, RefreshCw, Power, Smartphone } from 'lucide-react'
import { Card, Skeleton } from '@aura/ui'
import { SESSION_STATUS, SESSION_META } from '../whatsappTypes.js'

export function SessionCard({ session, qrCode, loading, onStart, onStop }) {
  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-start justify-between mb-4">
          <Skeleton width={100} height={12} />
          <Skeleton width={80} height={28} />
        </div>
        <Skeleton width={160} height={20} className="mb-2" />
        <Skeleton width={120} height={11} />
      </Card>
    )
  }

  const status = session?.status ?? SESSION_STATUS.STOPPED
  const meta   = SESSION_META[status] ?? SESSION_META[SESSION_STATUS.STOPPED]
  const isWorking  = status === SESSION_STATUS.WORKING
  const isScanQr   = status === SESSION_STATUS.SCAN_QR
  const isStopped  = status === SESSION_STATUS.STOPPED || status === SESSION_STATUS.FAILED
  const isStarting = status === SESSION_STATUS.STARTING

  return (
    <Card className="p-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
            Sessão WhatsApp
          </p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${meta.bg} ${meta.color} ${meta.border}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
            {meta.label}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0">
          {isStopped && (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              <Power size={14} /> Conectar
            </button>
          )}
          {isWorking && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <WifiOff size={14} /> Desconectar
            </button>
          )}
          {isStarting && (
            <div className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-[var(--color-text-muted)]">
              <RefreshCw size={14} className="animate-spin" /> Aguarde…
            </div>
          )}
        </div>
      </div>

      {/* ── Info quando conectado ── */}
      {isWorking && session?.phone && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
            <Smartphone size={18} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            {session.name && (
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">{session.name}</p>
            )}
            <p className="text-sm text-green-700 dark:text-green-300">{session.phone}</p>
          </div>
          <div className="ml-auto">
            <Wifi size={18} className="text-green-500" />
          </div>
        </div>
      )}

      {/* ── QR Code ── */}
      {isScanQr && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="p-3.5 bg-white rounded-2xl shadow-sm border border-[var(--color-border)]">
            {qrCode ? (
              <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48 block" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <RefreshCw size={24} className="text-gray-400 animate-spin" />
              </div>
            )}
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">Escaneie com o WhatsApp</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
            </p>
          </div>
        </div>
      )}

      {/* ── Stopped / Failed ── */}
      {isStopped && !isWorking && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
          <WifiOff size={18} className="text-[var(--color-text-disabled)] shrink-0" />
          <p className="text-sm text-[var(--color-text-muted)]">
            {status === SESSION_STATUS.FAILED
              ? 'A sessão falhou. Clique em "Conectar" para tentar novamente.'
              : 'Sessão desconectada. Clique em "Conectar" para iniciar.'
            }
          </p>
        </div>
      )}
    </Card>
  )
}
