// Edge function: import-catalog-xlsx
//
// Receives a parsed catalog payload from the admin panel and calls the
// `import_catalog` PL/pgSQL function (migration 084) to insert everything
// atomically. We use the caller's JWT (not the service role) so RLS still
// enforces tenant isolation; the SQL function additionally checks
// auth_can('library','edit') and auth_can('products','edit').

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface PgError {
  message?: string
  details?: string
  code?:    string
  hint?:    string
}

/** Parse the structured DETAIL JSON our PL/pgSQL function raises. Falls back
 *  to a plain message envelope if details aren't valid JSON. */
function parsePgErrorDetails(err: PgError): { sheet?: string; row?: number; column?: string; key?: string; code?: string; message: string } {
  const raw = err.details
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      return { ...parsed, message: err.message ?? 'Import failed' }
    } catch {
      /* fall through */
    }
  }
  return { message: err.message ?? 'Import failed', code: err.code }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: CORS })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

    // Caller-scoped client so RLS + auth_can() see the right JWT claims.
    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

    let body: unknown
    try { body = await req.json() } catch {
      return jsonResponse(400, { error: 'bad_request', message: 'Body must be JSON' })
    }
    const payload = (body as { payload?: unknown }).payload
    if (!payload || typeof payload !== 'object') {
      return jsonResponse(400, { error: 'bad_request', message: 'payload field required' })
    }

    // Sanity-cap the size so a runaway upload doesn't tie up the DB.
    const cast = payload as { classes?: unknown[]; characteristics?: unknown[]; values?: unknown[]; products?: unknown[]; texts?: unknown[] }
    const total =
      (cast.classes?.length ?? 0) +
      (cast.characteristics?.length ?? 0) +
      (cast.values?.length ?? 0) +
      (cast.products?.length ?? 0) +
      (cast.texts?.length ?? 0)
    if (total > 5000) {
      return jsonResponse(413, { error: 'payload_too_large', message: 'Maximum 5,000 rows across all sheets' })
    }

    const { data, error } = await sb.rpc('import_catalog', { payload })

    if (error) {
      const detail = parsePgErrorDetails(error as PgError)

      // Plan-limit errors raised by the existing check_product_limit trigger.
      if (detail.code === 'plan_limit_exceeded' || (detail as { plan?: string }).plan) {
        return jsonResponse(422, {
          error:   'plan_limit_exceeded',
          message: detail.message,
          detail,
        })
      }

      // Permission denied from the auth_can() gate.
      if (detail.code === 'forbidden') {
        return jsonResponse(403, { error: 'forbidden', message: 'You need edit access on both Library and Products to import.' })
      }

      // Structured row-level conflict / unknown-key error.
      if (detail.sheet || detail.key) {
        return jsonResponse(422, {
          error:  'validation_failed',
          errors: [{
            sheet:  detail.sheet ?? null,
            row:    detail.row   ?? null,
            column: detail.column ?? null,
            message: detail.message,
          }],
        })
      }

      console.error('import-catalog-xlsx error:', JSON.stringify({
        message: error.message, details: error.details, code: error.code, hint: error.hint,
      }))
      return jsonResponse(500, { error: 'import_failed', message: error.message })
    }

    return jsonResponse(200, { result: data })
  } catch (err) {
    console.error(JSON.stringify({
      severity: 'error',
      function: 'import-catalog-xlsx',
      error:    err instanceof Error ? err.message : String(err),
      stack:    err instanceof Error ? err.stack   : undefined,
    }))
    return jsonResponse(500, { error: 'internal_error' })
  }
})
