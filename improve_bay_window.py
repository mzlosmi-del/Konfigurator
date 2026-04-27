#!/usr/bin/env python3
"""
Rebuilds bay_window.glb with maximum photorealism:
  - Triplanar UV coordinates on all meshes
  - Two embedded procedural normal maps (painted surface, brushed metal)
  - Full PBR material extensions:
      KHR_materials_transmission, KHR_materials_ior, KHR_materials_volume  (glass)
      KHR_materials_clearcoat                                               (frame, trim)
      KHR_materials_specular                                                (all)
"""
import struct, json, math, zlib

# ── GLB I/O ──────────────────────────────────────────────────────────────────

def read_glb(path):
    raw = open(path, 'rb').read()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
    chunks, off = {}, 12
    while off < len(raw):
        clen = struct.unpack_from('<I', raw, off)[0]
        ctype = struct.unpack_from('<I', raw, off+4)[0]
        name = 'JSON' if ctype == 0x4E4F534A else 'BIN'
        chunks[name] = raw[off+8: off+8+clen]
        off += 8 + clen
    return chunks

def write_glb(gltf_dict, bin_bytes):
    j = json.dumps(gltf_dict, separators=(',', ':')).encode()
    while len(j) % 4: j += b' '
    b = bytearray(bin_bytes)
    while len(b) % 4: b += b'\x00'
    total = 12 + 8 + len(j) + 8 + len(b)
    hdr = struct.pack('<III', 0x46546C67, 2, total)
    jchunk = struct.pack('<II', len(j), 0x4E4F534A) + j
    bchunk = struct.pack('<II', len(b), 0x004E4942) + bytes(b)
    return hdr + jchunk + bchunk

# ── Geometry helpers ──────────────────────────────────────────────────────────

def read_accessor(gltf, buf, idx):
    acc = gltf['accessors'][idx]
    bv  = gltf['bufferViews'][acc['bufferView']]
    off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride', 0)
    count  = acc['count']
    ctype  = acc['componentType']
    atype  = acc['type']
    nc = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[atype]
    fmt, cs = ('f', 4) if ctype == 5126 else ('H', 2) if ctype == 5123 else ('I', 4)
    if not stride: stride = nc * cs
    result = []
    for i in range(count):
        vals = struct.unpack_from(f'{nc}{fmt}', buf, off + i*stride)
        result.append(vals if nc > 1 else vals[0])
    return result

def triplanar_uv(px, py, pz, nx, ny, nz, scale=1.8):
    ax, ay, az = abs(nx), abs(ny), abs(nz)
    if ax >= ay and ax >= az:
        return (pz * scale, py * scale)
    elif ay >= ax and ay >= az:
        return (px * scale, pz * scale)
    else:
        return (px * scale, py * scale)

# ── Procedural PNG textures ───────────────────────────────────────────────────

def make_png(width, height, get_rgb):
    def chunk(t, d):
        c = zlib.crc32(t + d) & 0xffffffff
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', c)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(get_rgb(x, y))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))

def clamp8(v):
    return max(0, min(255, int(v)))

def painted_surface_normal(x, y, W=128, H=128):
    """Subtle horizontal grain: painted uPVC / lacquered wood."""
    pi2 = math.pi * 2
    # Slow primary grain lines (horizontal)
    grain1 = math.sin((y / H) * pi2 * 6.0 + math.sin(x * 0.4) * 0.5) * 0.55
    # Finer secondary grain
    grain2 = math.sin((y / H) * pi2 * 22.0 + math.cos(x * 0.15) * 1.2) * 0.18
    # Micro noise
    seed = (x * 1699 + y * 4799) & 0xFFFF
    noise = ((seed * 6971 + 13337) & 0xFFFF) / 65535.0 * 2.0 - 1.0
    nx_f = (grain1 + grain2 + noise * 0.08) * 0.18   # x-displacement of normal
    ny_f = noise * 0.04                                # y-displacement
    nz_f = math.sqrt(max(0.01, 1.0 - nx_f**2 - ny_f**2))
    r = clamp8(128 + nx_f * 127)
    g = clamp8(128 + ny_f * 127)
    b = clamp8(128 + nz_f * 127)
    return (r, g, b)

def brushed_metal_normal(x, y, W=128, H=128):
    """Horizontal brush marks + faint scratches for anisotropic aluminium."""
    pi2 = math.pi * 2
    # Primary brush lines (very regular horizontal)
    brush = math.sin((y / H) * pi2 * 40.0) * 0.9
    # Occasional deeper scratches
    seed2 = (y * 997) & 0xFFFF
    scratch_y = ((seed2 * 6571 + 7919) & 0xFFFF) / 65535.0
    scratch = math.sin((y / H) * pi2 * 8.3 + scratch_y * pi2) * 0.4
    # Random micro texture
    seed3 = (x * 2311 + y * 3571) & 0xFFFF
    noise = ((seed3 * 7561 + 9371) & 0xFFFF) / 65535.0 * 2.0 - 1.0
    nx_f = (brush * 0.35 + scratch * 0.12 + noise * 0.05) * 0.55
    ny_f = noise * 0.02
    nz_f = math.sqrt(max(0.01, 1.0 - nx_f**2 - ny_f**2))
    r = clamp8(128 + nx_f * 127)
    g = clamp8(128 + ny_f * 127)
    b = clamp8(128 + nz_f * 127)
    return (r, g, b)

