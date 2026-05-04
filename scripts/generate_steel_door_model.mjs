#!/usr/bin/env node
/**
 * Steel door 3D model generator — no external dependencies except node:zlib.
 *
 * Produces steel_door.glb in the current working directory (or the path
 * given as the first CLI argument).
 *
 * Mesh tree (matches mesh_rules in migration 054/055/056):
 *
 *   Door_Root              scene root (no transform)
 *   ├── Door_Scalable      dimension rules scale this for width/height
 *   │   ├── Door_Frame         surrounding steel frame (always visible)
 *   │   ├── Door_Leaf_Black    door panel — RAL 9005 (visible when colour = black)
 *   │   ├── Door_Leaf_Anthracite door panel — RAL 7016 (visible when colour = anthracite)
 *   │   ├── Door_Leaf_White    door panel — RAL 9010 (visible when colour = white)
 *   │   ├── Glass_Panel        upper glazed insert (always visible, semi-transparent)
 *   │   └── Glass_Frame        thin metal surround for glass (always visible)
 *   ├── Lock_Cylinder      standard cylinder lock + handle (lock = cylinder)
 *   ├── Lock_Multipoint    multi-point locking bar (lock = multipoint)
 *   ├── Lock_Smart         electronic keypad panel (lock = smart)
 *   ├── Hinge_Standard_A/B/C  butt hinges; A has a translate rule for height
 *   ├── Hinge_Concealed_A/B/C flush-mount concealed hinges; A has translate rule
 *   ├── Hinge_Heavy_A/B/C    heavy-duty reinforced hinges; A has translate rule
 *   └── Floor_Plane        neutral ground plane for contact shadow / spatial grounding
 *
 * Usage:
 *   node scripts/generate_steel_door_model.mjs [output.glb]
 *
 * After generation upload to Supabase Storage and update the url in the
 * migration or visualization asset record.
 */

import { writeFileSync } from 'node:fs'
import { resolve }       from 'node:path'
import { deflateRawSync } from 'node:zlib'

const OUTPUT = resolve(process.argv[2] ?? 'steel_door.glb')

// ── PNG helpers ────────────────────────────────────────────────────────────

