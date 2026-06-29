'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  UserCog,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { Button } from '@/components/ui/button';
import { InlineCatLoader } from '@/components/ui/CatLoader';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { useAlertModal } from '@/components/ui/useAlertModal';
import {
  adminCreateUser,
  deleteUserAccount,
  fetchUsers,
  updateUserAccount,
} from '@/lib/auth/authApi';
import type { AuthUser, AppRole } from '@/lib/auth/types';
import { useAuth } from '@/lib/auth/AuthProvider';

type RoleFilter = 'ALL' | AppRole;

const USERS_PER_PAGE = 10;

function userInitials(username: string): string {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  const s = username.trim();
  return s.length >= 2 ? s.slice(0, 2).toUpperCase() : s.slice(0, 1).toUpperCase() || '?';
}

function RoleBadge({ role }: { role: AppRole }) {
  const isAdmin = role === 'ADMIN';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isAdmin
          ? 'bg-primary/15 text-primary ring-1 ring-primary/25'
          : 'bg-muted text-muted-foreground ring-1 ring-border'
      }`}
    >
      {isAdmin ? <Shield className="h-3 w-3" /> : null}
      {role}
    </span>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    username: '',
    password: '',
    role: 'USER' as AppRole,
    adminPassword: '',
  });
  const [addShowPassword, setAddShowPassword] = useState(false);
  const [addShowAdminPassword, setAddShowAdminPassword] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    password: '',
    role: 'USER' as AppRole,
    adminPassword: '',
  });
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editShowAdminPassword, setEditShowAdminPassword] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [roleConfirm, setRoleConfirm] = useState<{
    target: AuthUser;
    newRole: AppRole;
  } | null>(null);
  const [roleConfirmPassword, setRoleConfirmPassword] = useState('');
  const [roleConfirmShowPassword, setRoleConfirmShowPassword] = useState(false);
  const [roleConfirmSaving, setRoleConfirmSaving] = useState(false);

  const { toasts, removeToast, success: toastSuccess, error: toastError } = useToast();
  const { showConfirm, alertModal } = useAlertModal();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const result = await fetchUsers();
    if (result.ok) {
      setUsers(result.users);
    } else {
      setUsers([]);
      setFetchError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.Role === 'ADMIN').length;
    return { total: users.length, admins, regular: users.length - admins };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.Role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.Username.toLowerCase().includes(q) ||
        u.Role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const totalFiltered = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / USERS_PER_PAGE));
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = useMemo(
    () => filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE),
    [filteredUsers, startIndex]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function requestRoleChange(target: AuthUser, newRole: AppRole) {
    if (target.Role === newRole) return;
    if (currentUser?.id === target.id && newRole !== 'ADMIN') {
      toastError('You cannot demote your own account.');
      return;
    }
    setRoleConfirm({ target, newRole });
    setRoleConfirmPassword('');
    setRoleConfirmShowPassword(false);
  }

  async function confirmRoleChange(e: React.FormEvent) {
    e.preventDefault();
    if (!roleConfirm) return;
    const adminPassword = roleConfirmPassword.trim();
    if (!adminPassword) {
      toastError('Enter your password to confirm.');
      return;
    }
    const { target, newRole } = roleConfirm;
    setRoleConfirmSaving(true);
    setSavingId(target.id);
    const result = await updateUserAccount(target.id, { Role: newRole, adminPassword });
    if ('error' in result) {
      toastError(result.error);
    } else {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, Role: newRole } : u)));
      if (currentUser?.id === target.id) await refreshUser();
      toastSuccess(`Role updated to ${newRole}`);
      setRoleConfirm(null);
      setRoleConfirmPassword('');
    }
    setRoleConfirmSaving(false);
    setSavingId(null);
  }

  function openEditModal(user: AuthUser) {
    setEditUser(user);
    setEditForm({ username: user.Username, password: '', role: user.Role, adminPassword: '' });
    setEditShowPassword(false);
    setEditShowAdminPassword(false);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const username = addForm.username.trim();
    const password = addForm.password;
    if (!username || !password) {
      toastError('Username and password are required.');
      return;
    }
    if (password.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }
    if (addForm.role === 'ADMIN' && !addForm.adminPassword.trim()) {
      toastError('Enter your password to grant admin role.');
      return;
    }
    setAddSaving(true);
    const result = await adminCreateUser(
      username,
      password,
      addForm.role,
      addForm.role === 'ADMIN' ? addForm.adminPassword : undefined
    );
    if ('error' in result) {
      toastError(result.error);
    } else {
      setUsers((prev) => [...prev, result.user].sort((a, b) => a.id - b.id));
      setAddOpen(false);
      setAddForm({ username: '', password: '', role: 'USER', adminPassword: '' });
      toastSuccess(`User "${result.user.Username}" created`);
    }
    setAddSaving(false);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    const username = editForm.username.trim();
    if (!username) {
      toastError('Username is required.');
      return;
    }
    if (currentUser?.id === editUser.id && editForm.password && editForm.password.length < 6) {
      toastError('New password must be at least 6 characters.');
      return;
    }
    if (
      currentUser?.id === editUser.id &&
      editForm.role !== 'ADMIN' &&
      editUser.Role === 'ADMIN'
    ) {
      toastError('You cannot demote your own account.');
      return;
    }

    const roleChanging = editForm.role !== editUser.Role;
    if (roleChanging && !editForm.adminPassword.trim()) {
      toastError('Enter your password to confirm the role change.');
      return;
    }

    const patch: { Username?: string; Password?: string; Role?: AppRole; adminPassword?: string } = {};
    if (username !== editUser.Username) patch.Username = username;
    const isSelf = currentUser?.id === editUser.id;
    if (isSelf && editForm.password) patch.Password = editForm.password;
    if (roleChanging) {
      patch.Role = editForm.role;
      patch.adminPassword = editForm.adminPassword;
    }
    if (Object.keys(patch).length === 0) {
      setEditUser(null);
      return;
    }

    setEditSaving(true);
    const result = await updateUserAccount(editUser.id, patch);
    if ('error' in result) {
      toastError(result.error);
    } else {
      const next: AuthUser = result.user ?? {
        ...editUser,
        Username: patch.Username ?? editUser.Username,
        Role: patch.Role ?? editUser.Role,
      };
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? next : u)));
      if (currentUser?.id === editUser.id) await refreshUser();
      setEditUser(null);
      toastSuccess('User updated');
    }
    setEditSaving(false);
  }

  function handleDelete(user: AuthUser) {
    if (currentUser?.id === user.id) {
      toastError('You cannot delete your own account.');
      return;
    }
    showConfirm(
      `Delete user "${user.Username}"? This cannot be undone.`,
      async () => {
        setSavingId(user.id);
        const result = await deleteUserAccount(user.id);
        if ('error' in result) {
          toastError(result.error);
        } else {
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
          toastSuccess('User deleted');
        }
        setSavingId(null);
      },
      {
        title: 'Delete user',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        dangerConfirm: true,
      }
    );
  }

  const inputClass =
    'w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <RequireAdmin>
      <SidebarLayout>
        <DashboardHeader />
        <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Administration</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">User Management</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage accounts, roles, and access for Plan Schedule.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadUsers()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Add user
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Total users', value: stats.total, icon: Users, tint: 'text-blue-600 bg-blue-500/10' },
              { label: 'Administrators', value: stats.admins, icon: Shield, tint: 'text-primary bg-primary/10' },
              { label: 'Standard users', value: stats.regular, icon: UserCog, tint: 'text-emerald-600 bg-emerald-500/10' },
            ].map((card) => (
              <div
                key={card.label}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.tint}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm font-medium text-foreground">
                {filteredUsers.length} of {users.length} users
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search username…"
                    className={`${inputClass} w-full pl-9 sm:w-56`}
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  className={`${inputClass} sm:w-36`}
                  aria-label="Filter by role"
                >
                  <option value="ALL">All roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="USER">User</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <InlineCatLoader label="Loading users…" />
              </div>
            ) : fetchError ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-destructive">{fetchError}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadUsers()}>
                  Try again
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                {users.length === 0 ? 'No users found.' : 'No users match your search.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left">
                      <th className="px-6 py-3 font-medium text-muted-foreground">User</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      const busy = savingId === u.id;
                      return (
                        <tr
                          key={u.id}
                          className="border-b border-border last:border-0 transition-colors hover:bg-muted/20"
                        >
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {userInitials(u.Username)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{u.Username}</p>
                                {isSelf ? (
                                  <p className="text-xs text-primary">Signed in as you</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <RoleBadge role={u.Role} />
                              <select
                                value={u.Role}
                                disabled={busy || (isSelf && u.Role === 'ADMIN')}
                                onChange={(e) => requestRoleChange(u, e.target.value as AppRole)}
                                className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
                                aria-label={`Change role for ${u.Username}`}
                              >
                                <option value="USER">USER</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEditModal(u)}
                                disabled={busy}
                                title="Edit user"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(u)}
                                disabled={busy || isSelf}
                                title={isSelf ? 'Cannot delete your account' : 'Delete user'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}–{Math.min(startIndex + USERS_PER_PAGE, totalFiltered)} of{' '}
                    {totalFiltered}
                  </p>
                  {totalPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="min-w-[5.5rem] text-center text-sm text-muted-foreground">
                        Page {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {alertModal}

        {addOpen ? (
          <ModalShell
            title="Add user"
            subtitle="Create a new account for the system."
            onClose={() => !addSaving && setAddOpen(false)}
          >
            <form onSubmit={(e) => void handleAddSubmit(e)} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={addForm.username}
                  onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  className={inputClass}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <input
                    type={addShowPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={addForm.password}
                    onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                    className={`${inputClass} pr-10`}
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setAddShowPassword((v) => !v)}
                    aria-label={addShowPassword ? 'Hide password' : 'Show password'}
                  >
                    {addShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      role: e.target.value as AppRole,
                      adminPassword: e.target.value === 'ADMIN' ? f.adminPassword : '',
                    }))
                  }
                  className={inputClass}
                >
                  <option value="USER">USER — standard access</option>
                  <option value="ADMIN">ADMIN — full access</option>
                </select>
              </div>
              {addForm.role === 'ADMIN' ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Your password <span className="font-normal text-muted-foreground">(confirm admin role)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={addShowAdminPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={addForm.adminPassword}
                      onChange={(e) => setAddForm((f) => ({ ...f, adminPassword: e.target.value }))}
                      className={`${inputClass} pr-10`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setAddShowAdminPassword((v) => !v)}
                      aria-label={addShowAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {addShowAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" disabled={addSaving} onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addSaving}>
                  {addSaving ? 'Creating…' : 'Create user'}
                </Button>
              </div>
            </form>
          </ModalShell>
        ) : null}

        {editUser ? (
          <ModalShell
            title="Edit user"
            subtitle={editUser.Username}
            onClose={() => !editSaving && setEditUser(null)}
          >
            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Username</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  className={inputClass}
                />
              </div>
              {currentUser?.id === editUser.id ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    New password <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={editShowPassword ? 'text' : 'password'}
                      minLength={6}
                      autoComplete="new-password"
                      value={editForm.password}
                      onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                      className={`${inputClass} pr-10`}
                      placeholder="Leave blank to keep current"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditShowPassword((v) => !v)}
                      aria-label={editShowPassword ? 'Hide password' : 'Show password'}
                    >
                      {editShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
                <select
                  value={editForm.role}
                  disabled={currentUser?.id === editUser.id && editUser.Role === 'ADMIN'}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      role: e.target.value as AppRole,
                      adminPassword:
                        e.target.value === editUser.Role ? '' : f.adminPassword,
                    }))
                  }
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                {currentUser?.id === editUser.id ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    You cannot demote your own admin account.
                  </p>
                ) : null}
              </div>
              {editForm.role !== editUser.Role ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Your password <span className="font-normal text-muted-foreground">(confirm role change)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={editShowAdminPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={editForm.adminPassword}
                      onChange={(e) => setEditForm((f) => ({ ...f, adminPassword: e.target.value }))}
                      className={`${inputClass} pr-10`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditShowAdminPassword((v) => !v)}
                      aria-label={editShowAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {editShowAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" disabled={editSaving} onClick={() => setEditUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </ModalShell>
        ) : null}

        {roleConfirm ? (
          <ModalShell
            title="Confirm role change"
            subtitle={`Change "${roleConfirm.target.Username}" from ${roleConfirm.target.Role} to ${roleConfirm.newRole}`}
            onClose={() => !roleConfirmSaving && setRoleConfirm(null)}
          >
            <form onSubmit={(e) => void confirmRoleChange(e)} className="space-y-4 px-6 py-5">
              <p className="text-sm text-muted-foreground">
                Enter your password to confirm this role change.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Your password</label>
                <div className="relative">
                  <input
                    type={roleConfirmShowPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={roleConfirmPassword}
                    onChange={(e) => setRoleConfirmPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder="Enter your password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setRoleConfirmShowPassword((v) => !v)}
                    aria-label={roleConfirmShowPassword ? 'Hide password' : 'Show password'}
                  >
                    {roleConfirmShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={roleConfirmSaving}
                  onClick={() => setRoleConfirm(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={roleConfirmSaving}>
                  {roleConfirmSaving ? 'Confirming…' : 'Confirm change'}
                </Button>
              </div>
            </form>
          </ModalShell>
        ) : null}
      </SidebarLayout>
    </RequireAdmin>
  );
}