# ── Build improved GLB ────────────────────────────────────────────────────────

def build(src_path, dst_path):
    chunks = read_glb(src_path)
    gltf   = json.loads(chunks['JSON'])
    src_buf = chunks['BIN']

    # ─ Generate embedded PNG textures ───────────────────────────────────────
    png_painted = make_png(128, 128, painted_surface_normal)
    png_metal   = make_png(128, 128, brushed_metal_normal)

    # ─ Extract geometry and compute UVs per mesh ────────────────────────────
    mesh_uvs = {}   # mesh_idx → list of (u,v) per vertex
    for mi, mesh in enumerate(gltf['meshes']):
        prim = mesh['primitives'][0]
        pos_acc = prim['attributes']['POSITION']
        nor_acc = prim['attributes']['NORMAL']
        positions = read_accessor(gltf, src_buf, pos_acc)
        normals   = read_accessor(gltf, src_buf, nor_acc)
        uvs = [triplanar_uv(*p, *n) for p, n in zip(positions, normals)]
        mesh_uvs[mi] = uvs

    # ─ Build new binary buffer ───────────────────────────────────────────────
    new_buf = bytearray(src_buf)   # start with existing geometry

    # Append PNG image data
    def append_data(data, align=4):
        while len(new_buf) % align: new_buf.append(0)
        off = len(new_buf)
        new_buf.extend(data)
        return off, len(data)

    img0_off, img0_len = append_data(png_painted)
    img1_off, img1_len = append_data(png_metal)

    # Append UV float data per mesh
    uv_accessor_indices = {}
    new_bvs    = list(gltf['bufferViews'])
    new_accs   = list(gltf['accessors'])
    new_images = []
    new_textures = []
    new_samplers = []

    # UV buffer views + accessors
    for mi, uvs in mesh_uvs.items():
        while len(new_buf) % 4: new_buf.append(0)
        uv_off = len(new_buf)
        uv_bytes = struct.pack(f'{len(uvs)*2}f', *[c for uv in uvs for c in uv])
        new_buf.extend(uv_bytes)

        bv_idx = len(new_bvs)
        new_bvs.append({
            'buffer': 0,
            'byteOffset': uv_off,
            'byteLength': len(uv_bytes),
        })
        acc_idx = len(new_accs)
        mins = [min(uv[i] for uv in uvs) for i in range(2)]
        maxs = [max(uv[i] for uv in uvs) for i in range(2)]
        new_accs.append({
            'bufferView': bv_idx,
            'componentType': 5126,
            'count': len(uvs),
            'type': 'VEC2',
            'min': mins,
            'max': maxs,
        })
        uv_accessor_indices[mi] = acc_idx

    # Image buffer views
    bv_img0 = len(new_bvs)
    new_bvs.append({'buffer':0,'byteOffset':img0_off,'byteLength':img0_len})
    bv_img1 = len(new_bvs)
    new_bvs.append({'buffer':0,'byteOffset':img1_off,'byteLength':img1_len})

    # Images
    img0 = len(new_images); new_images.append({'bufferView':bv_img0,'mimeType':'image/png'})
    img1 = len(new_images); new_images.append({'bufferView':bv_img1,'mimeType':'image/png'})

    # Samplers
    samp = 0; new_samplers.append({'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497})

    # Textures
    tex_painted = 0; new_textures.append({'sampler':samp,'source':img0})
    tex_metal   = 1; new_textures.append({'sampler':samp,'source':img1})

    # ─ Patch meshes to include TEXCOORD_0 ───────────────────────────────────
    new_meshes = []
    for mi, mesh in enumerate(gltf['meshes']):
        new_prim = dict(mesh['primitives'][0])
        new_prim['attributes'] = dict(new_prim['attributes'])
        new_prim['attributes']['TEXCOORD_0'] = uv_accessor_indices[mi]
        new_meshes.append({'name': mesh['name'], 'primitives': [new_prim]})

    # ─ Upgraded materials ────────────────────────────────────────────────────
    new_materials = [
        # 0 — frame_mat  (white uPVC satin-gloss)
        {
            'name': 'frame_mat',
            'pbrMetallicRoughness': {
                'baseColorFactor': [0.958, 0.955, 0.948, 1.0],
                'metallicFactor':  0.0,
                'roughnessFactor': 0.12,
            },
            'normalTexture': {'index': tex_painted, 'scale': 0.35},
            'extensions': {
                'KHR_materials_clearcoat': {
                    'clearcoatFactor': 0.35,
                    'clearcoatRoughnessFactor': 0.08,
                },
                'KHR_materials_specular': {
                    'specularFactor': 0.5,
                    'specularColorFactor': [1.0, 1.0, 1.0],
                },
            },
        },
        # 1 — glass_mat  (float double-glazing, transmission)
        {
            'name': 'glass_mat',
            'pbrMetallicRoughness': {
                'baseColorFactor': [1.0, 1.0, 1.0, 1.0],
                'metallicFactor':  0.0,
                'roughnessFactor': 0.0,
            },
            'alphaMode': 'OPAQUE',
            'doubleSided': False,
            'extensions': {
                'KHR_materials_transmission': {'transmissionFactor': 0.97},
                'KHR_materials_ior':          {'ior': 1.52},
                'KHR_materials_volume': {
                    'thicknessFactor': 0.006,
                    'attenuationColor': [0.88, 0.97, 0.94],
                    'attenuationDistance': 0.30,
                },
                'KHR_materials_specular': {
                    'specularFactor': 1.0,
                    'specularColorFactor': [1.0, 1.0, 1.0],
                },
            },
        },
        # 2 — victorian_trim_mat  (cream high-gloss lacquer)
        {
            'name': 'victorian_trim_mat',
            'pbrMetallicRoughness': {
                'baseColorFactor': [0.974, 0.963, 0.903, 1.0],
                'metallicFactor':  0.0,
                'roughnessFactor': 0.15,
            },
            'normalTexture': {'index': tex_painted, 'scale': 0.5},
            'extensions': {
                'KHR_materials_clearcoat': {
                    'clearcoatFactor': 0.70,
                    'clearcoatRoughnessFactor': 0.10,
                },
                'KHR_materials_specular': {
                    'specularFactor': 0.7,
                    'specularColorFactor': [1.0, 0.98, 0.94],
                },
            },
        },
        # 3 — edwardian_trim_mat  (satin anodised aluminium, warm grey)
        {
            'name': 'edwardian_trim_mat',
            'pbrMetallicRoughness': {
                'baseColorFactor': [0.60, 0.64, 0.68, 1.0],
                'metallicFactor':  0.95,
                'roughnessFactor': 0.28,
            },
            'normalTexture': {'index': tex_metal, 'scale': 1.0},
            'extensions': {
                'KHR_materials_specular': {
                    'specularFactor': 0.8,
                    'specularColorFactor': [0.94, 0.95, 0.97],
                },
            },
        },
        # 4 — modern_trim_mat  (mirror-polished aluminium)
        {
            'name': 'modern_trim_mat',
            'pbrMetallicRoughness': {
                'baseColorFactor': [0.882, 0.890, 0.922, 1.0],
                'metallicFactor':  1.0,
                'roughnessFactor': 0.04,
            },
            'normalTexture': {'index': tex_metal, 'scale': 0.6},
            'extensions': {
                'KHR_materials_clearcoat': {
                    'clearcoatFactor': 0.20,
                    'clearcoatRoughnessFactor': 0.02,
                },
                'KHR_materials_specular': {
                    'specularFactor': 1.0,
                    'specularColorFactor': [1.0, 1.0, 1.0],
                },
            },
        },
        # 5 — triple_glaze_mat  (low-e thermal triple glazing, slight green tint)
        {
            'name': 'triple_glaze_mat',
            'pbrMetallicRoughness': {
                'baseColorFactor': [1.0, 1.0, 1.0, 1.0],
                'metallicFactor':  0.0,
                'roughnessFactor': 0.0,
            },
            'alphaMode': 'OPAQUE',
            'doubleSided': False,
            'extensions': {
                'KHR_materials_transmission': {'transmissionFactor': 0.92},
                'KHR_materials_ior':          {'ior': 1.517},
                'KHR_materials_volume': {
                    'thicknessFactor': 0.012,
                    'attenuationColor': [0.76, 0.94, 0.78],
                    'attenuationDistance': 0.25,
                },
                'KHR_materials_specular': {
                    'specularFactor': 1.0,
                    'specularColorFactor': [0.95, 1.0, 0.96],
                },
            },
        },
    ]

    # ─ Assemble new glTF JSON ────────────────────────────────────────────────
    extensions_used = [
        'KHR_materials_transmission',
        'KHR_materials_ior',
        'KHR_materials_volume',
        'KHR_materials_clearcoat',
        'KHR_materials_specular',
    ]

    new_gltf = dict(gltf)
    new_gltf['asset'] = {'version': '2.0', 'generator': 'bay-window-photorealistic-v2'}
    new_gltf['extensionsUsed'] = extensions_used
    new_gltf['extensionsRequired'] = []
    new_gltf['materials']    = new_materials
    new_gltf['meshes']       = new_meshes
    new_gltf['bufferViews']  = new_bvs
    new_gltf['accessors']    = new_accs
    new_gltf['images']       = new_images
    new_gltf['textures']     = new_textures
    new_gltf['samplers']     = new_samplers
    new_gltf['buffers']      = [{'byteLength': len(new_buf)}]

    glb_bytes = write_glb(new_gltf, bytes(new_buf))
    open(dst_path, 'wb').write(glb_bytes)
    print(f'Written {dst_path}  ({len(glb_bytes):,} bytes)')

build('/home/user/Konfigurator/bay_window.glb',
      '/home/user/Konfigurator/bay_window.glb')
