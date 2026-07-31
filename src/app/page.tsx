import {
  AuthGate,
} from "@/components/auth/AuthGate";

import {
  BudgetDashboard,
} from "@/components/budget/BudgetDashboard";

import {
  AuthProvider,
} from "@/contexts/AuthContext";

export default function Home() {
  return (
    <AuthProvider>
      <AuthGate>
        <BudgetDashboard />
      </AuthGate>
    </AuthProvider>
  );
}