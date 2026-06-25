'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardHeader from '@/components/ui/Header';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { fetchUsers, updateUserRole } from '@/lib/auth/authApi';
import type { AuthUser, AppRole } from '@/lib/auth/types';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function UserManagementPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const list = await fetchUsers();
    setUsers(list);
    setError(list.length === 0 ? 'ไม่พบข้อมูลหรือไม่มีสิทธิ์' : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function onRoleChange(target: AuthUser, Role: AppRole) {
    if (target.Role === Role) return;
    setSavingId(target.id);
    setError(null);
    const result = await updateUserRole(target.id, Role);
    if ('error' in result) {
      setError(result.error);
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, Role } : u))
      );
      if (currentUser?.id === target.id) {
        await refreshUser();
      }
    }
    setSavingId(null);
  }

  return (
    <RequireAdmin>
      <SidebarLayout>
        <DashboardHeader />
        <div className="p-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">User Management — ผู้ใช้ในระบบ</h2>
            </div>
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {error && (
                  <p className="border-b border-border px-6 py-3 text-sm text-destructive">{error}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="px-6 py-3 font-medium text-muted-foreground">ID</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Username</th>
                        <th className="px-6 py-3 font-medium text-muted-foreground">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="px-6 py-3 text-foreground">{u.id}</td>
                          <td className="px-6 py-3 text-foreground">{u.Username}</td>
                          <td className="px-6 py-3">
                            <select
                              value={u.Role}
                              disabled={savingId === u.id}
                              onChange={(e) =>
                                void onRoleChange(u, e.target.value as AppRole)
                              }
                              className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </SidebarLayout>
    </RequireAdmin>
  );
}
