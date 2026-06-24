import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../cn.js'

/**
 * Modal — Aura UI (wrapper sobre Radix Dialog)
 *
 * Uso composto:
 *   <Modal>
 *     <Modal.Trigger asChild><Button>Abrir</Button></Modal.Trigger>
 *     <Modal.Content title="Título" description="Subtítulo opcional">
 *       <p>corpo aqui</p>
 *       <Modal.Footer>
 *         <Modal.Close asChild><Button variant="secondary">Cancelar</Button></Modal.Close>
 *         <Button onClick={handleConfirm}>Confirmar</Button>
 *       </Modal.Footer>
 *     </Modal.Content>
 *   </Modal>
 *
 * Uso controlado:
 *   <Modal open={open} onOpenChange={setOpen}>
 *     <Modal.Content title="...">...</Modal.Content>
 *   </Modal>
 *
 * Fecha ao clicar no overlay e no botão ×.
 * Sizes: sm (384px) | md (512px, default) | lg (672px) | xl (800px) | full
 */

const sizeMap = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-3xl',
  full: 'max-w-full mx-4',
}

/* ─── Root ─── */
const Modal = Dialog.Root
Modal.displayName = 'Modal'

/* ─── Trigger ─── */
const ModalTrigger = Dialog.Trigger
ModalTrigger.displayName = 'Modal.Trigger'

/* ─── Close ─── */
const ModalClose = Dialog.Close
ModalClose.displayName = 'Modal.Close'

/* ─── Overlay ─── */
const ModalOverlay = React.forwardRef(function ModalOverlay({ className, ...props }, ref) {
  return (
    <Dialog.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50',
        'bg-black/50 backdrop-blur-sm',
        'data-[state=open]:animate-in   data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className
      )}
      {...props}
    />
  )
})

/* ─── Content ─── */
const ModalContent = React.forwardRef(function ModalContent(
  { className, title, description, size = 'md', hideClose = false, children, ...props },
  ref
) {
  // Separa Modal.Footer dos demais filhos para renderiza-lo FORA do body scrollavel,
  // ancorado no fundo do modal (irmao do header e do body).
  // Sem isso, o footer (com botoes de acao) caia dentro do body e ficava "no meio"
  // quando o conteudo era curto, ou rolava junto quando o conteudo era longo.
  let footer = null
  const body = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type?.displayName === 'Modal.Footer') {
      footer = child
    } else {
      body.push(child)
    }
  })

  return (
    <Dialog.Portal>
      <ModalOverlay />
      <Dialog.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50',
          '-translate-x-1/2 -translate-y-1/2',
          'w-full',
          sizeMap[size] ?? sizeMap.md,
          'rounded-[var(--radius-lg)] border border-[var(--color-border)]',
          'bg-[var(--color-bg)] shadow-[var(--shadow-md)]',
          'flex flex-col max-h-[90dvh]',
          'focus:outline-none',
          'data-[state=open]:animate-in   data-[state=open]:fade-in-0   data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-200',
          className
        )}
        {...props}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
            <div className="flex flex-col gap-1">
              {title && (
                <Dialog.Title className="text-base font-semibold text-[var(--color-text)] leading-snug">
                  {title}
                </Dialog.Title>
              )}
              {/* Sempre presente para a11y (Radix exige); oculto visualmente quando sem prop */}
              <Dialog.Description className={cn("text-sm text-[var(--color-text-muted)]", !description && "sr-only")}>
                {description ?? ' '}
              </Dialog.Description>
            </div>

            {!hideClose && (
              <Dialog.Close
                aria-label="Fechar modal"
                className={cn(
                  'shrink-0 rounded-[var(--radius-sm)]',
                  'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  'hover:bg-[var(--color-surface)] transition-colors',
                  'h-7 w-7 flex items-center justify-center text-lg leading-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                ×
              </Dialog.Close>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 flex-1 overflow-y-auto overscroll-contain">
          {body}
        </div>

        {/* Footer (ancorado no fundo, FORA do body scrollavel) */}
        {footer}
      </Dialog.Content>
    </Dialog.Portal>
  )
})

/* ─── Footer ─── */
const ModalFooter = React.forwardRef(function ModalFooter({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-2',
        'border-t border-[var(--color-border)]',
        'bg-[var(--color-bg-subtle)]',
        'px-6 py-4',
        'rounded-b-[var(--radius-lg)]',
        'shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

ModalContent.displayName = 'Modal.Content'
ModalFooter.displayName  = 'Modal.Footer'

// Sub-componentes
Modal.Trigger = ModalTrigger
Modal.Content = ModalContent
Modal.Footer  = ModalFooter
Modal.Close   = ModalClose

export { Modal, ModalTrigger, ModalContent, ModalFooter, ModalClose }
