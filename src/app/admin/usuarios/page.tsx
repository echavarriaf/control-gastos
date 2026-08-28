import {
  AuthGate,
} from "@/components/auth/AuthGate";

import {
  AdminUsersView,
} from "@/components/admin/AdminUsersView";

import {
  AuthProvider,
} from "@/contexts/AuthContext";

export default function AdminUsersPage() {
  return (
    <AuthProvider>
      <AuthGate>
        <AdminUsersView />
      </AuthGate>
    </AuthProvider>
  );
}