const _CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  _CRC_TABLE[n] = c
}
function _crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = _CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}
function _pngChunk(type, data) {
  const typeB = Buffer.from(type, 'ascii')
  const lenB  = Buffer.alloc(4); lenB.writeUInt32BE(data.length)
  const crcB  = Buffer.alloc(4); crcB.writeUInt32BE(_crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([lenB, typeB, data, crcB])
}
/**
 * Generate a minimal solid-colour PNG (RGB, 8-bit) using zlib deflate.
 */
function makeSolidPNG(width, height, r, g, b) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width,  0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit depth, RGB colour type

  const rowLen = width * 3
  const raw = Buffer.alloc((1 + rowLen) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowLen)] = 0  // filter byte: None
    for (let x = 0; x < width; x++) {
      const off = y * (1 + rowLen) + 1 + x * 3
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b
    }
  }

  return Buffer.concat([
    sig,
    _pngChunk('IHDR', ihdr),
    _pngChunk('IDAT', deflateRawSync(raw)),
    _pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── GLB builder ────────────────────────────────────────────────────────────

class GlbBuilder {
  constructor() {
    this._chunks   = []
    this._bvOffset = 0
    this.bufferViews = []
    this.accessors   = []
    this.meshes      = []
    this.materials   = []
    this.nodes       = []
    this.scenes      = [{ nodes: [0] }]
    this.textures    = []
    this.images      = []
    this.samplers    = []
  }

  // Append a typed-array / Buffer to the binary chunk; return bufferView index.
  _addRaw(data, target) {
    const buf    = Buffer.isBuffer(data) ? data
      : Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    const padLen = (4 - (buf.byteLength % 4)) % 4
    const padded = padLen > 0 ? Buffer.concat([buf, Buffer.alloc(padLen, 0)]) : buf
    this._chunks.push(padded)
    this.bufferViews.push({
      buffer: 0, byteOffset: this._bvOffset, byteLength: buf.byteLength,
      ...(target != null ? { target } : {}),
    })
    this._bvOffset += padded.byteLength
    return this.bufferViews.length - 1
  }

  _addPositions(f32) {
    const bv = this._addRaw(f32, 34962)
    let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity
    for (let i = 0; i < f32.length; i += 3) {
      if (f32[i]   < x0) x0=f32[i];   if (f32[i]   > x1) x1=f32[i]
      if (f32[i+1] < y0) y0=f32[i+1]; if (f32[i+1] > y1) y1=f32[i+1]
      if (f32[i+2] < z0) z0=f32[i+2]; if (f32[i+2] > z1) z1=f32[i+2]
    }
    this.accessors.push({ bufferView: bv, componentType: 5126, count: f32.length/3,
      type: 'VEC3', min: [x0,y0,z0], max: [x1,y1,z1] })
    return this.accessors.length - 1
  }

  _addNormals(f32) {
    const bv = this._addRaw(f32, 34962)
    this.accessors.push({ bufferView: bv, componentType: 5126, count: f32.length/3, type: 'VEC3' })
    return this.accessors.length - 1
  }

  _addUVs(f32) {
    const bv = this._addRaw(f32, 34962)
    this.accessors.push({ bufferView: bv, componentType: 5126, count: f32.length/2, type: 'VEC2' })
    return this.accessors.length - 1
  }

  _addIndices(u16) {
    const bv = this._addRaw(u16, 34963)
    this.accessors.push({ bufferView: bv, componentType: 5123, count: u16.length, type: 'SCALAR' })
    return this.accessors.length - 1
  }

  // uvs is optional Float32Array of VEC2 data
  addMesh(name, positions, normals, uvs, indices, materialIdx) {
    const posAcc  = this._addPositions(positions)
    const normAcc = this._addNormals(normals)
    const uvAcc   = uvs ? this._addUVs(uvs) : null
    const idxAcc  = this._addIndices(indices)
    const attrs = { POSITION: posAcc, NORMAL: normAcc }
    if (uvAcc !== null) attrs.TEXCOORD_0 = uvAcc
    this.meshes.push({
      name,
      primitives: [{ attributes: attrs, indices: idxAcc, material: materialIdx }],
    })
    return this.meshes.length - 1
  }

  addNode(name, meshIdx, children) {
    this.nodes.push({
      name,
      ...(meshIdx !== undefined && meshIdx !== null ? { mesh: meshIdx } : {}),
      ...(children?.length ? { children } : {}),
    })
    return this.nodes.length - 1
  }

  // PBR metallic-roughness material.
  // normalTexIdx: optional index into this.textures for the normal map.
  addMaterial(name, r, g, b, a, metallic, roughness, alphaMode, normalTexIdx) {
    this.materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [r, g, b, a ?? 1],
        metallicFactor: metallic,
        roughnessFactor: roughness,
      },
      ...(alphaMode && alphaMode !== 'OPAQUE' ? { alphaMode } : {}),
      doubleSided: (alphaMode === 'BLEND'),
      ...(normalTexIdx !== undefined
        ? { normalTexture: { index: normalTexIdx, scale: 1.0 } }
        : {}),
    })
    return this.materials.length - 1
  }

  // Embed an image buffer (e.g. PNG) and register it as a GLTF texture.
  // Returns the texture index.
  addTexture(pngBuf, mimeType = 'image/png') {
    this.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 })
    const samplerIdx = this.samplers.length - 1
    const bv = this._addRaw(pngBuf, undefined)
    this.images.push({ bufferView: bv, mimeType })
    const imgIdx = this.images.length - 1
    this.textures.push({ source: imgIdx, sampler: samplerIdx })
    return this.textures.length - 1
  }

  build() {
    const bin = Buffer.concat(this._chunks)

    const json = JSON.stringify({
      asset:       { version: '2.0', generator: 'Konfigurator steel-door generator v2.0' },
      scene:       0,
      scenes:      this.scenes,
      nodes:       this.nodes,
      meshes:      this.meshes,
      materials:   this.materials,
      accessors:   this.accessors,
      bufferViews: this.bufferViews,
      buffers:     [{ byteLength: bin.byteLength }],
      ...(this.textures.length ? { textures: this.textures } : {}),
      ...(this.images.length   ? { images:   this.images   } : {}),
      ...(this.samplers.length ? { samplers: this.samplers } : {}),
    })

    const jsonBuf = Buffer.from(json, 'utf8')
    const jsonPad = (4 - (jsonBuf.byteLength % 4)) % 4
    const jsonOut = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)])

    const binPad = (4 - (bin.byteLength % 4)) % 4
    const binOut = Buffer.concat([bin, Buffer.alloc(binPad, 0)])

    const totalLen = 12 + 8 + jsonOut.byteLength + 8 + binOut.byteLength
    const hdr = Buffer.alloc(12)
    hdr.writeUInt32LE(0x46546C67, 0)
    hdr.writeUInt32LE(2, 4)
    hdr.writeUInt32LE(totalLen, 8)

    const jc = Buffer.alloc(8)
    jc.writeUInt32LE(jsonOut.byteLength, 0)
    jc.writeUInt32LE(0x4E4F534A, 4)

    const bc = Buffer.alloc(8)
    bc.writeUInt32LE(binOut.byteLength, 0)
    bc.writeUInt32LE(0x004E4942, 4)

    return Buffer.concat([hdr, jc, jsonOut, bc, binOut])
  }
}

