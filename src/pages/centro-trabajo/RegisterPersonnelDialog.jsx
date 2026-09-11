import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import RegisterPersonnelForm from './RegisterPersonnelForm'

/**
 * Registro de personal por SUPERVISOR (check-in diario), en dialogo
 * modal — misma logica que la pagina "Registro de personal"
 * (RegisterPersonnelForm centraliza todo, ver ese archivo).
 */
export default function RegisterPersonnelDialog({ open, onClose, fixedAreaId = null, onDone }) {
  const { t } = useTranslation('centroTrabajo')
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{t('registerPersonnelDialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          {open && (
            <RegisterPersonnelForm fixedAreaId={fixedAreaId} onCancel={onClose} onDone={onDone} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
