import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CsvRow {
  name: string
  description?: string
  base_price: number
  currency: string
  sku?: string
  unit_of_measure?: string
}

// Minimal CSV parser — handles quoted fields and commas inside quotes
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  function splitLine(line: string): string[] {
    const fields: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur)
    return fields
  }

  const headers = splitLine(lines[0]).map(h => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }

  return rows
}

function mapRow(raw: Record<string, string>, tenantId: string): CsvRow | string {
  const name = raw['name'] || raw['product name'] || raw['product']
  if (!name) return 'Missing required column "name"'

  const priceRaw = raw['base_price'] || raw['price'] || raw['base price'] || '0'
  const base_price = parseFloat(priceRaw)
  if (isNaN(base_price) || base_price < 0) return `Invalid price "${priceRaw}"`

  return {
    name:            name.slice(0, 255),
    description:     raw['description'] || undefined,
    base_price,
    currency:        (raw['currency'] || 'EUR').toUpperCase().slice(0, 3),
    sku:             raw['sku'] || undefined,
    unit_of_measure: raw['unit_of_measure'] || raw['unit'] || undefined,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  // Auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify caller JWT
  const callerSb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await callerSb.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const adminSb = createClient(supabaseUrl, serviceRoleKey)

  // Resolve tenant
  const { data: profile } = await adminSb
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  if (!profile) return new Response('Profile not found', { status: 404, headers: CORS })

  const tenantId = profile.tenant_id as string

  // Read body — expect JSON { csv: string }
  let body: unknown
  try { body = await req.json() } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }
  const { csv } = body as Record<string, unknown>
  if (typeof csv !== 'string' || !csv.trim()) {
    return new Response(JSON.stringify({ error: 'csv field required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Parse rows
  const rawRows = parseCsv(csv)
  if (rawRows.length === 0) {
    return new Response(JSON.stringify({ error: 'CSV contains no data rows' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  if (rawRows.length > 200) {
    return new Response(JSON.stringify({ error: 'Maximum 200 rows per import' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Map and validate
  const errors: { row: number; message: string }[] = []
  const validRows: (CsvRow & { tenant_id: string })[] = []

  rawRows.forEach((raw, idx) => {
    const result = mapRow(raw, tenantId)
    if (typeof result === 'string') errors.push({ row: idx + 2, message: result })
    else validRows.push({ ...result, tenant_id: tenantId })
  })

  if (errors.length > 0) {
    return new Response(JSON.stringify({ error: 'Validation failed', errors }), {
      status: 422, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check plan product limit
  const { data: tenant } = await adminSb.from('tenants').select('plan').eq('id', tenantId).single()
  if (tenant) {
    const { data: limit } = await adminSb
      .from('plan_limits')
      .select('products_max')
      .eq('plan', tenant.plan)
      .single()

    if (limit && limit.products_max !== -1) {
      const { count: existing } = await adminSb
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_template', false)

      if ((existing ?? 0) + validRows.length > limit.products_max) {
        return new Response(JSON.stringify({
          error: 'plan_limit_exceeded',
          message: `Your plan allows ${limit.products_max} products. You currently have ${existing} and are trying to import ${validRows.length}.`,
        }), { status: 422, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }
  }

  // Insert
  const insertRows = validRows.map(r => ({
    tenant_id:       r.tenant_id,
    name:            r.name,
    description:     r.description ?? null,
    base_price:      r.base_price,
    currency:        r.currency,
    sku:             r.sku ?? null,
    unit_of_measure: r.unit_of_measure ?? null,
    status:          'draft',
  }))

  const { data: inserted, error: insertError } = await adminSb
    .from('products')
    .insert(insertRows)
    .select('id, name')

  if (insertError) {
    console.error('import-products-csv insert error:', insertError.message)
    return new Response(JSON.stringify({ error: 'Insert failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ created: inserted?.length ?? 0, products: inserted }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