// ── Geometry helpers ───────────────────────────────────────────────────────

// Box centred at (cx,cy,cz) with half-extents (hx,hy,hz).
// Returns { positions, normals, uvs, indices }
function box(cx, cy, cz, hx, hy, hz) {
  const x0=cx-hx, x1=cx+hx, y0=cy-hy, y1=cy+hy, z0=cz-hz, z1=cz+hz
  const p = [
    // +Z front
    x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1,
    // -Z back
    x1,y0,z0, x0,y0,z0, x0,y1,z0, x1,y1,z0,
    // -X left
    x0,y0,z0, x0,y0,z1, x0,y1,z1, x0,y1,z0,
    // +X right
    x1,y0,z1, x1,y0,z0, x1,y1,z0, x1,y1,z1,
    // +Y top
    x0,y1,z1, x1,y1,z1, x1,y1,z0, x0,y1,z0,
    // -Y bottom
    x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1,
  ]
  const n = [
    0,0,1,  0,0,1,  0,0,1,  0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    1,0,0,  1,0,0,  1,0,0,  1,0,0,
    0,1,0,  0,1,0,  0,1,0,  0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
  ]
  // Per-face [0,1]×[0,1] UV mapping (6 faces × 4 verts × 2 components)
  const uv = [
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
  ]
  const idx = []
  for (let f = 0; f < 6; f++) {
    const b = f * 4
    idx.push(b,b+1,b+2, b,b+2,b+3)
  }
  return {
    positions: new Float32Array(p),
    normals:   new Float32Array(n),
    uvs:       new Float32Array(uv),
    indices:   new Uint16Array(idx),
  }
}

// Merge an array of box geometries into one mesh geometry.
function merge(boxes) {
  let vCount = 0
  const ps=[], ns=[], uvs=[], is=[]
  for (const g of boxes) {
    for (const v of g.positions) ps.push(v)
    for (const v of g.normals)   ns.push(v)
    for (const v of g.uvs)       uvs.push(v)
    for (const v of g.indices)   is.push(v + vCount)
    vCount += g.positions.length / 3
  }
  return {
    positions: new Float32Array(ps),
    normals:   new Float32Array(ns),
    uvs:       new Float32Array(uvs),
    indices:   new Uint16Array(is),
  }
}

// ── Door geometry constants (all units: metres) ────────────────────────────
//
// Reference door: 900 mm wide × 2100 mm tall × 80 mm deep
// Coordinate origin: bottom-centre of door opening, Z=0 = front face plane
//
// Layout (X axis): hinge side = –X, handle side = +X

const DW  = 0.900  // door leaf width
const DH  = 2.100  // door leaf height
const DD  = 0.080  // door leaf depth (thickness)
const FP  = 0.060  // frame profile width (how far frame extends inward)
const FD  = 0.150  // frame depth (front-to-back)
const GW  = 0.620  // glass panel width (inset)
const GH  = 0.680  // glass panel height (inset, upper portion)
const GY  = DH - GH - 0.120  // glass bottom Y (leaves solid panel below)
const GP  = 0.012  // glass panel depth/thickness
const GFP = 0.018  // glass frame profile width

