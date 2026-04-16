import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { NewProductPage } from '@/pages/products/NewProductPage'
import { EditProductPage } from '@/pages/products/EditProductPage'
import { InquiriesPage } from '@/pages/inquiries/InquiriesPage'
import { InquiryDetailPage } from '@/pages/inquiries/InquiryDetailPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { PreviewPage } from '@/pages/preview/PreviewPage'
import { LibraryPage } from '@/pages/library/LibraryPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/preview/:productId" element={<PreviewPage />} />

          {/* Protected routes — require auth */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/new" element={<NewProductPage />} />
              <Route path="/products/:id/edit" element={<EditProductPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/inquiries" element={<InquiriesPage />} />
              <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
