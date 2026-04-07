import { useParams } from 'react-router-dom'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Standalone shareable page at /preview/:productId.
// Uses the same widget.js — either from /public (default) or a CDN.
// The #mount div is discovered by the widget's own init() on load.
export function PreviewPage() {
  const { productId } = useParams<{ productId: string }>()

  if (!productId) return null

  const params = new URLSearchParams({
    supabase_url: SUPABASE_URL,
    anon_key:     SUPABASE_ANON_KEY,
    product_id:   productId,
    tenant_id:    '',
  })

  // Redirect to the static preview page which does the actual mounting.
  // This keeps all widget mounting logic in one place (widget-preview.html).
  window.location.replace(`/widget-preview.html?${params}`)
  return null
}