// ── Embed a flat normal map so door panels support texture-rule normal maps ─
// A 4×4 (128,128,255) PNG = flat normal in tangent space.  No visual change
// over no-normal-map, but it establishes the normalTexture slot so a real
// normal map can be swapped in at runtime via a MeshTextureRule.

const b = new GlbBuilder()
const flatNormalPNG = makeSolidPNG(4, 4, 128, 128, 255)
const NORMAL_MAP_TEX = b.addTexture(flatNormalPNG)

// ── Materials ──────────────────────────────────────────────────────────────

const MAT_FRAME  = b.addMaterial('Steel_Frame',      0.290, 0.310, 0.325, 1, 0.85, 0.30)
const MAT_BLACK  = b.addMaterial('Steel_Black',      0.028, 0.028, 0.030, 1, 0.80, 0.32, undefined, NORMAL_MAP_TEX)
const MAT_ANTHR  = b.addMaterial('Steel_Anthracite', 0.168, 0.180, 0.196, 1, 0.80, 0.32, undefined, NORMAL_MAP_TEX)
const MAT_WHITE  = b.addMaterial('Steel_White',      0.964, 0.976, 0.984, 1, 0.70, 0.42, undefined, NORMAL_MAP_TEX)
const MAT_GLASS  = b.addMaterial('Glass_Clear',      0.680, 0.800, 0.920, 0.35, 0.0, 0.05, 'BLEND')
const MAT_GFRAME = b.addMaterial('Steel_GlassFrame', 0.420, 0.435, 0.450, 1, 0.82, 0.28)
const MAT_CHROME = b.addMaterial('Chrome',           0.860, 0.880, 0.900, 1, 1.00, 0.08)
const MAT_ELEC   = b.addMaterial('Electronics',      0.080, 0.090, 0.100, 1, 0.20, 0.75)
const MAT_FLOOR  = b.addMaterial('Concrete_Floor',   0.620, 0.600, 0.580, 1, 0.00, 0.90)

// ── Mesh definitions ────────────────────────────────────────────────────────

// Door_Frame: 4 profiles forming the frame surround
const frameGeom = merge([
  box(-DW/2 - FP/2,  DH/2,    0, FP/2,    DH/2+FP, FD/2),  // left stile
  box( DW/2 + FP/2,  DH/2,    0, FP/2,    DH/2+FP, FD/2),  // right stile
  box(0,     DH+FP/2, 0, DW/2+FP, FP/2,   FD/2),            // top rail
  box(0,     -FP/2,   0, DW/2+FP, FP/2,   FD/2),            // threshold sill
])
const mDoorFrame = b.addMesh('Door_Frame', ...Object.values(frameGeom), MAT_FRAME)

// Door leaf — shared geometry, 3 colour materials
const leafGeom = box(0, DH/2, -DD*0.1, DW/2, DH/2 - 0.006, DD/2)
const mLeafBlack = b.addMesh('Door_Leaf_Black',      ...Object.values(leafGeom), MAT_BLACK)
const mLeafAnthr = b.addMesh('Door_Leaf_Anthracite', ...Object.values(leafGeom), MAT_ANTHR)
const mLeafWhite = b.addMesh('Door_Leaf_White',      ...Object.values(leafGeom), MAT_WHITE)

// Glass_Panel
const glassGeom = box(0, GY + GH/2, DD/2 - GP/2 + 0.001, GW/2, GH/2, GP/2)
const mGlass = b.addMesh('Glass_Panel', ...Object.values(glassGeom), MAT_GLASS)

// Glass_Frame
const gfGeom = merge([
  box(0,               GY + GH + GFP/2, DD/2-GP*0.6, GW/2+GFP, GFP/2, GP*0.8),
  box(0,               GY - GFP/2,      DD/2-GP*0.6, GW/2+GFP, GFP/2, GP*0.8),
  box(-GW/2 - GFP/2,   GY + GH/2,       DD/2-GP*0.6, GFP/2, GH/2,    GP*0.8),
  box( GW/2 + GFP/2,   GY + GH/2,       DD/2-GP*0.6, GFP/2, GH/2,    GP*0.8),
])
const mGlassFrame = b.addMesh('Glass_Frame', ...Object.values(gfGeom), MAT_GFRAME)

