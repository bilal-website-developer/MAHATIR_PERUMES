import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, Column } from '../components/common/DataTable';
import { apiClient } from '../lib/api';
import { Users, UserPlus, X, ShieldAlert, Trash2, Clock } from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  branch_id?: string;
  created_at: string;
  last_sign_in_at?: string | null;
  is_recently_active?: boolean;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('sales_staff');
  const [actionError, setActionError] = useState<string | null>(null);
  const [recentlyActiveCount, setRecentlyActiveCount] = useState(0);
  const [userPendingDelete, setUserPendingDelete] = useState<UserProfile | null>(null);
  const { user: currentUser } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient<UserProfile[]>('/api/v1/users');
      if (res.data) {
        setUsers(res.data);
        setRecentlyActiveCount(Number(res.meta?.recently_active_count || 0));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const res = await apiClient<UserProfile>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify({
        email: newEmail,
        full_name: newName,
        password: newPassword,
        role: newRole,
      }),
    });

    if (res.error) {
      setActionError(res.error.message);
      return;
    }

    setShowModal(false);
    setNewEmail('');
    setNewName('');
    setNewPassword('');
    fetchUsers();
  };

  const handleRoleChange = async (userId: string, targetRole: UserRole) => {
    await apiClient(`/api/v1/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: targetRole }),
    });
    fetchUsers();
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    await apiClient(`/api/v1/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !currentStatus }),
    });
    fetchUsers();
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === currentUser?.id) return;
    setUserPendingDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    setActionError(null);
    const res = await apiClient(`/api/v1/users/${userPendingDelete.id}`, { method: 'DELETE' });
    if (res.error) {
      setActionError(res.error.message);
      return;
    }
    setUserPendingDelete(null);
    fetchUsers();
  };

  const roleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Badge variant="gold">Admin (Full Access)</Badge>;
      case 'production_manager':
        return <Badge variant="warning">Production Manager</Badge>;
      case 'inventory_manager':
        return <Badge variant="neutral">Inventory Manager</Badge>;
      case 'sales_staff':
        return <Badge variant="success">Sales Staff (POS)</Badge>;
    }
  };

  const columns: Column<UserProfile>[] = [
    {
      key: 'full_name',
      header: 'Staff Member',
      sortable: true,
      accessor: (user) => (
        <div>
          <div className="font-semibold text-slate-100">{user.full_name}</div>
          <div className="text-xs text-slate-400 font-mono">{user.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      sortable: true,
      accessor: (user) => (
        <div className="flex items-center space-x-2">
          {roleBadge(user.role)}
          <select
            value={user.role}
            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
            className="bg-sidebar border border-slate-700 text-[11px] text-slate-300 rounded px-1.5 py-0.5 focus:border-gold-400 focus:outline-none"
          >
            <option value="admin">Admin</option>
            <option value="production_manager">Production</option>
            <option value="inventory_manager">Inventory</option>
            <option value="sales_staff">Sales Staff</option>
          </select>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      accessor: (user) => (
        <button
          onClick={() => handleToggleStatus(user.id, user.is_active)}
          className="cursor-pointer"
          title="Click to toggle status"
        >
          <Badge variant={user.is_active ? 'success' : 'danger'}>
            {user.is_active ? 'Active' : 'Suspended'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'created_at',
      header: 'Created On',
      sortable: true,
      accessor: (user) => (
        <span className="text-xs text-slate-400">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'last_sign_in_at',
      header: 'Recent Activity',
      sortable: true,
      accessor: (user) => (
        <div className="flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${user.is_recently_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className={user.is_recently_active ? 'text-emerald-300' : 'text-slate-500'}>
            {user.is_recently_active
              ? 'Active recently'
              : user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString()
                : 'Never signed in'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (user) => (
        <button
          type="button"
          onClick={() => handleDeleteUser(user)}
          disabled={user.id === currentUser?.id}
          title={user.id === currentUser?.id ? 'You cannot delete your own account' : 'Delete user'}
          className="p-1.5 text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-gold-400" />
            <span>User Management & Role Permissions</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Admin-only management of system credentials, operational roles, and branch assignments.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Staff Member</span>
        </Button>
      </div>
      <ConfirmDialog
        open={Boolean(userPendingDelete)}
        title="Delete staff account?"
        message={userPendingDelete ? `Delete ${userPendingDelete.full_name}'s account? This removes their login and disables their profile.` : ''}
        confirmLabel="Delete account"
        onConfirm={() => void confirmDeleteUser()}
        onCancel={() => setUserPendingDelete(null)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Total staff accounts</div>
          <div className="text-2xl font-serif font-bold text-slate-100 mt-1">{users.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Recently active</div>
          <div className="text-2xl font-serif font-bold text-emerald-400 mt-1">{recentlyActiveCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Signed in within 15 minutes</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Access management</div>
          <div className="flex items-center gap-2 text-sm text-slate-300 mt-2">
            <Clock className="h-4 w-4 text-gold-400" />
            Last sign-ins from Supabase Auth
          </div>
        </Card>
      </div>

      {/* Permissions Matrix Reference */}
      <Card goldBorder className="p-5 space-y-3">
        <h3 className="font-serif text-sm font-semibold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-gold-400" />
          <span>Role Permission Matrix</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-sidebar p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-gold-300">Admin</span>
            <p className="text-slate-400 text-[11px]">
              Full ERP & POS access, user management, audit trails, and PO approvals.
            </p>
          </div>
          <div className="bg-sidebar p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-amber-300">Production Manager</span>
            <p className="text-slate-400 text-[11px]">
              Formula BOM, compounding batches, bottling runs, and dilution calculator.
            </p>
          </div>
          <div className="bg-sidebar p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-300">Inventory Manager</span>
            <p className="text-slate-400 text-[11px]">
              Raw materials, suppliers, purchase order creation, and stock adjustments.
            </p>
          </div>
          <div className="bg-sidebar p-3 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-emerald-300">Sales Staff</span>
            <p className="text-slate-400 text-[11px]">
              POS counter sales, touch interface, receipts, and customer management.
            </p>
          </div>
        </div>
      </Card>

      {/* Users DataTable */}
      <Card className="space-y-4">
        <DataTable
          title="System Profiles"
          data={users}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search staff by name, email, or role..."
          exportFileName="mahatir-staff-profiles"
        />
      </Card>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-background/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-gold-400/30 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-serif text-lg font-semibold text-slate-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-gold-400" />
                <span>Create Staff Account</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <Input
                label="Full Name"
                placeholder="e.g. Layla Noor"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />

              <Input
                label="Corporate Email"
                type="email"
                placeholder="layla@mahatir.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />

              <Input
                label="Temporary Password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Assigned Operational Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full rounded-md bg-sidebar px-3.5 py-2 text-sm text-slate-100 border border-slate-700/80 focus:border-gold-400 focus:outline-none"
                >
                  <option value="sales_staff">Sales Staff (POS Counter)</option>
                  <option value="inventory_manager">Inventory Manager (Materials & POs)</option>
                  <option value="production_manager">Production Manager (Formulas & Batches)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Create User Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
