// CRUD for `document_templates` (migration 083). RLS scopes every query to the
// current tenant automatically, so there are no application-level tenant filters.

import { supabase } from '@/lib/supabase'
import type { DocumentTemplate, DocumentTemplateInsert, Json } from '@/types/database'
import type { DocumentTemplateDefinition, OutputKind } from './types'

/** A template with its `definition` typed as the block tree rather than raw Json. */
export interface DocumentTemplateRow extends Omit<DocumentTemplate, 'definition'> {
  definition: DocumentTemplateDefinition
}

function hydrate(row: DocumentTemplate): DocumentTemplateRow {
  return { ...row, definition: row.definition as unknown as DocumentTemplateDefinition }
}

export async function listTemplates(): Promise<DocumentTemplateRow[]> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => hydrate(r as DocumentTemplate))
}

export async function fetchTemplate(id: string): Promise<DocumentTemplateRow> {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return hydrate(data as DocumentTemplate)
}

export async function createTemplate(args: {
  tenant_id:   string
  name:        string
  output_kind: OutputKind
  definition:  DocumentTemplateDefinition
}): Promise<DocumentTemplateRow> {
  const payload: DocumentTemplateInsert = {
    tenant_id:   args.tenant_id,
    name:        args.name,
    output_kind: args.output_kind,
    definition:  args.definition as unknown as Json,
    is_default:  false,
  }
  const { data, error } = await supabase
    .from('document_templates')
    .insert(payload as unknown as never)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return hydrate(data as DocumentTemplate)
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; output_kind?: OutputKind; definition?: DocumentTemplateDefinition },
): Promise<DocumentTemplateRow> {
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined)        payload.name = patch.name
  if (patch.output_kind !== undefined) payload.output_kind = patch.output_kind
  if (patch.definition !== undefined)  payload.definition = patch.definition as unknown as Json
  const { data, error } = await supabase
    .from('document_templates')
    .update(payload as unknown as never)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return hydrate(data as DocumentTemplate)
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('document_templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
