import dayjs from 'dayjs'
import { Copy, KeyRound, Loader2, MoreVertical, Pencil, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getRoleLabels } from '../../layout/roleLabels'
import { apiRequest, useAuth } from '../../state/auth'
import { KpiCard } from '../../ui'
import { showToast } from '../../ui/toast'

// 2026-09-07 (a peticion explicita del usuario, "solo yo 3647 pueda eliminar usuarios"): mismo
// numero hardcodeado que ya valida el servidor (api/users/[id].js) -- ocultar el boton aqui es
// solo UX, la autorizacion real vive del lado del servidor, nunca solo en el cliente.
const DELETE_USERS_EMPLOYEE_NUMBER = '3647'
import AccessRequestsCard from './AccessRequestsCard'
import AdminToolsCard from './AdminToolsCard'
import CreateUserDialog from './CreateUserDialog'
import EditUserDialog from './EditUserDialog'
import PermissionsManagementCard from './permissions/PermissionsManagementCard'

export default function UsuariosPage() {
  const { t } = useTranslation('usuarios')
  const { user: currentUser } = useAuth()
  const canDeleteUsers = currentUser?.employeeNumber === DELETE_USERS_EMPLOYEE_NUMBER
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [resetChoiceUser, setResetChoiceUser] = useState(null)
  const [manualPassword, setManualPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [focusUserId, setFocusUserId] = useState(null)
  const permissionsCardRef = useRef(null)

  function openPermissionsFor(user) {
    setFocusUserId(user.id)
    permissionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/users')
      setUsers(data.users)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const kpis = useMemo(
    () => ({
      activos: users.filter((u) => u.active).length,
      admins: users.filter((u) => u.role === 'ADMINISTRADOR').length,
      supervisores: users.filter((u) => u.role === 'SUPERVISOR').length,
      lideres: users.filter((u) => u.role === 'LIDER').length,
    }),
    [users],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.employeeNumber?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q),
    )
  }, [users, search])

  async function handleDeactivate() {
    const user = confirmDeactivate
    setConfirmDeactivate(null)
    const data = await apiRequest(`/api/users/${user.id}/deactivate`, { method: 'POST' })
    setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)))
  }

  function closeDeleteConfirm() {
    setConfirmDelete(null)
    setDeleteConfirmText('')
  }

  async function handleDelete() {
    const user = confirmDelete
    const expected = user?.employeeNumber || user?.username
    if (!user || !expected || deleteConfirmText.trim() !== expected) return
    setDeleting(true)
    try {
      await apiRequest(`/api/users/${user.id}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      showToast(t('usuariosPage.deleteSuccess'), 'success')
      closeDeleteConfirm()
    } catch (err) {
      showToast(err.message || t('usuariosPage.deleteError'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  function closeResetChoice() {
    setResetChoiceUser(null)
    setManualPassword('')
  }

  async function handleResetRandom(user) {
    const data = await apiRequest(`/api/users/${user.id}/reset-password`, { method: 'POST' })
    setResetResult({ user, temporaryPassword: data.temporaryPassword })
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, mustChangePassword: true } : u)))
    closeResetChoice()
  }

  async function handleResetManual(user) {
    if (manualPassword.length < 6) {
      showToast(t('usuariosPage.passwordTooShort'), 'error')
      return
    }
    setResetSaving(true)
    try {
      await apiRequest(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        body: { password: manualPassword },
      })
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, mustChangePassword: false } : u)),
      )
      showToast(t('usuariosPage.passwordUpdated'), 'success')
      closeResetChoice()
    } catch (err) {
      showToast(err.message || t('usuariosPage.passwordUpdateError'), 'error')
    } finally {
      setResetSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-4 text-[20px] font-extrabold">{t('usuariosPage.pageTitle')}</p>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard title={t('usuariosPage.kpiActiveUsers')} value={kpis.activos} accent="blue" />
        <KpiCard title={t('usuariosPage.kpiAdmins')} value={kpis.admins} accent="purple" />
        <KpiCard
          title={t('usuariosPage.kpiSupervisors')}
          value={kpis.supervisores}
          accent="green"
        />
        <KpiCard title={t('usuariosPage.kpiLeaders')} value={kpis.lideres} accent="amber" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {/* 2026-09-10, a peticion explicita del usuario: autoComplete="off" (commit anterior)
              NO fue suficiente -- Chrome ignora "off" a proposito en campos que su heuristica
              cree que son de login, y seguia autocompletando con el numero de empleado guardado
              del campo autoComplete="username" del login. autoComplete="new-password" si lo
              respeta de verdad (nunca ofrece un valor guardado ahi), mas un name propio para que
              no lo asocie por nombre con el campo del login. */}
          <Input
            placeholder={t('usuariosPage.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            name="usuarios-filtro-busqueda"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
          />
        </div>
        <div className="hidden flex-1 sm:block" />
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {t('usuariosPage.addUserButton')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="overflow-x-auto rounded-[20px] border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('usuariosPage.columnEmployeeNumber')}</TableHead>
              <TableHead>{t('usuariosPage.columnName')}</TableHead>
              <TableHead>{t('usuariosPage.columnUsername')}</TableHead>
              <TableHead>{t('usuariosPage.columnRole')}</TableHead>
              <TableHead>{t('usuariosPage.columnStatus')}</TableHead>
              <TableHead>{t('usuariosPage.columnLastAccess')}</TableHead>
              <TableHead className="text-right">{t('usuariosPage.columnActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {t('usuariosPage.noMatchingUsers')}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.employeeNumber || '—'}</TableCell>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell>{u.username || '—'}</TableCell>
                <TableCell>{getRoleLabels()[u.role] || u.role}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? 'success' : 'outline'}>
                    {u.active ? t('usuariosPage.statusActive') : t('usuariosPage.statusInactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.lastLoginAt
                    ? dayjs(u.lastLoginAt).format('DD/MM/YYYY HH:mm')
                    : t('usuariosPage.neverLoggedIn')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      title={t('usuariosPage.permissionsButtonTitle')}
                      onClick={() => openPermissionsFor(u)}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={t('usuariosPage.editAction')}
                      onClick={() => setEditUser(u)}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditUser(u)}>
                          {t('usuariosPage.editAction')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditUser(u)}>
                          {t('usuariosPage.changeRoleMenuItem')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!u.active}
                          onClick={() => setConfirmDeactivate(u)}
                        >
                          {t('usuariosPage.deactivateAction')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetChoiceUser(u)}>
                          {t('usuariosPage.resetPasswordMenuItem')}
                        </DropdownMenuItem>
                        {canDeleteUsers && (
                          <DropdownMenuItem
                            disabled={u.id === currentUser?.id}
                            onClick={() => setConfirmDelete(u)}
                            className="text-destructive focus:text-destructive"
                          >
                            {t('usuariosPage.deleteAction')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AccessRequestsCard
        users={users}
        onUserCreated={(user) => setUsers((prev) => [...prev, user])}
        onUserLinked={(user) => setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)))}
      />

      <PermissionsManagementCard
        ref={permissionsCardRef}
        users={users}
        focusUserId={focusUserId}
        onFocusUserHandled={() => setFocusUserId(null)}
      />
      <AdminToolsCard />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(user) => {
          setUsers((prev) => [...prev, user])
          setCreateOpen(false)
        }}
      />

      <EditUserDialog
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={(user) => {
          setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)))
          setEditUser(null)
        }}
      />

      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(next) => !next && setConfirmDeactivate(null)}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('usuariosPage.deactivateDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 text-sm">
            {t('usuariosPage.deactivateConfirmPrefix')} <b>{confirmDeactivate?.name}</b>
            {t('usuariosPage.deactivateConfirmSuffix')}
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDeactivate(null)}>
              {t('usuariosPage.cancelButton')}
            </Button>
            <Button variant="destructive" onClick={handleDeactivate}>
              {t('usuariosPage.deactivateAction')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(next) => !next && closeDeleteConfirm()}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('usuariosPage.deleteDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 text-sm">
            <Alert variant="destructive" className="mb-4">
              {t('usuariosPage.deleteWarning')}
            </Alert>
            <p className="mb-4">
              {t('usuariosPage.deleteConfirmPrefix')} <b>{confirmDelete?.name}</b>.
            </p>
            <p className="mb-2 text-xs font-bold text-muted-foreground">
              {t('usuariosPage.deleteConfirmTypeHint')}{' '}
              <span className="font-mono">
                {confirmDelete?.employeeNumber || confirmDelete?.username}
              </span>
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={t('usuariosPage.deleteConfirmPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
            <Button variant="ghost" onClick={closeDeleteConfirm}>
              {t('usuariosPage.cancelButton')}
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleting ||
                deleteConfirmText.trim() !==
                  (confirmDelete?.employeeNumber || confirmDelete?.username)
              }
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('usuariosPage.deleteButton')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetChoiceUser} onOpenChange={(next) => !next && closeResetChoice()}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {t('usuariosPage.resetPasswordDialogTitle', { name: resetChoiceUser?.name })}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            <p className="mb-4 text-[13.5px] text-muted-foreground">
              {t('usuariosPage.resetPasswordDescription')}
            </p>
            <Button
              variant="outline"
              className="mb-5 w-full font-normal normal-case"
              onClick={() => handleResetRandom(resetChoiceUser)}
            >
              {t('usuariosPage.generateRandomButton')}
            </Button>
            <p className="mb-2 text-xs font-bold text-muted-foreground">
              {t('usuariosPage.manualPasswordLabel')}
            </p>
            <Input
              placeholder={t('usuariosPage.minPasswordLengthHint')}
              value={manualPassword}
              onChange={(e) => setManualPassword(e.target.value)}
            />
            <p className="mt-1 h-4 text-xs text-destructive">
              {manualPassword && manualPassword.length < 6
                ? t('usuariosPage.minPasswordLengthHint')
                : ' '}
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
            <Button variant="ghost" onClick={closeResetChoice}>
              {t('usuariosPage.cancelButton')}
            </Button>
            <Button
              disabled={resetSaving || manualPassword.length < 6}
              onClick={() => handleResetManual(resetChoiceUser)}
            >
              {resetSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('usuariosPage.savePasswordButton')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetResult} onOpenChange={(next) => !next && setResetResult(null)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('usuariosPage.temporaryPasswordDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Alert variant="destructive" className="mb-4">
              {t('usuariosPage.temporaryPasswordWarning', { name: resetResult?.user?.name })}
            </Alert>
            <div className="relative">
              <Input readOnly value={resetResult?.temporaryPassword || ''} className="pr-10" />
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(resetResult?.temporaryPassword || '')}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex justify-end px-6 pb-6 pt-2">
            <Button onClick={() => setResetResult(null)}>{t('usuariosPage.doneButton')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
