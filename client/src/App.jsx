import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useThemeStore } from './stores/auth.js'
import AppShell from './components/AppShell.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import SplitPage from './pages/SplitPage.jsx'
import AccountsPage from './pages/AccountsPage.jsx'
import BudgetsPage from './pages/BudgetsPage.jsx'
import GoalsPage from './pages/GoalsPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', color:'var(--muted)', fontFamily:'var(--sans)' }}>loading cofin…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const init = useAuthStore(s => s.init)
  const apply = useThemeStore(s => s.apply)

  useEffect(() => {
    init()
    apply()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="split" element={<SplitPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}