// ── Lock variants (positioned at handle side, ~1050 mm from floor) ─────────
const LX = DW/2 - 0.028
const LY = 1.050
const LZ = DD/2

const lockCylGeom = merge([
  box(LX,         LY,          LZ+0.010, 0.018, 0.065, 0.006),
  box(LX,         LY+0.030,    LZ+0.022, 0.012, 0.012, 0.016),
  box(LX-0.060,   LY,          LZ+0.028, 0.055, 0.008, 0.008),
  box(LX-0.118,   LY-0.016,    LZ+0.028, 0.006, 0.020, 0.008),
])
const mLockCyl = b.addMesh('Lock_Cylinder', ...Object.values(lockCylGeom), MAT_CHROME)

const lockMPGeom = merge([
  box(LX,       LY,          LZ+0.010, 0.016, 0.160, 0.006),
  box(LX,       LY+0.060,    LZ+0.018, 0.008, 0.012, 0.012),
  box(LX,       LY,          LZ+0.018, 0.008, 0.012, 0.012),
  box(LX,       LY-0.060,    LZ+0.018, 0.008, 0.012, 0.012),
  box(LX-0.060, LY,          LZ+0.028, 0.055, 0.008, 0.008),
  box(LX-0.118, LY-0.016,    LZ+0.028, 0.006, 0.020, 0.008),
])
const mLockMP = b.addMesh('Lock_Multipoint', ...Object.values(lockMPGeom), MAT_CHROME)

const lockSmartGeom = merge([
  box(LX-0.010, LY,          LZ+0.010, 0.030, 0.100, 0.008),
  box(LX-0.010, LY+0.015,    LZ+0.020, 0.018, 0.052, 0.004),
  box(LX-0.002, LY-0.038,    LZ+0.022, 0.006, 0.006, 0.004),
  box(LX-0.060, LY,          LZ+0.028, 0.055, 0.008, 0.008),
  box(LX-0.118, LY-0.016,    LZ+0.028, 0.006, 0.020, 0.008),
])
const mLockSmart = b.addMesh('Lock_Smart', ...Object.values(lockSmartGeom), MAT_ELEC)

// ── Hinge helpers ──────────────────────────────────────────────────────────

function stdHinge(hy) {
  const HX = -DW/2, HZ = 0
  return merge([
    box(HX+0.008, hy, HZ, 0.014, 0.060, DD/2+0.004),
    box(HX-0.008, hy, HZ, 0.014, 0.060, FD/2),
    box(HX,       hy, HZ, 0.004, 0.060, 0.004),
  ])
}
function concHinge(hy) {
  const HX = -DW/2, HZ = 0
  return merge([
    box(HX+0.005, hy, DD/2-0.003, 0.018, 0.048, 0.003),
    box(HX-0.005, hy, HZ,         0.008, 0.048, FD*0.4),
  ])
}
function heavyHinge(hy) {
  const HX = -DW/2, HZ = 0
  return merge([
    box(HX+0.014, hy, HZ, 0.022, 0.090, DD/2+0.006),
    box(HX-0.014, hy, HZ, 0.022, 0.090, FD/2),
    box(HX,       hy, HZ, 0.006, 0.090, 0.006),
    box(HX+0.022, hy+0.030, DD/2+0.009, 0.005, 0.005, 0.003),
    box(HX+0.022, hy-0.030, DD/2+0.009, 0.005, 0.005, 0.003),
    box(HX-0.022, hy+0.030, 0,          0.005, 0.005, 0.003),
    box(HX-0.022, hy-0.030, 0,          0.005, 0.005, 0.003),
  ])
}

// Hinge positions: top, middle, bottom
const HINGE_Y = [1.750, 1.050, 0.280]

