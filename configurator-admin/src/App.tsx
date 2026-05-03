import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/components/auth/AuthContext'
import { getLang, type Lang } from '@/i18n'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { InvitePage } from '@/pages/auth/InvitePage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProductsPage } from '@/pages/products/ProductsPage'
import { NewProductPage } from '@/pages/products/NewProductPage'
import { EditProductPage } from '@/pages/products/EditProductPage'
import { ProductsImportPage } from '@/pages/products/ProductsImportPage'
import { InquiriesPage } from '@/pages/inquiries/InquiriesPage'
import { InquiryDetailPage } from '@/pages/inquiries/InquiryDetailPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { PreviewPage } from '@/pages/preview/PreviewPage'
import { LibraryPage } from '@/pages/library/LibraryPage'
import { QuotationsPage } from '@/pages/quotations/QuotationsPage'
import { QuotationsReportPage } from '@/pages/quotations/QuotationsReportPage'
import { QuotationFormPage } from '@/pages/quotations/QuotationFormPage'
import { QuotationDetailPage } from '@/pages/quotations/QuotationDetailPage'
import { PricingCenterPage } from '@/pages/pricing/PricingCenterPage'
import { TextsPage } from '@/pages/texts/TextsPage'
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage'
import { EmbedDocsPage } from '@/pages/embed-docs/EmbedDocsPage'
import { PublicPreviewPage } from '@/pages/public/PublicPreviewPage'

export function App() {
  const [lang, setLangState] = useState<Lang>(getLang())

  useEffect(() => {
    const handler = (e: Event) => setLangState((e as CustomEvent<Lang>).detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  return (
    <div key={lang}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/preview/:productId" element={<PreviewPage />} />
          <Route path="/p/:slug" element={<PublicPreviewPage />} />

          {/* Protected routes — require auth */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route element={<ProtectedRoute functionality="products" />}>
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/new" element={<NewProductPage />} />
                <Route path="/products/import" element={<ProductsImportPage />} />
                <Route path="/products/:id/edit" element={<EditProductPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="pricing" />}>
                <Route path="/pricing" element={<PricingCenterPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="library" />}>
                <Route path="/library" element={<LibraryPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="inquiries" />}>
                <Route path="/inquiries" element={<InquiriesPage />} />
                <Route path="/inquiries/:id" element={<InquiryDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="quotations" />}>
                <Route path="/quotations" element={<QuotationsPage />} />
                <Route path="/quotations/report" element={<QuotationsReportPage />} />
                <Route path="/quotations/new" element={<QuotationFormPage />} />
                <Route path="/quotations/:id" element={<QuotationDetailPage />} />
                <Route path="/quotations/:id/edit" element={<QuotationFormPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="texts" />}>
                <Route path="/texts" element={<TextsPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="analytics" />}>
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="embed" />}>
                <Route path="/embed-docs" element={<EmbedDocsPage />} />
              </Route>

              <Route element={<ProtectedRoute functionality="settings" />}>
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </div>
  )
}
