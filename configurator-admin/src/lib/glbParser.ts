// GLB binary format: 12-byte header (magic, version, length), then chunks.
// Chunk 0: JSON (GLTF spec) — offset 12: chunkLength(4), chunkType(4), chunkData

export async function parseGlbMeshNames(source: File | string): Promise<string[]> {
  let buffer: ArrayBuffer
  if (typeof source === 'string') {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Failed to fetch GLB: ${res.status}`)
    buffer = await res.arrayBuffer()
  } else {
    buffer = await source.arrayBuffer()
  }

  const view = new DataView(buffer)

  // Verify GLB magic: 0x46546C67 ('glTF')
  const magic = view.getUint32(0, true)
  if (magic !== 0x46546C67) throw new Error('Not a valid GLB file')

  const jsonChunkLength = view.getUint32(12, true)
  // chunk type at offset 16 should be 0x4E4F534A ('JSON')
  const jsonChunkType = view.getUint32(16, true)
  if (jsonChunkType !== 0x4E4F534A) throw new Error('GLB JSON chunk not found')

  const jsonBytes = new Uint8Array(buffer, 20, jsonChunkLength)
  const gltf = JSON.parse(new TextDecoder().decode(jsonBytes))

  const names = new Set<string>()

  // Collect names from nodes that reference a mesh
  for (const node of (gltf.nodes ?? [])) {
    if (node.name && node.mesh !== undefined) names.add(node.name)
  }

  // Also collect mesh names directly (in case nodes are unnamed but meshes are named)
  for (const mesh of (gltf.meshes ?? [])) {
    if (mesh.name) names.add(mesh.name)
  }

  return [...names]
}

// For GLTF (JSON) files — just fetch and parse
export async function parseGltfMeshNames(source: File | string): Promise<string[]> {
  let json: Record<string, unknown>
  if (typeof source === 'string') {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Failed to fetch GLTF: ${res.status}`)
    json = await res.json()
  } else {
    json = JSON.parse(await source.text())
  }

  const names = new Set<string>()
  for (const node of ((json.nodes as { name?: string; mesh?: number }[]) ?? [])) {
    if (node.name && node.mesh !== undefined) names.add(node.name)
  }
  for (const mesh of ((json.meshes as { name?: string }[]) ?? [])) {
    if (mesh.name) names.add(mesh.name)
  }
  return [...names]
}

export async function parseMeshNames(source: File | string): Promise<string[]> {
  const name = typeof source === 'string' ? source : source.name
  const isGltf = name.toLowerCase().endsWith('.gltf')
  return isGltf ? parseGltfMeshNames(source) : parseGlbMeshNames(source)
}
