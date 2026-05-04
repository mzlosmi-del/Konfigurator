#!/usr/bin/env node
/**
 * Steel door 3D model generator — no external dependencies.
 *
 * Produces steel_door.glb in the current working directory (or the path
 * given as the first CLI argument).
 *
 * Mesh tree (matches mesh_rules in migration 052):
 *
 *   Door_Assembly          root node; scaled by dimension rules for width/height
 *   ├── Door_Frame         surrounding steel frame (always visible)
 *   ├── Door_Leaf_Black    door panel — RAL 9005 (visible when colour = black)
 *   ├── Door_Leaf_Anthracite door panel — RAL 7016 (visible when colour = anthracite)
 *   ├── Door_Leaf_White    door panel — RAL 9010 (visible when colour = white)
 *   ├── Glass_Panel        upper glazed insert (always visible, semi-transparent)
 *   ├── Glass_Frame        thin metal surround for glass (always visible)
 *   ├── Lock_Cylinder      standard cylinder lock + handle (lock = cylinder)
 *   ├── Lock_Multipoint    multi-point locking bar (lock = multipoint)
 *   ├── Lock_Smart         electronic keypad panel (lock = smart)
 *   ├── Hinge_Standard_A/B/C  butt hinges (hinges = standard)
 *   ├── Hinge_Concealed_A/B/C flush-mount concealed hinges (hinges = concealed)
 *   └── Hinge_Heavy_A/B/C    heavy-duty reinforced hinges (hinges = heavy)
 *
 * Usage:
 *   node scripts/generate_steel_door_model.mjs [output.glb]
 *
 * After generation upload to Supabase Storage and update the url in
 * migration 052_steel_door_seed.sql.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUTPUT = resolve(process.argv[2] ?? 'steel_door.glb')

// ── GLB builder ────────────────────────────────────────────────────────────

class GlbBuilder {
  constructor() {
    this._chunks   = []   // raw Buffer pieces for binary chunk
    this._bvOffset = 0
    this.bufferViews = []
    this.accessors   = []
    this.meshes      = []
    this.materials   = []
    this.nodes       = []
    this.scenes      = [{ nodes: [0] }]
  }

  // Append a typed-array to the binary chunk; return bufferView index.
  _addRaw(typedArray, target) {
    const buf    = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
    const padLen = (4 - (buf.byteLength % 4)) % 4
    const padded = padLen > 0 ? Buffer.concat([buf, Buffer.alloc(padLen, 0)]) : buf
    this._chunks.push(padded)
    this.bufferViews.push({ byteOffset: this._bvOffset, byteLength: buf.byteLength, ...(target ? { target } : {}) })
    this._bvOffset += padded.byteLength
    return this.bufferViews.length - 1
  }

  _addPositions(f32) {
    const bv = this._addRaw(f32, 34962)
    let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity
    for (let i = 0; i < f32.length; i += 3) {
      if (f32[i]   < x0) x0 = f32[i];   if (f32[i]   > x1) x1 = f32[i]
      if (f32[i+1] < y0) y0 = f32[i+1]; if (f32[i+1] > y1) y1 = f32[i+1]
      if (f32[i+2] < z0) z0 = f32[i+2]; if (f32[i+2] > z1) z1 = f32[i+2]
    }
    this.accessors.push({ bufferView: bv, componentType: 5126, count: f32.length / 3,
      type: 'VEC3', min: [x0,y0,z0], max: [x1,y1,z1] })
    return this.accessors.length - 1
  }

  _addNormals(f32) {
    const bv = this._addRaw(f32, 34962)
    this.accessors.push({ bufferView: bv, componentType: 5126, count: f32.length / 3, type: 'VEC3' })
    return this.accessors.length - 1
  }

  _addIndices(u16) {
    const bv = this._addRaw(u16, 34963)
    this.accessors.push({ bufferView: bv, componentType: 5123, count: u16.length, type: 'SCALAR' })
    return this.accessors.length - 1
  }

  addMesh(name, positions, normals, indices, materialIdx) {
    const posAcc  = this._addPositions(positions)
    const normAcc = this._addNormals(normals)
    const idxAcc  = this._addIndices(indices)
    this.meshes.push({
      name,
      primitives: [{ attributes: { POSITION: posAcc, NORMAL: normAcc }, indices: idxAcc, material: materialIdx }],
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

  // PBR metallic-roughness material
  addMaterial(name, r, g, b, a, metallic, roughness, alphaMode) {
    this.materials.push({
      name,
      pbrMetallicRoughness: { baseColorFactor: [r,g,b,a ?? 1], metallicFactor: metallic, roughnessFactor: roughness },
      ...(alphaMode && alphaMode !== 'OPAQUE' ? { alphaMode, alphaCutoff: undefined } : {}),
      doubleSided: (alphaMode === 'BLEND'),
    })
    return this.materials.length - 1
  }

  build() {
    const bin = Buffer.concat(this._chunks)

    const json = JSON.stringify({
      asset:       { version: '2.0', generator: 'Konfigurator steel-door generator v1.0' },
      scene:       0,
      scenes:      this.scenes,
      nodes:       this.nodes,
      meshes:      this.meshes,
      materials:   this.materials,
      accessors:   this.accessors,
      bufferViews: this.bufferViews,
      buffers:     [{ byteLength: bin.byteLength }],
    })

    const jsonBuf = Buffer.from(json, 'utf8')
    const jsonPad = (4 - (jsonBuf.byteLength % 4)) % 4
    const jsonOut = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]) // spaces

    const binPad = (4 - (bin.byteLength % 4)) % 4
    const binOut = Buffer.concat([bin, Buffer.alloc(binPad, 0)])

    const totalLen = 12 + 8 + jsonOut.byteLength + 8 + binOut.byteLength
    const hdr = Buffer.alloc(12)
    hdr.writeUInt32LE(0x46546C67, 0)  // 'glTF'
    hdr.writeUInt32LE(2,           4)
    hdr.writeUInt32LE(totalLen,    8)

    const jc = Buffer.alloc(8)
    jc.writeUInt32LE(jsonOut.byteLength, 0)
    jc.writeUInt32LE(0x4E4F534A,         4)  // 'JSON'

    const bc = Buffer.alloc(8)
    bc.writeUInt32LE(binOut.byteLength, 0)
    bc.writeUInt32LE(0x004E4942,        4)  // 'BIN\0'

    return Buffer.concat([hdr, jc, jsonOut, bc, binOut])
  }
}

// ── Geometry helpers ───────────────────────────────────────────────────────

// Returns {positions: Float32Array, normals: Float32Array, indices: Uint16Array}
// for a box centred at (cx,cy,cz) with half-extents (hx,hy,hz).
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
  const idx = []
  for (let f = 0; f < 6; f++) {
    const b = f * 4
    idx.push(b,b+1,b+2, b,b+2,b+3)
  }
  return { positions: new Float32Array(p), normals: new Float32Array(n), indices: new Uint16Array(idx) }
}

// Merge an array of box geometries into one mesh geometry.
function merge(boxes) {
  let vCount = 0
  const ps=[], ns=[], is=[]
  for (const g of boxes) {
    for (const v of g.positions) ps.push(v)
    for (const v of g.normals)   ns.push(v)
    for (const v of g.indices)   is.push(v + vCount)
    vCount += g.positions.length / 3
  }
  return { positions: new Float32Array(ps), normals: new Float32Array(ns), indices: new Uint16Array(is) }
}

// ── Door geometry constants (all units: metres) ────────────────────────────
//
// Reference door: 900 mm wide × 2100 mm tall × 80 mm deep
// Coordinate origin: bottom-centre of door opening, Z=0 = front face plane
//
// Layout (X axis): hinge side = –X, handle side = +X
//

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

// ── Materials ──────────────────────────────────────────────────────────────

const b = new GlbBuilder()

const MAT_FRAME  = b.addMaterial('Steel_Frame',     0.290, 0.310, 0.325, 1, 0.85, 0.30)
const MAT_BLACK  = b.addMaterial('Steel_Black',     0.028, 0.028, 0.030, 1, 0.80, 0.32)
const MAT_ANTHR  = b.addMaterial('Steel_Anthracite',0.168, 0.180, 0.196, 1, 0.80, 0.32)
const MAT_WHITE  = b.addMaterial('Steel_White',     0.964, 0.976, 0.984, 1, 0.70, 0.42)
const MAT_GLASS  = b.addMaterial('Glass_Clear',     0.680, 0.800, 0.920, 0.35, 0.0, 0.05, 'BLEND')
const MAT_GFRAME = b.addMaterial('Steel_GlassFrame',0.420, 0.435, 0.450, 1, 0.82, 0.28)
const MAT_CHROME = b.addMaterial('Chrome',          0.860, 0.880, 0.900, 1, 1.00, 0.08)
const MAT_ELEC   = b.addMaterial('Electronics',     0.080, 0.090, 0.100, 1, 0.20, 0.75)

// ── Mesh definitions ────────────────────────────────────────────────────────

// Door_Frame: 4 profiles forming the frame surround
const frameGeom = merge([
  box(-DW/2 - FP/2,  DH/2, 0, FP/2,       DH/2+FP,   FD/2),   // left stile
  box( DW/2 + FP/2,  DH/2, 0, FP/2,       DH/2+FP,   FD/2),   // right stile
  box(0,     DH+FP/2, 0,   DW/2+FP,  FP/2,       FD/2),   // top rail
  box(0,     -FP/2,   0,   DW/2+FP,  FP/2,       FD/2),   // threshold sill
])
const mDoorFrame = b.addMesh('Door_Frame', frameGeom.positions, frameGeom.normals, frameGeom.indices, MAT_FRAME)

// Door leaf — shared geometry, 3 materials (one per colour)
const leafGeom = box(0, DH/2, -DD*0.1, DW/2, DH/2 - 0.006, DD/2)
const mLeafBlack = b.addMesh('Door_Leaf_Black',      leafGeom.positions, leafGeom.normals, leafGeom.indices, MAT_BLACK)
const mLeafAnthr = b.addMesh('Door_Leaf_Anthracite', leafGeom.positions, leafGeom.normals, leafGeom.indices, MAT_ANTHR)
const mLeafWhite = b.addMesh('Door_Leaf_White',      leafGeom.positions, leafGeom.normals, leafGeom.indices, MAT_WHITE)

// Glass_Panel — inset flush with front face of door leaf
const glassGeom = box(0, GY + GH/2, DD/2 - GP/2 + 0.001, GW/2, GH/2, GP/2)
const mGlass = b.addMesh('Glass_Panel', glassGeom.positions, glassGeom.normals, glassGeom.indices, MAT_GLASS)

// Glass_Frame — thin surround for the glass insert
const gfGeom = merge([
  box(0,                    GY + GH + GFP/2, DD/2-GP*0.6, GW/2 + GFP, GFP/2, GP*0.8),  // top bar
  box(0,                    GY - GFP/2,      DD/2-GP*0.6, GW/2 + GFP, GFP/2, GP*0.8),  // bottom bar
  box(-GW/2 - GFP/2,        GY + GH/2,       DD/2-GP*0.6, GFP/2, GH/2,       GP*0.8),  // left bar
  box( GW/2 + GFP/2,        GY + GH/2,       DD/2-GP*0.6, GFP/2, GH/2,       GP*0.8),  // right bar
])
const mGlassFrame = b.addMesh('Glass_Frame', gfGeom.positions, gfGeom.normals, gfGeom.indices, MAT_GFRAME)

// ── Lock variants (positioned at handle side, ~1050 mm from floor) ─────────
const LX = DW/2 - 0.028   // lock X — close to handle edge
const LY = 1.050           // lock centre height
const LZ = DD/2            // lock flush with front face

// Lock_Cylinder: escutcheon plate + cylinder knob + lever handle
const lockCylGeom = merge([
  box(LX,          LY,          LZ + 0.010, 0.018, 0.065, 0.006),   // escutcheon
  box(LX,          LY + 0.030,  LZ + 0.022, 0.012, 0.012, 0.016),   // cylinder knob
  box(LX - 0.060,  LY,          LZ + 0.028, 0.055, 0.008, 0.008),   // lever arm
  box(LX - 0.118,  LY - 0.016,  LZ + 0.028, 0.006, 0.020, 0.008),   // lever end
])
const mLockCyl = b.addMesh('Lock_Cylinder', lockCylGeom.positions, lockCylGeom.normals, lockCylGeom.indices, MAT_CHROME)

// Lock_Multipoint: tall escutcheon + 3 bolt indicators
const lockMPGeom = merge([
  box(LX, LY,         LZ + 0.010, 0.016, 0.160, 0.006),  // tall plate
  box(LX, LY + 0.060, LZ + 0.018, 0.008, 0.012, 0.012),  // bolt top
  box(LX, LY,         LZ + 0.018, 0.008, 0.012, 0.012),  // bolt mid
  box(LX, LY - 0.060, LZ + 0.018, 0.008, 0.012, 0.012),  // bolt bottom
  box(LX - 0.060, LY, LZ + 0.028, 0.055, 0.008, 0.008),  // lever arm
  box(LX - 0.118, LY-0.016, LZ + 0.028, 0.006, 0.020, 0.008),
])
const mLockMP = b.addMesh('Lock_Multipoint', lockMPGeom.positions, lockMPGeom.normals, lockMPGeom.indices, MAT_CHROME)

// Lock_Smart: electronic panel + keypad area + status LED
const lockSmartBody = merge([
  box(LX - 0.010, LY,          LZ + 0.010, 0.030, 0.100, 0.008),   // panel body
  box(LX - 0.010, LY + 0.015,  LZ + 0.020, 0.018, 0.052, 0.004),   // keypad inset
  box(LX - 0.002, LY - 0.038,  LZ + 0.022, 0.006, 0.006, 0.004),   // status LED
  box(LX - 0.060, LY,          LZ + 0.028, 0.055, 0.008, 0.008),   // lever arm
  box(LX - 0.118, LY - 0.016,  LZ + 0.028, 0.006, 0.020, 0.008),
])
const mLockSmart = b.addMesh('Lock_Smart', lockSmartBody.positions, lockSmartBody.normals, lockSmartBody.indices, MAT_ELEC)

// ── Hinge helper: returns geometry for one hinge centred at (hx, hy, hz) ──
// Standard hinge: simple flat L-bracket on hinge edge
function stdHinge(hy) {
  const HX = -DW/2         // hinge edge X
  const HZ = 0             // Z centred in door depth
  return merge([
    box(HX + 0.008, hy, HZ, 0.014, 0.060, DD/2 + 0.004),  // leaf on door
    box(HX - 0.008, hy, HZ, 0.014, 0.060, FD/2),           // leaf on frame
    box(HX,         hy, HZ, 0.004, 0.060, 0.004),           // knuckle pin
  ])
}

// Concealed hinge: small rectangular flush plate barely visible from front
function concHinge(hy) {
  const HX = -DW/2
  const HZ = 0
  return merge([
    box(HX + 0.005, hy, DD/2 - 0.003, 0.018, 0.048, 0.003),  // front plate
    box(HX - 0.005, hy, HZ,           0.008, 0.048, FD*0.4),  // frame mount
  ])
}

// Heavy-duty hinge: wider, thicker plates with visible bolt pattern
function heavyHinge(hy) {
  const HX = -DW/2
  const HZ = 0
  return merge([
    box(HX + 0.014, hy, HZ, 0.022, 0.090, DD/2 + 0.006),  // door leaf
    box(HX - 0.014, hy, HZ, 0.022, 0.090, FD/2),           // frame leaf
    box(HX,         hy, HZ, 0.006, 0.090, 0.006),           // barrel
    // bolt heads on door leaf
    box(HX + 0.022, hy + 0.030, DD/2 + 0.009, 0.005, 0.005, 0.003),
    box(HX + 0.022, hy - 0.030, DD/2 + 0.009, 0.005, 0.005, 0.003),
    // bolt heads on frame leaf
    box(HX - 0.022, hy + 0.030, 0, 0.005, 0.005, 0.003),
    box(HX - 0.022, hy - 0.030, 0, 0.005, 0.005, 0.003),
  ])
}

// Hinge positions: top, middle, bottom
const HINGE_Y = [1.750, 1.050, 0.280]

// Standard hinges
const mHingeStdA = b.addMesh('Hinge_Standard_A', ...Object.values(stdHinge(HINGE_Y[0])), MAT_CHROME)
const mHingeStdB = b.addMesh('Hinge_Standard_B', ...Object.values(stdHinge(HINGE_Y[1])), MAT_CHROME)
const mHingeStdC = b.addMesh('Hinge_Standard_C', ...Object.values(stdHinge(HINGE_Y[2])), MAT_CHROME)

// Concealed hinges
const mHingeConcA = b.addMesh('Hinge_Concealed_A', ...Object.values(concHinge(HINGE_Y[0])), MAT_CHROME)
const mHingeConcB = b.addMesh('Hinge_Concealed_B', ...Object.values(concHinge(HINGE_Y[1])), MAT_CHROME)
const mHingeConcC = b.addMesh('Hinge_Concealed_C', ...Object.values(concHinge(HINGE_Y[2])), MAT_CHROME)

// Heavy hinges
const mHingeHeavyA = b.addMesh('Hinge_Heavy_A', ...Object.values(heavyHinge(HINGE_Y[0])), MAT_CHROME)
const mHingeHeavyB = b.addMesh('Hinge_Heavy_B', ...Object.values(heavyHinge(HINGE_Y[1])), MAT_CHROME)
const mHingeHeavyC = b.addMesh('Hinge_Heavy_C', ...Object.values(heavyHinge(HINGE_Y[2])), MAT_CHROME)

// ── Scene graph ────────────────────────────────────────────────────────────

const children = [
  b.addNode('Door_Frame',          mDoorFrame),
  b.addNode('Door_Leaf_Black',     mLeafBlack),
  b.addNode('Door_Leaf_Anthracite',mLeafAnthr),
  b.addNode('Door_Leaf_White',     mLeafWhite),
  b.addNode('Glass_Panel',         mGlass),
  b.addNode('Glass_Frame',         mGlassFrame),
  b.addNode('Lock_Cylinder',       mLockCyl),
  b.addNode('Lock_Multipoint',     mLockMP),
  b.addNode('Lock_Smart',          mLockSmart),
  b.addNode('Hinge_Standard_A',    mHingeStdA),
  b.addNode('Hinge_Standard_B',    mHingeStdB),
  b.addNode('Hinge_Standard_C',    mHingeStdC),
  b.addNode('Hinge_Concealed_A',   mHingeConcA),
  b.addNode('Hinge_Concealed_B',   mHingeConcB),
  b.addNode('Hinge_Concealed_C',   mHingeConcC),
  b.addNode('Hinge_Heavy_A',       mHingeHeavyA),
  b.addNode('Hinge_Heavy_B',       mHingeHeavyB),
  b.addNode('Hinge_Heavy_C',       mHingeHeavyC),
]

// Root node — dimension rules in mesh_rules will scale this node
b.addNode('Door_Assembly', null, children)

// ── Write file ─────────────────────────────────────────────────────────────

const glb = b.build()
writeFileSync(OUTPUT, glb)
console.log(`✓ Written ${glb.byteLength} bytes → ${OUTPUT}`)
console.log()
console.log('Next steps:')
console.log('  1. Upload steel_door.glb to your Supabase Storage bucket')
console.log('     (e.g. storage bucket "models", path "templates/steel_door.glb")')
console.log('  2. Replace the placeholder url in migrations/052_steel_door_seed.sql')
console.log('     with the public URL of the uploaded file')
console.log('  3. Run the migration in the Supabase SQL editor')
