/**
 * ImageCropModal.jsx
 *
 * Modal de recorte e otimização de foto de produto.
 * Aspect ratio fixo em 4:3 (padrão e-commerce).
 *
 * Fluxo:
 *  1. Recebe um File via prop `file`
 *  2. Usuário arrasta/zoom para escolher o foco
 *  3. Ao aplicar: extrai a área em canvas, redimensiona para max 1600px no lado maior,
 *     exporta JPEG com qualidade adaptativa (alvo ~800KB)
 *  4. Retorna data URL via `onConfirm(dataUrl)`
 *
 * Limites enforçados pelo chamador (ProductForm), aqui só processa.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { X, ZoomIn, ZoomOut } from 'lucide-react'

const TARGET_ASPECT     = 4 / 3
const MAX_OUTPUT_SIDE   = 1600       // max px no lado maior
const TARGET_BYTES_SOFT = 800 * 1024 // alvo ~800KB; se passar, recomprime
const QUALITY_HIGH      = 0.85
const QUALITY_LOW       = 0.75

/** Lê o File como object URL (mais leve em memória que dataURL para originais grandes). */
function useObjectUrl(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) { setUrl(null); return }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url
}

/** Formata bytes humanos (KB/MB). */
function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Carrega uma object URL em <img> e devolve Promise<HTMLImageElement>. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}

/** Converte um Canvas em data URL com qualidade adaptativa. */
function canvasToDataUrl(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blobHigh) => {
        if (blobHigh && blobHigh.size <= TARGET_BYTES_SOFT) {
          const r = new FileReader()
          r.onload = () => resolve({ dataUrl: r.result, bytes: blobHigh.size })
          r.readAsDataURL(blobHigh)
        } else {
          canvas.toBlob(
            (blobLow) => {
              const final = blobLow ?? blobHigh
              const r = new FileReader()
              r.onload = () => resolve({ dataUrl: r.result, bytes: final?.size ?? 0 })
              r.readAsDataURL(final)
            },
            'image/jpeg',
            QUALITY_LOW,
          )
        }
      },
      'image/jpeg',
      QUALITY_HIGH,
    )
  })
}

/**
 * Gera a imagem final cortada e otimizada.
 * @param {string} imageSrc  object URL do arquivo original
 * @param {{x:number,y:number,width:number,height:number}} pixelCrop
 * @returns {Promise<{dataUrl:string, bytes:number, width:number, height:number}>}
 */
async function createCroppedImage(imageSrc, pixelCrop) {
  const image = await loadImage(imageSrc)

  // 1. Canvas no tamanho exato do recorte
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width  = pixelCrop.width
  cropCanvas.height = pixelCrop.height
  const cropCtx = cropCanvas.getContext('2d')
  cropCtx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  )

  // 2. Se o lado maior do recorte exceder MAX_OUTPUT_SIDE, downscale proporcional
  let out = cropCanvas
  const longest = Math.max(pixelCrop.width, pixelCrop.height)
  if (longest > MAX_OUTPUT_SIDE) {
    const scale = MAX_OUTPUT_SIDE / longest
    const w = Math.round(pixelCrop.width  * scale)
    const h = Math.round(pixelCrop.height * scale)
    const scaled = document.createElement('canvas')
    scaled.width  = w
    scaled.height = h
    const sctx = scaled.getContext('2d')
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(cropCanvas, 0, 0, w, h)
    out = scaled
  }

  const { dataUrl, bytes } = await canvasToDataUrl(out)
  return { dataUrl, bytes, width: out.width, height: out.height }
}

export default function ImageCropModal({ file, onCancel, onConfirm }) {
  const imageUrl = useObjectUrl(file)

  const [crop, setCrop]     = useState({ x: 0, y: 0 })
  const [zoom, setZoom]     = useState(1)
  const [pixelCrop, setPixelCrop] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [error,      setError]      = useState(null)

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setPixelCrop(croppedAreaPixels)
  }, [])

  const originalBytes = useMemo(() => file?.size ?? 0, [file])

  const handleApply = async () => {
    if (!imageUrl || !pixelCrop) return
    setProcessing(true)
    setError(null)
    try {
      const { dataUrl } = await createCroppedImage(imageUrl, pixelCrop)
      onConfirm(dataUrl)
    } catch (err) {
      console.error('[ImageCropModal] erro ao gerar imagem', err)
      setError('Não consegui processar essa imagem. Tente outra.')
      setProcessing(false)
    }
  }

  // ESC fecha
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !processing) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, processing])

  if (!file) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => !processing && onCancel()} />

      <div className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)]">Ajustar foto</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Arraste para reposicionar · Use o zoom para enquadrar · Proporção 4:3
            </p>
          </div>
          <button
            type="button"
            onClick={() => !processing && onCancel()}
            className="w-8 h-8 rounded-full hover:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-muted)]"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Área do cropper */}
        <div className="relative w-full bg-black" style={{ height: 380 }}>
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={TARGET_ASPECT}
              minZoom={1}
              maxZoom={4}
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
            />
          )}
        </div>

        {/* Controles */}
        <div className="px-5 py-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="text-[var(--color-text-muted)]" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--color-primary)]"
              aria-label="Zoom"
            />
            <ZoomIn size={16} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
            Original: <strong className="text-[var(--color-text)]">{formatBytes(originalBytes)}</strong>{' '}
            · A foto será otimizada para web em JPEG (até ~800 KB, lado máximo 1600 px).
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-5 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => !processing && onCancel()}
            disabled={processing}
            className="h-9 px-4 rounded-xl text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!pixelCrop || processing}
            className="h-9 px-4 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {processing ? 'Processando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
