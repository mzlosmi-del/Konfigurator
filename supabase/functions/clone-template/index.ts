import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { data: profile } = await supabase
    .from('profiles').select('tenant_id, role').eq('id', user.id).single()
  if (!profile) return new Response('Profile not found', { status: 404, headers: CORS })

  const tenantId = profile.tenant_id as string

  // Parse body
  const { template_id } = await req.json() as { template_id: string }
  if (!template_id) {
    return new Response(JSON.stringify({ error: 'template_id required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Load the template product
  const { data: template, error: tErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', template_id)
    .eq('is_template', true)
    .single()

  if (tErr || !template) {
    return new Response(JSON.stringify({ error: 'Template not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Check product plan limit
  const { data: tenant } = await supabase.from('tenants').select('plan').eq('id', tenantId).single()
  const { data: limitRow } = await supabase
    .from('plan_limits').select('products_max').eq('plan', tenant?.plan ?? 'free').single()
  const maxProducts = (limitRow?.products_max as number) ?? 3

  if (maxProducts >= 0) {
    const { count } = await supabase
      .from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    if ((count ?? 0) >= maxProducts) {
      return new Response(JSON.stringify({ error: 'plan_limit_exceeded: upgrade to clone more templates' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  // ── Deep clone ──────────────────────────────────────────────────────────────

  // 1. Clone the product into the caller's tenant
  const { data: newProduct, error: pErr } = await supabase
    .from('products')
    .insert({
      tenant_id:       tenantId,
      name:            template.name,
      description:     template.description,
      base_price:      template.base_price,
      currency:        template.currency,
      status:          'draft',         // always starts as draft
      is_template:     false,
      template_category: null,
    })
    .select().single()

  if (pErr || !newProduct) {
    return new Response(JSON.stringify({ error: 'Failed to create product' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  const newProductId = (newProduct as { id: string }).id

  // 2. Load template's product_characteristics (with characteristic details)
  const { data: prodChars } = await supabase
    .from('product_characteristics')
    .select('*, characteristics(*)')
    .eq('product_id', template_id)
    .order('sort_order')

  // Maps from old IDs to new IDs — used to remap formula JSON
  const charIdMap: Record<string, string> = {}
  const valueIdMap: Record<string, string> = {}

  for (const pc of (prodChars ?? [])) {
    const oldChar = pc.characteristics as { id: string; name: string; display_type: string; sort_order: number }

    // 3. Clone each characteristic
    const { data: newChar } = await supabase
      .from('characteristics')
      .insert({ tenant_id: tenantId, name: oldChar.name, display_type: oldChar.display_type, sort_order: oldChar.sort_order })
      .select().single()

    if (!newChar) continue
    const newCharId = (newChar as { id: string }).id
    charIdMap[oldChar.id] = newCharId

    // 4. Clone characteristic values
    const { data: values } = await supabase
      .from('characteristic_values')
      .select('*')
      .eq('characteristic_id', oldChar.id)
      .order('sort_order')

    for (const val of (values ?? [])) {
      const { data: newVal } = await supabase
        .from('characteristic_values')
        .insert({
          characteristic_id: newCharId,
          tenant_id:         tenantId,
          label:             val.label,
          price_modifier:    val.price_modifier,
          sort_order:        val.sort_order,
        })
        .select().single()

      if (newVal) valueIdMap[val.id] = (newVal as { id: string }).id
    }

    // 5. Link new characteristic to new product
    await supabase.from('product_characteristics').insert({
      product_id:       newProductId,
      characteristic_id: newCharId,
      is_required:      pc.is_required,
      sort_order:       pc.sort_order,
    })
  }

  // 6. Clone characteristic classes — remap characteristic IDs in memberships
  const { data: productClasses } = await supabase
    .from('product_classes')
    .select('class_id, sort_order')
    .eq('product_id', template_id)
    .order('sort_order')

  for (const pc of (productClasses ?? [])) {
    const { data: cls } = await supabase
      .from('characteristic_classes')
      .select('name, sort_order')
      .eq('id', pc.class_id)
      .single()

    if (!cls) continue

    const { data: newClass } = await supabase
      .from('characteristic_classes')
      .insert({ tenant_id: tenantId, name: cls.name, sort_order: cls.sort_order })
      .select().single()

    if (!newClass) continue
    const newClassId = (newClass as { id: string }).id

    const { data: members } = await supabase
      .from('characteristic_class_members')
      .select('characteristic_id, sort_order')
      .eq('class_id', pc.class_id)
      .order('sort_order')

    for (const m of (members ?? [])) {
      const newCharId = charIdMap[m.characteristic_id]
      if (!newCharId) continue
      await supabase.from('characteristic_class_members').insert({
        class_id:          newClassId,
        characteristic_id: newCharId,
        sort_order:        m.sort_order,
      })
    }

    await supabase.from('product_classes').insert({
      product_id: newProductId,
      class_id:   newClassId,
      sort_order: pc.sort_order,
    })
  }

  // 8. Clone formulas — remap char_id and value_id references in the AST
  const { data: formulas } = await supabase
    .from('pricing_formulas')
    .select('*')
    .eq('product_id', template_id)
    .order('sort_order')

  for (const formula of (formulas ?? [])) {
    const remapped = remapFormulaIds(formula.formula, charIdMap, valueIdMap)
    await supabase.from('pricing_formulas').insert({
      tenant_id:  tenantId,
      product_id: newProductId,
      name:       formula.name,
      formula:    remapped,
      is_active:  formula.is_active,
      sort_order: formula.sort_order,
    })
  }

  // 9. Clone configuration rules — remap IDs
  const { data: rules } = await supabase
    .from('configuration_rules')
    .select('*')
    .eq('product_id', template_id)

  for (const rule of (rules ?? [])) {
    await supabase.from('configuration_rules').insert({
      tenant_id:  tenantId,
      product_id: newProductId,
      rule_type:  rule.rule_type,
      condition:  remapObject(rule.condition as Record<string, string>, charIdMap, valueIdMap),
      effect:     remapObject(rule.effect    as Record<string, string>, charIdMap, valueIdMap),
      is_active:  rule.is_active,
    })
  }

  // Note: visualization_assets are intentionally NOT copied from template —
  // the new product starts without images (user adds their own via admin).

  // 10. Clone product texts
  const { data: texts } = await supabase
    .from('product_texts')
    .select('label, content, text_type, language, sort_order')
    .eq('product_id', template_id)
    .order('sort_order')

  for (const txt of (texts ?? [])) {
    await supabase.from('product_texts').insert({
      tenant_id:  tenantId,
      product_id: newProductId,
      label:      txt.label,
      content:    txt.content,
      text_type:  txt.text_type,
      language:   txt.language,
      sort_order: txt.sort_order,
    })
  }

  return new Response(JSON.stringify({ product_id: newProductId }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function remapFormulaIds(
  node: unknown,
  charMap: Record<string, string>,
  valMap:  Record<string, string>,
): unknown {
  if (typeof node !== 'object' || node === null) return node
  const n = node as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(n)) {
    if (k === 'char_id' && typeof v === 'string') {
      result[k] = charMap[v] ?? v
    } else if (k === 'value_id' && typeof v === 'string') {
      result[k] = valMap[v] ?? v
    } else if (typeof v === 'object') {
      result[k] = remapFormulaIds(v, charMap, valMap)
    } else {
      result[k] = v
    }
  }
  return result
}

function remapObject(
  obj: Record<string, string>,
  charMap: Record<string, string>,
  valMap:  Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'characteristic_id') result[k] = charMap[v] ?? v
    else if (k === 'value_id')     result[k] = valMap[v]  ?? v
    else                           result[k] = v
  }
  return result
}
