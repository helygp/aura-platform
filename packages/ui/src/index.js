// Aura UI — barrel export
// ─── Sprint 1 Tarefa 2 ───
export { Button, buttonVariants }                from './components/Button.jsx'
export { Input }                                 from './components/Input.jsx'
export { PasswordInput }                         from './components/PasswordInput.jsx'
export { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from './components/Card.jsx'
export { Badge, badgeVariants }                  from './components/Badge.jsx'

// ─── Sprint 1 Tarefa 3 ───
export { Skeleton }                              from './components/Skeleton.jsx'
export { ToastProvider, useToast }               from './components/Toast.jsx'
export { Modal, ModalTrigger, ModalContent, ModalFooter, ModalClose } from './components/Modal.jsx'
export {
  Table,
  TableRoot,
  TableHead,
  TableBody,
  TableRow,
  TableTh,
  TableTd,
}                                                from './components/Table.jsx'

// Utilitários
export { cn } from './cn.js'

// Tokens CSS — importar no entry-point do app:
// import '@aura/ui/styles/tokens.css'
