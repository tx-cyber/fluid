"use client";

import { useState } from "react";
import type { AdminRole } from "@/lib/permissions";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/permissions";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

interface AdminUsersTableProps {
  users: AdminUser[];
  currentUserRole: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function RoleBadge({ role }: { role: string }) {
  const classes: Record<string, string> = {
    SUPER_ADMIN: "bg-purple-50 text-purple-700 ring-purple-200",
    ADMIN: "bg-blue-50 text-blue-700 ring-blue-200",
    READ_ONLY: "bg-slate-100 text-slate-600 ring-slate-200",
    BILLING: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  const cls = classes[role] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {ROLE_LABELS[role as AdminRole] ?? role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset bg-slate-100 text-slate-500 ring-slate-200">
      Inactive
    </span>
  );
}

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}

function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("READ_ONLY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "Failed to create user");
      }
      const created: AdminUser = await res.json();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Create Admin User</h2>
          <p className="mt-1 text-sm text-slate-500">Add a new admin account with an assigned role.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                {error}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as AdminRole)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {ADMIN_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminUsersTable({ users: initialUsers, currentUserRole }: AdminUsersTableProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  function showToast(message: string, kind: "success" | "error" = "success") {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  }

  function handleUserCreated(user: AdminUser) {
    setUsers(prev => [user, ...prev]);
    setShowCreateModal(false);
    showToast(`User ${user.email} created.`);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setChangingRole(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, role: newRole } : u)
      );
      showToast("Role updated.");
    } catch {
      showToast("Failed to update role.", "error");
    } finally {
      setChangingRole(null);
    }
  }

  async function handleDeactivate(userId: string, email: string) {
    setDeactivating(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to deactivate user");
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, active: false } : u)
      );
      showToast(`${email} deactivated.`);
    } catch {
      showToast("Failed to deactivate user.", "error");
    } finally {
      setDeactivating(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {users.length} {users.length === 1 ? "user" : "users"}
        </p>
        {isSuperAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Create User
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No admin users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge active={user.active} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={user.role}
                          disabled={!isSuperAdmin || changingRole === user.id}
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {ADMIN_ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        {user.active && isSuperAdmin && (
                          <button
                            onClick={() => handleDeactivate(user.id, user.email)}
                            disabled={deactivating === user.id}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            {deactivating === user.id ? "Deactivating..." : "Deactivate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleUserCreated}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.kind === "error" ? "bg-rose-600" : "bg-slate-900"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
