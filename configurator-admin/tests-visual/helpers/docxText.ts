import JSZip from 'jszip'

/** Extract the human-readable text from a DOCX. Strips XML tags from
 *  `word/document.xml`, replacing them with single spaces, and decodes the
 *  common XML entities. Good enough for content-only assertions where we
 *  search for tenant / product / heading strings; not suitable for any kind
 *  of structural check. */
export async function extractDocxText(b64: string): Promise<string> {
  const buffer = Buffer.from(b64, 'base64')
  const zip    = await JSZip.loadAsync(buffer)
  const file   = zip.file('word/document.xml')
  if (!file) throw new Error('DOCX missing word/document.xml')
  const xml = await file.async('string')
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g,    ' ')
    .trim()
}