const mHingeStdA   = b.addMesh('Hinge_Standard_A',   ...Object.values(stdHinge(HINGE_Y[0])),   MAT_CHROME)
const mHingeStdB   = b.addMesh('Hinge_Standard_B',   ...Object.values(stdHinge(HINGE_Y[1])),   MAT_CHROME)
const mHingeStdC   = b.addMesh('Hinge_Standard_C',   ...Object.values(stdHinge(HINGE_Y[2])),   MAT_CHROME)
const mHingeConcA  = b.addMesh('Hinge_Concealed_A',  ...Object.values(concHinge(HINGE_Y[0])),  MAT_CHROME)
const mHingeConcB  = b.addMesh('Hinge_Concealed_B',  ...Object.values(concHinge(HINGE_Y[1])),  MAT_CHROME)
const mHingeConcC  = b.addMesh('Hinge_Concealed_C',  ...Object.values(concHinge(HINGE_Y[2])),  MAT_CHROME)
const mHingeHeavyA = b.addMesh('Hinge_Heavy_A',      ...Object.values(heavyHinge(HINGE_Y[0])), MAT_CHROME)
const mHingeHeavyB = b.addMesh('Hinge_Heavy_B',      ...Object.values(heavyHinge(HINGE_Y[1])), MAT_CHROME)
const mHingeHeavyC = b.addMesh('Hinge_Heavy_C',      ...Object.values(heavyHinge(HINGE_Y[2])), MAT_CHROME)

// ── Floor plane (neutral ground, provides contact shadow + spatial grounding) ─
// Positioned just below the frame threshold (threshold bottom at Y = -FP = -0.060).
const floorGeom = box(0, -FP - 0.010, 0, 1.500, 0.010, 0.700)
const mFloor = b.addMesh('Floor_Plane', ...Object.values(floorGeom), MAT_FLOOR)

// ── Scene graph ────────────────────────────────────────────────────────────
//
// Door_Scalable: only the door body (frame + leaf + glass) scales with
// dimension rules. Hardware and floor are siblings at Door_Root level.

const nScalable = b.addNode('Door_Scalable', null, [
  b.addNode('Door_Frame',          mDoorFrame),
  b.addNode('Door_Leaf_Black',     mLeafBlack),
  b.addNode('Door_Leaf_Anthracite',mLeafAnthr),
  b.addNode('Door_Leaf_White',     mLeafWhite),
  b.addNode('Glass_Panel',         mGlass),
  b.addNode('Glass_Frame',         mGlassFrame),
])

const nLockCyl    = b.addNode('Lock_Cylinder',    mLockCyl)
const nLockMP     = b.addNode('Lock_Multipoint',  mLockMP)
const nLockSmart  = b.addNode('Lock_Smart',       mLockSmart)

const nHingeStdA   = b.addNode('Hinge_Standard_A',   mHingeStdA)
const nHingeStdB   = b.addNode('Hinge_Standard_B',   mHingeStdB)
const nHingeStdC   = b.addNode('Hinge_Standard_C',   mHingeStdC)
const nHingeConcA  = b.addNode('Hinge_Concealed_A',  mHingeConcA)
const nHingeConcB  = b.addNode('Hinge_Concealed_B',  mHingeConcB)
const nHingeConcC  = b.addNode('Hinge_Concealed_C',  mHingeConcC)
const nHingeHeavyA = b.addNode('Hinge_Heavy_A',      mHingeHeavyA)
const nHingeHeavyB = b.addNode('Hinge_Heavy_B',      mHingeHeavyB)
const nHingeHeavyC = b.addNode('Hinge_Heavy_C',      mHingeHeavyC)

const nFloor = b.addNode('Floor_Plane', mFloor)

const rootIdx = b.addNode('Door_Root', null, [
  nScalable,
  nLockCyl, nLockMP, nLockSmart,
  nHingeStdA, nHingeStdB, nHingeStdC,
  nHingeConcA, nHingeConcB, nHingeConcC,
  nHingeHeavyA, nHingeHeavyB, nHingeHeavyC,
  nFloor,
])
b.scenes[0] = { nodes: [rootIdx] }

// ── Write file ─────────────────────────────────────────────────────────────

const glb = b.build()
writeFileSync(OUTPUT, glb)
console.log(`✓ Written ${glb.byteLength} bytes → ${OUTPUT}`)
console.log()
console.log('Changes vs v1:')
console.log('  • UV coordinates on all meshes (enables texture swapping via MeshTextureRule)')
console.log('  • Flat normal map embedded in GLB for door panel materials')
console.log('  • Floor_Plane mesh for contact shadow and spatial grounding')
console.log()
console.log('Next steps:')
console.log('  1. Upload steel_door.glb to your Supabase Storage bucket')
console.log('  2. Update the visualization asset url in the database')
console.log('  3. Run migrations 054, 055, 056 if not already applied')
