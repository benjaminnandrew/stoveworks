"""Builds and renders the sample rooms with Blender (bpy 5.x, Cycles CPU).

Usage: python scenes.py <scene> <variant> <light> <mode> <scale_pct> <spp> <out.exr>
  scene:   cabin | linear
  variant: stove/fireplace variant (cabin: trad | modern | open ; linear: linear | open)
  light:   day | eve
  mode:    beauty | tilt_px | tilt_nx | tilt_py | tilt_ny | mask1 | mask2 | geo
Zones (surfaces that can take stone) are separate objects so masks, plane geometry
and light can be exported exactly.
"""
import bpy, bmesh, math, json, sys, os
from mathutils import Vector, Matrix

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roomtex")   # beside this file (was /home/claude/build/roomtex in the chat's sandbox)
SCENE, VARIANT, LIGHT, MODE = sys.argv[1:5]
SCALE = int(sys.argv[5]); SPP = int(sys.argv[6]); OUT = sys.argv[7]
TILT = math.radians(20.0)
# the family room's stand-in fire against its own fireplace's: in front of the wall nothing shades it,
# so it gave 6-8% more glow on the floor, ceiling and the rest of the room (fire passes, 1 Nov 2026)
FIRE_OPEN_K = float(os.environ.get("FIRE_OPEN_K", "0.935"))
DRYWALL = (0.80, 0.78, 0.74)  # linear albedo of the plain painted wall in the zones

bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
COL = SC.collection
ZONES = []          # list of dicts (geometry + metadata)
ZONE_OBJS = {}      # zone id -> object
ALL_OBJS = []

# ------------------------------------------------------------------ materials
def new_mat(name):
    m = bpy.data.materials.new(name)
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]

def link(nt, a, b):
    nt.links.new(a, b)

def mat(name, color, rough=0.5, metal=0.0, spec=0.5, bump=0.0, bump_scale=60.0, var=0.0, var_scale=4.0):
    m, nt, p = new_mat(name)
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Specular IOR Level"].default_value = spec
    if bump > 0:
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = bump_scale
        n.inputs["Detail"].default_value = 6
        b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump
        b.inputs["Distance"].default_value = 0.002
        link(nt, n.outputs["Fac"], b.inputs["Height"]); link(nt, b.outputs["Normal"], p.inputs["Normal"])
    if var > 0:
        n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = var_scale
        n2.inputs["Detail"].default_value = 3
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 1 - var; mr.inputs["To Max"].default_value = 1 + var
        link(nt, n2.outputs["Fac"], mr.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        mul.inputs[6].default_value = (*color, 1)
        cmb = nt.nodes.new("ShaderNodeCombineColor")
        link(nt, mr.outputs["Result"], cmb.inputs[0]); link(nt, mr.outputs["Result"], cmb.inputs[1]); link(nt, mr.outputs["Result"], cmb.inputs[2])
        link(nt, cmb.outputs["Color"], mul.inputs[7])
        link(nt, mul.outputs[2], p.inputs["Base Color"])
    return m

def img_mat(name, path, rough=0.6, scale=(1, 1), height=None, bump=0.3, coord="UV", proj="FLAT",
            blend=0.0, spec=0.5, tint=None, alpha_path=None):
    m, nt, p = new_mat(name)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale[0], scale[1], 1)
    link(nt, tc.outputs[coord], mp.inputs["Vector"])
    it = nt.nodes.new("ShaderNodeTexImage"); it.image = bpy.data.images.load(path)
    it.projection = proj; it.projection_blend = blend
    link(nt, mp.outputs["Vector"], it.inputs["Vector"])
    if tint:
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        link(nt, it.outputs["Color"], mix.inputs[6]); mix.inputs[7].default_value = (*tint, 1)
        link(nt, mix.outputs[2], p.inputs["Base Color"])
    else:
        link(nt, it.outputs["Color"], p.inputs["Base Color"])
    if height:
        ih = nt.nodes.new("ShaderNodeTexImage"); ih.image = bpy.data.images.load(height)
        ih.image.colorspace_settings.name = "Non-Color"; ih.projection = proj; ih.projection_blend = blend
        link(nt, mp.outputs["Vector"], ih.inputs["Vector"])
        b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump
        b.inputs["Distance"].default_value = 0.003
        link(nt, ih.outputs["Color"], b.inputs["Height"]); link(nt, b.outputs["Normal"], p.inputs["Normal"])
    return m

def emission_mat(name, color, strength):
    m = bpy.data.materials.new(name); nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    link(nt, em.outputs[0], out.inputs["Surface"])
    return m

def flame_mat(name, path, strength):
    m = bpy.data.materials.new(name); nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    it = nt.nodes.new("ShaderNodeTexImage"); it.image = bpy.data.images.load(path)
    it.extension = "CLIP"
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    link(nt, it.outputs["Color"], em.inputs["Color"])
    link(nt, it.outputs["Alpha"], mix.inputs["Fac"])
    link(nt, tr.outputs[0], mix.inputs[1]); link(nt, em.outputs[0], mix.inputs[2])
    link(nt, mix.outputs[0], out.inputs["Surface"])
    return m

def glass_mat(name, tint=(0.95, 0.95, 0.95)):
    """Clear glass that lets light through for shadow rays (so firelight escapes)."""
    m = bpy.data.materials.new(name); nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*tint, 1)
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.03
    p.inputs["IOR"].default_value = 1.5
    out = nt.nodes["Material Output"]
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    link(nt, lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    link(nt, p.outputs[0], mix.inputs[1]); link(nt, tr.outputs[0], mix.inputs[2])
    link(nt, mix.outputs[0], out.inputs["Surface"])
    return m

def fabric_shade_mat(name, color):
    m = bpy.data.materials.new(name); nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = 0.9
    p.inputs["Specular IOR Level"].default_value = 0.1
    out = nt.nodes["Material Output"]
    tl = nt.nodes.new("ShaderNodeBsdfTranslucent"); tl.inputs["Color"].default_value = (*color, 1)
    mix = nt.nodes.new("ShaderNodeMixShader"); mix.inputs["Fac"].default_value = 0.45
    link(nt, p.outputs[0], mix.inputs[1]); link(nt, tl.outputs[0], mix.inputs[2])
    link(nt, mix.outputs[0], out.inputs["Surface"])
    return m

def zone_mat(name, zone):
    """Plain painted wall (pure Lambertian, no specular) so irradiance = image / albedo.
    In tilt modes the shading normal is tilted by TILT along the zone's U or V axis."""
    m, nt, p = new_mat(name)
    p.inputs["Base Color"].default_value = (*DRYWALL, 1)
    p.inputs["Roughness"].default_value = 1.0
    p.inputs["Specular IOR Level"].default_value = 0.0
    if MODE.startswith("tilt"):
        N = Vector(zone["N"]); U = Vector(zone["U"]); V = Vector(zone["V"])
        axis = U if MODE[-1] == "x" else V
        sgn = 1 if MODE[5] == "p" else -1
        n = (N * math.cos(TILT) + axis * (sgn * math.sin(TILT))).normalized()
        cv = nt.nodes.new("ShaderNodeCombineXYZ")
        cv.inputs[0].default_value, cv.inputs[1].default_value, cv.inputs[2].default_value = n
        link(nt, cv.outputs[0], p.inputs["Normal"])
    return m

# ------------------------------------------------------------------ geometry
def add_obj(name, data):
    ob = bpy.data.objects.new(name, data); COL.objects.link(ob); ALL_OBJS.append(ob); return ob

def mesh(name, verts, faces, m=None, uvs=None, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    if uvs is not None:
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    ob = add_obj(name, me)
    if m:
        ob.data.materials.append(m)
    return ob

def quad(name, O, U, V, m, facing, uvscale=1.0):
    O, U, V = Vector(O), Vector(U), Vector(V)
    verts = [O, O + U, O + U + V, O + V]
    uvs = [(0, 0), (U.length * uvscale, 0), (U.length * uvscale, V.length * uvscale), (0, V.length * uvscale)]
    f = (0, 1, 2, 3) if U.cross(V).dot(Vector(facing)) > 0 else (0, 3, 2, 1)
    return mesh(name, verts, [f], m, uvs)

def rect_with_holes(name, O, U, V, ulen, vlen, holes, m, facing, uvscale=1.0):
    """Planar rectangle (u in [0,ulen], v in [0,vlen]) minus axis-aligned holes."""
    O, U, V = Vector(O), Vector(U).normalized(), Vector(V).normalized()
    us = sorted(set([0.0, ulen] + [h[0] for h in holes] + [h[1] for h in holes]))
    vs = sorted(set([0.0, vlen] + [h[2] for h in holes] + [h[3] for h in holes]))
    verts, faces, uvs, idx = [], [], [], {}
    def vid(i, j):
        if (i, j) not in idx:
            idx[(i, j)] = len(verts)
            verts.append(O + U * us[i] + V * vs[j]); uvs.append((us[i] * uvscale, vs[j] * uvscale))
        return idx[(i, j)]
    flip = U.cross(V).dot(Vector(facing)) < 0
    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            cu, cv = (us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2
            if any(h[0] < cu < h[1] and h[2] < cv < h[3] for h in holes):
                continue
            f = [vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)]
            faces.append(tuple(reversed(f)) if flip else tuple(f))
    return mesh(name, verts, faces, m, uvs)

def box(name, mn, mx, m=None, bevel=0.0, segs=2):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = add_obj(name, me)
    mn, mx = Vector(mn), Vector(mx)
    ob.scale = mx - mn; ob.location = (mn + mx) / 2
    if m:
        ob.data.materials.append(m)
    if bevel > 0:
        bpy.context.view_layer.update()
        mod = ob.modifiers.new("bev", "BEVEL"); mod.width = bevel; mod.segments = segs
        mod.limit_method = "NONE"; mod.use_clamp_overlap = True
        # bevel works in object space -> compensate for scale by applying scale
        apply_scale(ob)
    return ob

def apply_scale(ob):
    me = ob.data
    s = ob.scale.copy()
    for v in me.vertices:
        v.co = Vector((v.co.x * s.x, v.co.y * s.y, v.co.z * s.z))
    ob.scale = (1, 1, 1)
    me.update()

def cyl(name, center, r, depth, m=None, axis="Z", verts=32, cap_mat=None, smooth=True, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r,
                          radius2=(r if r2 is None else r2), depth=depth)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = add_obj(name, me)
    if m:
        me.materials.append(m)
    if cap_mat:
        me.materials.append(cap_mat)
        for p in me.polygons:
            if abs(p.normal.z) > 0.9:
                p.material_index = 1
    if smooth:
        for p in me.polygons:
            if abs(p.normal.z) < 0.9:
                p.use_smooth = True
    if axis == "X":
        ob.rotation_euler = (0, math.pi / 2, 0)
    elif axis == "Y":
        ob.rotation_euler = (math.pi / 2, 0, 0)
    ob.location = center
    return ob

def pipe(name, pts, r, m):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = r; cu.bevel_resolution = 8; cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    ob = add_obj(name, cu); ob.data.materials.append(m)
    return ob

def boolean_cut(ob, cutter, cut_mat=None):
    cutter.hide_render = True; cutter.hide_viewport = True
    if cut_mat:
        cutter.data.materials.clear(); cutter.data.materials.append(cut_mat)
        if cut_mat.name not in [s.name for s in ob.data.materials]:
            ob.data.materials.append(cut_mat)
    mod = ob.modifiers.new("cut", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cutter
    mod.solver = "EXACT"
    try:
        mod.material_mode = "TRANSFER"
    except Exception:
        pass
    # keep bevel before boolean
    return mod

def subsurf(ob, levels=2):
    mod = ob.modifiers.new("ss", "SUBSURF"); mod.levels = levels; mod.render_levels = levels
    for p in ob.data.polygons:
        p.use_smooth = True

# ------------------------------------------------------------------ zones
def zone(zid, group, label, O_tex, U, V, u0, u1, v0, v1, facing, holes=(), u_off=0.0, visible=True,
         corners=(), build=True):
    """A planar stone-able surface. O_tex is the texture origin (usually at floor height so courses
    line up between faces); the face covers u in [u0,u1], v in [v0,v1] metres from it."""
    U = Vector(U).normalized(); V = Vector(V).normalized(); N = U.cross(V)
    if N.dot(Vector(facing)) < 0:
        N = -N
    z = dict(id=zid, group=group, label=label, O=list(O_tex), U=list(U), V=list(V), N=list(N),
             u0=u0, u1=u1, v0=v0, v1=v1, u_off=u_off, holes=[list(h) for h in holes],
             visible=visible, corners=list(corners))
    ZONES.append(z)
    if build:
        m = zone_mat("zone_" + zid, z)
        O = Vector(O_tex) + U * u0 + V * v0
        hl = [(h[0] - u0, h[1] - u0, h[2] - v0, h[3] - v0) for h in holes]
        ob = rect_with_holes("Z_" + zid, O, U, V, u1 - u0, v1 - v0, hl, m, facing)
        ob["zone"] = zid
        ZONE_OBJS[zid] = ob
    return z

# ------------------------------------------------------------------ shared props
def stove_fire(cx, cy, z0, w, d, h, strength, light_power):
    """Ember bed, charred logs, flame cards and a fire light inside a firebox volume."""
    emb = img_mat("embers", f"{TEX}/embers.jpg", rough=0.9)
    nt = emb.node_tree; p = nt.nodes["Principled BSDF"]
    it = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    link(nt, it.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 6.0 * strength
    bed = box("embers", (cx - w / 2, cy - d / 2, z0), (cx + w / 2, cy + d / 2, z0 + 0.025), emb)
    char = mat("charred", (0.03, 0.025, 0.02), rough=0.9, bump=0.6, bump_scale=30)
    for i, (dx, rr, rot) in enumerate([(-0.07, 0.042, 0.25), (0.07, 0.04, -0.2), (0.0, 0.036, 0.05)]):
        lg = cyl(f"flog{i}", (cx + dx, cy, z0 + 0.045 + (0.05 if i == 2 else 0)), rr, w * 0.8, char, axis="X")
        lg.rotation_euler = (0, math.pi / 2, rot)
    for i, (dx, sw, sh, k) in enumerate([(-0.08, 0.16, 0.30, 0), (0.0, 0.2, 0.36, 1), (0.08, 0.15, 0.28, 2), (0.03, 0.12, 0.22, 3)]):
        fm = flame_mat(f"flame{i}", f"{TEX}/flame{k}.png", 7.0 * strength)
        sh = min(sh, h * 0.8)
        fc = quad(f"flamecard{i}", (cx + dx - sw / 2, cy - 0.02 * i, z0 + 0.04), (sw, 0, 0), (0, 0, sh), fm, (0, 1, 0))
        fc.visible_shadow = False
    L = bpy.data.lights.new("fire", "POINT"); L.energy = light_power; L.color = (1.0, 0.45, 0.13)
    L.shadow_soft_size = 0.05
    lo = add_obj("firelight", L); lo.location = (cx, cy + d * 0.25, z0 + 0.12)
    lo.visible_camera = False; lo.visible_glossy = False; lo.visible_transmission = False
    return lo

def hearth_fire(cx, cy, z0, w, d, strength, light_power):
    """An open wood fire across a fireplace grate: an ember bed, charred logs and a row of flame
    cards, with an area light at the front of the fire facing the room (named "firelight", so the
    fire pass isolates it). For the masonry fireplace (1 Nov 2026); stove_fire is a stove's."""
    emb = img_mat("embers_h", f"{TEX}/embers.jpg", rough=0.9)
    nt = emb.node_tree; p = nt.nodes["Principled BSDF"]
    it = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    link(nt, it.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 5.0 * strength
    box("embers", (cx - w / 2, cy - d / 2, z0), (cx + w / 2, cy + d / 2, z0 + 0.02), emb)
    char = mat("charred_h", (0.035, 0.028, 0.022), rough=0.9, bump=0.6, bump_scale=30)
    for i, (dx, dy, dz, rr, ln, rot) in enumerate([(-0.02, 0.05, 0.05, 0.05, w * 0.95, 0.04), (0.03, -0.04, 0.05, 0.045, w * 0.9, -0.05),
                                                   (0.0, 0.0, 0.13, 0.04, w * 0.75, 0.10), (-0.12, 0.0, 0.10, 0.035, 0.30, 0.9)]):
        lg = cyl(f"hlog{i}", (cx + dx, cy + dy, z0 + dz), rr, ln, char, axis="X")
        lg.rotation_euler = (0, math.pi / 2, rot)
    n = 8
    for i in range(n):
        x = cx - w * 0.4 + (w * 0.8) * i / (n - 1)
        sw, sh = 0.13, 0.22 + 0.10 * abs(math.sin(i * 1.9)) + (0.06 if i in (3, 4) else 0.0)
        fm = flame_mat(f"hflame{i}", f"{TEX}/flame{i % 4}.png", 7.0 * strength)
        fc = quad(f"flamecard{i}", (x - sw / 2, cy + 0.03 - 0.025 * (i % 3), z0 + 0.05), (sw, 0, 0), (0, 0, sh), fm, (0, 1, 0))
        fc.visible_shadow = False
    L = bpy.data.lights.new("fire", "AREA"); L.shape = "RECTANGLE"; L.size = w * 0.85; L.size_y = 0.22
    L.energy = light_power; L.color = (1.0, 0.47, 0.15)
    lo = add_obj("firelight", L); lo.location = (cx, cy + d / 2 + 0.03, z0 + 0.16)
    lo.rotation_euler = (math.pi / 2, 0, 0)          # faces +y, into the room
    lo.visible_camera = False; lo.visible_glossy = False; lo.visible_transmission = False
    return lo

def flamecard_uv_fix(ob):
    uvl = ob.data.uv_layers[0]
    # quad() writes metres; flame textures need 0..1
    for poly in ob.data.polygons:
        for k, li in enumerate(poly.loop_indices):
            pass

def stove_trad(cx, cy_back, z0, M):
    """Traditional cast-iron wood stove. Returns (top_center_xyz, flue_xy)."""
    W, D = 0.62, 0.50
    y0, y1 = cy_back, cy_back + D
    iron = M["iron"]
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f"leg{sx}{sy}", (cx + sx * (W / 2 - 0.05), (y0 + y1) / 2 + sy * (D / 2 - 0.06), z0 + 0.07), 0.028, 0.14, iron, r2=0.02)
    box("ashbase", (cx - W / 2 - 0.01, y0 - 0.01, z0 + 0.14), (cx + W / 2 + 0.01, y1 + 0.01, z0 + 0.21), iron, bevel=0.008)
    body = box("body", (cx - W / 2, y0, z0 + 0.21), (cx + W / 2, y1, z0 + 0.66), iron, bevel=0.018, segs=3)
    cav = box("cav", (cx - 0.25, y0 + 0.05, z0 + 0.26), (cx + 0.25, y1 + 0.05, z0 + 0.61))
    boolean_cut(body, cav, M["firebrick"])
    box("top", (cx - W / 2 - 0.035, y0 - 0.035, z0 + 0.66), (cx + W / 2 + 0.035, y1 + 0.035, z0 + 0.69), iron, bevel=0.01, segs=3)
    box("topcap", (cx - W / 2 + 0.04, y0 + 0.02, z0 + 0.69), (cx + W / 2 - 0.04, y1 - 0.06, z0 + 0.705), iron, bevel=0.006)
    door = box("door", (cx - 0.235, y1 - 0.005, z0 + 0.255), (cx + 0.235, y1 + 0.03, z0 + 0.62), iron, bevel=0.012, segs=3)
    win = box("doorwin", (cx - 0.18, y1 - 0.05, z0 + 0.30), (cx + 0.18, y1 + 0.08, z0 + 0.575))
    boolean_cut(door, win)
    box("glass", (cx - 0.185, y1 + 0.006, z0 + 0.295), (cx + 0.185, y1 + 0.012, z0 + 0.58), M["glass"])
    # door detailing: raised rim and hinges, coil handle
    box("rimT", (cx - 0.20, y1 + 0.03, z0 + 0.585), (cx + 0.20, y1 + 0.04, z0 + 0.6), iron, bevel=0.004)
    box("rimB", (cx - 0.20, y1 + 0.03, z0 + 0.275), (cx + 0.20, y1 + 0.04, z0 + 0.29), iron, bevel=0.004)
    for hz in (0.33, 0.55):
        cyl(f"hinge{hz}", (cx - 0.245, y1 + 0.02, z0 + hz), 0.012, 0.05, iron)
    h = cyl("handle", (cx + 0.26, y1 + 0.045, z0 + 0.45), 0.011, 0.11, M["nickel"], axis="Y")
    h.location = (cx + 0.255, y1 + 0.09, z0 + 0.45)
    for k in range(9):
        cyl(f"coil{k}", (cx + 0.255, y1 + 0.075 + k * 0.012, z0 + 0.45), 0.016, 0.006, M["nickel"], axis="Y", verts=16)
    box("ashlip", (cx - 0.2, y1, z0 + 0.15), (cx + 0.2, y1 + 0.03, z0 + 0.2), iron, bevel=0.006)
    # side panels with embossed frames
    for sx in (-1, 1):
        box(f"side{sx}", (cx + sx * (W / 2) + (0 if sx > 0 else -0.012), y0 + 0.06, z0 + 0.28),
            (cx + sx * (W / 2) + (0.012 if sx > 0 else 0), y1 - 0.06, z0 + 0.6), iron, bevel=0.004)
    stove_fire(cx, (y0 + y1) / 2 + 0.03, z0 + 0.27, 0.40, 0.28, 0.32, 1.0, 40.0 if LIGHT == "eve" else 22.0)
    flue = (cx, y0 + 0.11)
    cyl("collar", (cx, flue[1], z0 + 0.72), 0.085, 0.04, iron)
    return z0 + 0.74, flue

def stove_modern(cx, cy_back, z0, M):
    W, D = 0.56, 0.48
    y0, y1 = cy_back, cy_back + D
    steel = M["steel"]
    box("ped", (cx - 0.13, y0 + 0.12, z0), (cx + 0.13, y1 - 0.1, z0 + 0.22), steel, bevel=0.006)
    box("pedplate", (cx - 0.2, y0 + 0.06, z0), (cx + 0.2, y1 - 0.04, z0 + 0.012), steel, bevel=0.003)
    body = box("body", (cx - W / 2, y0, z0 + 0.22), (cx + W / 2, y1, z0 + 0.98), steel, bevel=0.008, segs=3)
    cav = box("cav", (cx - 0.22, y0 + 0.05, z0 + 0.27), (cx + 0.22, y1 + 0.05, z0 + 0.88))
    boolean_cut(body, cav, M["firebrick"])
    door = box("door", (cx - W / 2 + 0.008, y1 - 0.002, z0 + 0.25), (cx + W / 2 - 0.008, y1 + 0.018, z0 + 0.92), steel, bevel=0.004)
    win = box("doorwin", (cx - 0.225, y1 - 0.04, z0 + 0.30), (cx + 0.225, y1 + 0.05, z0 + 0.86))
    boolean_cut(door, win)
    box("glass", (cx - 0.228, y1 + 0.004, z0 + 0.296), (cx + 0.228, y1 + 0.009, z0 + 0.864), M["glass"])
    box("handle", (cx + W / 2 - 0.006, y1 - 0.03, z0 + 0.48), (cx + W / 2 + 0.018, y1 + 0.03, z0 + 0.74), M["steel_light"], bevel=0.004)
    box("topplate", (cx - W / 2, y0, z0 + 0.98), (cx + W / 2, y1, z0 + 0.995), M["steel_light"], bevel=0.003)
    stove_fire(cx, (y0 + y1) / 2 + 0.03, z0 + 0.28, 0.38, 0.26, 0.5, 1.15, 46.0 if LIGHT == "eve" else 26.0)
    flue = (cx, y0 + 0.12)
    cyl("collar", (cx, flue[1], z0 + 1.015), 0.082, 0.04, steel)
    return z0 + 1.03, flue

def armchair(x, y, rot, M):
    parts = []
    leather = M["leather"]
    parts.append(box("ch_base", (-0.42, -0.42, 0.12), (0.42, 0.42, 0.44), leather, bevel=0.05, segs=3))
    parts.append(box("ch_back", (-0.42, 0.22, 0.12), (0.42, 0.42, 0.92), leather, bevel=0.06, segs=3))
    parts.append(box("ch_armL", (-0.42, -0.42, 0.12), (-0.27, 0.42, 0.66), leather, bevel=0.06, segs=3))
    parts.append(box("ch_armR", (0.27, -0.42, 0.12), (0.42, 0.42, 0.66), leather, bevel=0.06, segs=3))
    parts.append(box("ch_seat", (-0.27, -0.40, 0.42), (0.27, 0.22, 0.54), leather, bevel=0.05, segs=3))
    parts.append(box("ch_cush", (-0.27, 0.08, 0.5), (0.27, 0.24, 0.86), leather, bevel=0.06, segs=3))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(cyl(f"ch_leg{sx}{sy}", (sx * 0.36, sy * 0.36, 0.06), 0.022, 0.12, M["walnut"], r2=0.016))
    piv = bpy.data.objects.new("chair", None); COL.objects.link(piv)
    for p in parts:
        p.parent = piv
    piv.location = (x, y, 0); piv.rotation_euler = (0, 0, rot)
    for p in parts[:6]:
        subsurf(p, 1)
    return piv

def log_stack(x0, x1, y0, y1, z0, M, seed=3):
    import random
    rnd = random.Random(seed)
    bark = M["bark"]; endg = M["endgrain"]
    x = x0
    layer_z = z0
    rows = [(0, 4), (1, 3), (2, 2)]
    span = x1 - x0
    for lvl, n in rows:
        r = span / (2 * 4)
        for k in range(n):
            rr = r * rnd.uniform(0.82, 1.0)
            cxp = x0 + r + lvl * r + k * 2 * r + rnd.uniform(-0.006, 0.006)
            cz = z0 + r + lvl * r * 1.72
            L = (y1 - y0) * rnd.uniform(0.88, 1.0)
            lg = cyl(f"log{lvl}{k}", (cxp, (y0 + y1) / 2 + rnd.uniform(-0.02, 0.02), cz), rr, L, bark, axis="Y", verts=14, cap_mat=endg)
            lg.rotation_euler = (math.pi / 2, rnd.uniform(0, 6.28), rnd.uniform(-0.04, 0.04))

def window(name, wall, a0, a1, z0, z1, M, depth=0.14, mull=True):
    """Window frame/trim/sill into an opening already cut in a wall.
    wall: 'back' (plane y=0, facing +y) or 'left' (plane x=X0, facing +x)."""
    trim = M["trim"]; tw = 0.085; tp = 0.02
    def B(n, a, b, c, d, e, f):
        if wall == "back":
            box(f"{name}{n}", (a, c, e), (b, d, f), trim, bevel=0.004)
        elif wall == "left":
            X = WALL_X
            box(f"{name}{n}", (X + c, a, e), (X + d, b, f), trim, bevel=0.004)
        else:
            X = RIGHT_X
            box(f"{name}{n}", (X - d, a, e), (X - c, b, f), trim, bevel=0.004)
    # interior trim (casing)
    B("cl", a0 - tw, a0, 0, tp, z0, z1 + tw)
    B("cr", a1, a1 + tw, 0, tp, z0, z1 + tw)
    B("ct", a0 - tw, a1 + tw, 0, tp, z1, z1 + tw)
    B("sill", a0 - tw - 0.03, a1 + tw + 0.03, -depth, 0.05, z0 - 0.03, z0)
    B("apron", a0 - tw + 0.01, a1 + tw - 0.01, 0, tp, z0 - 0.11, z0 - 0.03)
    # jambs (opening reveal)
    B("jl", a0, a0 + 0.02, -depth, 0, z0, z1)
    B("jr", a1 - 0.02, a1, -depth, 0, z0, z1)
    B("jt", a0, a1, -depth, 0, z1 - 0.02, z1)
    # sash frame + mullions
    fz = -depth * 0.55
    B("sl", a0 + 0.02, a0 + 0.07, fz - 0.03, fz, z0, z1)
    B("sr", a1 - 0.07, a1 - 0.02, fz - 0.03, fz, z0, z1)
    B("st", a0 + 0.02, a1 - 0.02, fz - 0.03, fz, z1 - 0.07, z1 - 0.02)
    B("sb", a0 + 0.02, a1 - 0.02, fz - 0.03, fz, z0, z0 + 0.06)
    if mull:
        mid = (a0 + a1) / 2
        B("mv", mid - 0.025, mid + 0.025, fz - 0.03, fz, z0, z1)
        mz = z0 + (z1 - z0) * 0.62
        B("mh", a0 + 0.02, a1 - 0.02, fz - 0.03, fz, mz - 0.02, mz + 0.02)

def haze_mat(eve):
    m = bpy.data.materials.new("haze"); nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lp = nt.nodes.new("ShaderNodeLightPath")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.75, 0.82, 0.92, 1) if not eve else (0.16, 0.2, 0.32, 1)
    em.inputs["Strength"].default_value = 2.2 if not eve else 0.35
    mixa = nt.nodes.new("ShaderNodeMixShader"); mixa.inputs["Fac"].default_value = 0.72
    link(nt, tr.outputs[0], mixa.inputs[1]); link(nt, em.outputs[0], mixa.inputs[2])
    mixb = nt.nodes.new("ShaderNodeMixShader")
    link(nt, lp.outputs["Is Camera Ray"], mixb.inputs["Fac"])
    link(nt, tr.outputs[0], mixb.inputs[1]); link(nt, mixa.outputs[0], mixb.inputs[2])
    link(nt, mixb.outputs[0], out.inputs["Surface"])
    return m

def haze(name, wall, a0, a1, z0, z1, eve):
    m = haze_mat(eve)
    if wall == "back":
        quad(name, (a0 - 0.2, -0.35, z0 - 0.2), (a1 - a0 + 0.4, 0, 0), (0, 0, z1 - z0 + 0.4), m, (0, 1, 0))
    elif wall == "left":
        quad(name, (WALL_X - 0.35, a0 - 0.2, z0 - 0.2), (0, a1 - a0 + 0.4, 0), (0, 0, z1 - z0 + 0.4), m, (1, 0, 0))
    else:
        quad(name, (RIGHT_X + 0.35, a0 - 0.2, z0 - 0.2), (0, a1 - a0 + 0.4, 0), (0, 0, z1 - z0 + 0.4), m, (-1, 0, 0))

def portal(name, wall, a0, a1, z0, z1):
    L = bpy.data.lights.new(name, "AREA"); L.shape = "RECTANGLE"
    L.size = a1 - a0; L.size_y = z1 - z0
    L.cycles.is_portal = True
    lo = add_obj(name, L)
    if wall == "back":
        lo.location = ((a0 + a1) / 2, -0.05, (z0 + z1) / 2)
        lo.rotation_euler = (math.pi / 2, 0, 0)   # area light faces -Z local -> rotate to face +y
    elif wall == "left":
        lo.location = (WALL_X - 0.05, (a0 + a1) / 2, (z0 + z1) / 2)
        lo.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    else:
        lo.location = (RIGHT_X + 0.05, (a0 + a1) / 2, (z0 + z1) / 2)
        lo.rotation_euler = (math.pi / 2, 0, math.pi / 2)

def outdoors(M, eve):
    gnd = mat("ground", (0.12, 0.16, 0.08) if not eve else (0.05, 0.06, 0.05), rough=1.0, var=0.25, var_scale=0.3)
    quad("ground", (-80, -80, -0.3), (160, 0, 0), (0, 160, 0), gnd, (0, 0, 1))
    water = mat("lake", (0.02, 0.05, 0.07), rough=0.08, spec=0.5)
    quad("lake", (-60, -70, -0.28), (120, 0, 0), (0, 55, 0), water, (0, 0, 1))
    pine = mat("pine", (0.03, 0.07, 0.04) if not eve else (0.015, 0.02, 0.018), rough=0.9, var=0.3, var_scale=2)
    trunk = mat("trunk", (0.08, 0.05, 0.03), rough=0.9)
    import random
    rnd = random.Random(7)
    for i in range(70):
        x = rnd.uniform(-45, 30); y = rnd.uniform(-75, -12)
        if -30 < x < 10 and y > -45:
            continue  # leave a gap to see the lake
        h = rnd.uniform(9, 20); r = h * rnd.uniform(0.18, 0.24)
        cyl(f"tree{i}", (x, y, h / 2 - 0.3), r, h, pine, r2=0.0, verts=10, smooth=False)
    for i in range(30):
        x = rnd.uniform(-80, 60); y = rnd.uniform(-140, -95)
        h = rnd.uniform(12, 24); r = h * 0.22
        cyl(f"ftree{i}", (x, y, h / 2 - 0.3), r, h, pine, r2=0.0, verts=8, smooth=False)
    for i in range(5):
        x = rnd.uniform(-8, -3); y = rnd.uniform(-9, -5)
        h = rnd.uniform(10, 15)
        cyl(f"near{i}", (x, y, h / 2 - 0.3), h * 0.2, h, pine, r2=0.0, verts=12, smooth=False)
        cyl(f"trk{i}", (x, y, 0.5), 0.15, 1.6, trunk, verts=8)

def world(eve):
    w = bpy.data.worlds.new("w"); SC.world = w
    nt = w.node_tree
    bg = nt.nodes["Background"]
    sky = nt.nodes.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False
    sky.sun_elevation = math.radians(-4 if eve else 26)
    sky.sun_rotation = math.radians(250)
    link(nt, sky.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = (0.25 if eve else 0.7)
    return w

# ------------------------------------------------------------------ scene: cabin great room
WALL_X = -3.6
RIGHT_X = 3.6

def build_cabin():
    global WALL_X, RIGHT_X
    WALL_X = -3.6; RIGHT_X = 3.6
    eve = LIGHT == "eve"
    M = {
        "paint": mat("paint", (0.66, 0.62, 0.56), rough=0.95, spec=0.2),
        "trim": mat("trim", (0.82, 0.80, 0.76), rough=0.45, spec=0.4),
        "floor": img_mat("floor", f"{TEX}/oak_floor.jpg", rough=0.42, scale=(0.5, 0.5), height=f"{TEX}/oak_floor_h.png", bump=0.25, spec=0.5),
        "ceiling": img_mat("ceiling", f"{TEX}/pine_ceiling.jpg", rough=0.6, scale=(1 / 2.4, 1 / 2.4), height=f"{TEX}/pine_ceiling_h.png", bump=0.35),
        "rug": img_mat("rug", f"{TEX}/lodge_rug.jpg", rough=0.95, spec=0.1),
        "timber": img_mat("timber", f"{TEX}/timber.jpg", rough=0.7, scale=(0.5, 0.5), height=f"{TEX}/timber_h.png", bump=0.5, coord="Object", proj="BOX", blend=0.2),
        "slab": mat("slab", (0.16, 0.16, 0.155), rough=0.55, bump=0.25, bump_scale=8, var=0.12, var_scale=3),
        "iron": mat("iron", (0.02, 0.02, 0.02), rough=0.55, metal=0.0, spec=0.45, bump=0.15, bump_scale=120),
        "steel": mat("steel", (0.016, 0.016, 0.017), rough=0.42, spec=0.5),
        "steel_light": mat("steel_l", (0.05, 0.05, 0.05), rough=0.3, metal=0.6),
        "nickel": mat("nickel", (0.7, 0.68, 0.64), rough=0.25, metal=1.0),
        "glass": glass_mat("glass"),
        "firebrick": mat("firebrick", (0.09, 0.05, 0.035), rough=0.9, bump=0.5, bump_scale=40),
        "leather": mat("leather", (0.26, 0.11, 0.045), rough=0.42, spec=0.45, bump=0.12, bump_scale=180, var=0.18, var_scale=3),
        "walnut": mat("walnut", (0.06, 0.035, 0.02), rough=0.5),
        "bark": mat("bark", (0.07, 0.05, 0.035), rough=0.95, bump=1.0, bump_scale=25, var=0.3, var_scale=6),
        "endgrain": mat("endgrain", (0.36, 0.25, 0.15), rough=0.9, bump=0.2, bump_scale=60, var=0.2, var_scale=12),
        "pipe": mat("pipe", (0.018, 0.018, 0.018), rough=0.5, spec=0.4),
        "brass": mat("brass", (0.6, 0.45, 0.2), rough=0.3, metal=1.0),
        "ceramic": mat("ceramic", (0.32, 0.36, 0.33), rough=0.25, spec=0.6),
        "shade": fabric_shade_mat("shade", (0.82, 0.76, 0.64)),
        "wood_tbl": mat("wood_tbl", (0.22, 0.13, 0.07), rough=0.45, var=0.15, var_scale=20),
    }
    RX0, RX1, RY1, RZ = -3.6, 3.6, 7.2, 2.9
    CW, CD = 1.83, 0.46          # chimney breast 6 ft wide, 18 in deep
    HW, HD, HH, ST = 2.44, 1.66, 0.41, 0.05   # hearth 8 ft x 65 in x 16 in, slab 2 in
    cx0, cx1 = -CW / 2, CW / 2
    hx0, hx1 = -HW / 2, HW / 2
    win_b = (-3.05, -1.75, 0.80, 2.45)
    # room shell
    quad("floor", (RX0, 0, 0), (RX1 - RX0, 0, 0), (0, RY1, 0), M["floor"], (0, 0, 1))
    c = quad("ceiling", (RX0, 0, RZ), (RX1 - RX0, 0, 0), (0, RY1, 0), M["ceiling"], (0, 0, -1))
    # ceiling boards run along y: rotate uv
    uvl = c.data.uv_layers[0]
    for d in uvl.data:
        d.uv = (d.uv[1], d.uv[0])
    rect_with_holes("wall_left", (RX0, 0, 0), (0, 1, 0), (0, 0, 1), RY1, RZ, [(1.2, 2.5, 0.8, 2.45), (3.3, 4.6, 0.8, 2.45)], M["paint"], (1, 0, 0))
    rect_with_holes("wall_right", (RX1, 0, 0), (0, 1, 0), (0, 0, 1), RY1, RZ, [(1.4, 2.7, 0.8, 2.45), (3.5, 4.8, 0.8, 2.45)], M["paint"], (-1, 0, 0))
    quad("wall_front", (RX0, RY1, 0), (RX1 - RX0, 0, 0), (0, 0, RZ), M["paint"], (0, -1, 0))
    window("wr1", "right", 1.4, 2.7, 0.8, 2.45, M)
    window("wr2", "right", 3.5, 4.8, 0.8, 2.45, M)
    portal("pr1", "right", 1.4, 2.7, 0.8, 2.45)
    portal("pr2", "right", 3.5, 4.8, 0.8, 2.45)
    # crown/base trim
    for nm, a, b in [("base_back", RX0, RX1)]:
        box(nm, (a, 0, 0), (b, 0.015, 0.11), M["trim"], bevel=0.003)
    box("base_right", (RX1 - 0.015, 0, 0), (RX1, RY1, 0.11), M["trim"])
    box("base_left", (RX0, 0, 0), (RX0 + 0.015, RY1, 0.11), M["trim"])
    # zones -----------------------------------------------------------
    zone("chim_front", "chimney", "Chimney face", (cx0, CD, 0), (1, 0, 0), (0, 0, 1), 0, CW, HH, RZ, (0, 1, 0),
         corners=[["v", 0.0, HH, RZ], ["v", CW, HH, RZ]])
    zone("chim_right", "chimney", "Chimney side", (cx1, CD, 0), (0, -1, 0), (0, 0, 1), 0, CD, HH, RZ, (1, 0, 0), u_off=CW)
    zone("chim_left", "chimney", "Chimney side (far)", (cx0, 0, 0), (0, 1, 0), (0, 0, 1), 0, CD, HH, RZ, (-1, 0, 0),
         u_off=-CD, visible=False)
    zone("hearth_front", "hearth", "Hearth face", (hx0, HD, 0), (1, 0, 0), (0, 0, 1), 0, HW, 0, HH - ST, (0, 1, 0),
         corners=[["v", 0.0, 0, HH - ST], ["v", HW, 0, HH - ST]])
    zone("hearth_right", "hearth", "Hearth side", (hx1, HD, 0), (0, -1, 0), (0, 0, 1), 0, HD, 0, HH - ST, (1, 0, 0), u_off=HW)
    zone("hearth_left", "hearth", "Hearth side (far)", (hx0, 0, 0), (0, 1, 0), (0, 0, 1), 0, HD, 0, HH - ST, (-1, 0, 0),
         u_off=-HD, visible=False)
    bh = [(win_b[0] - RX0, win_b[1] - RX0, win_b[2], win_b[3])]
    zone("wall_back", "wall", "Wall beside the chimney", (RX0, 0, 0), (1, 0, 0), (0, 0, 1), 0, RX1 - RX0, 0, RZ, (0, 1, 0),
         holes=bh + [(cx0 - RX0, cx1 - RX0, 0, RZ), (hx0 - RX0, cx0 - RX0, 0, HH), (cx1 - RX0, hx1 - RX0, 0, HH)])
    # hidden returns are geometry too (light bounce)
    # hearth top slab: not a stone surface, but the customer can change its finish (gray, charcoal,
    # black), so it gets a mask like the zones. Group "pad" keeps it out of the lighting statistics.
    slab = box("hearth_slab", (hx0 - 0.025, 0, HH - ST), (hx1 + 0.025, HD + 0.025, HH), M["slab"], bevel=0.008)
    slab["zone"] = "hearth_top"
    zone("hearth_top", "pad", "Hearth pad", (hx0 - 0.025, 0, HH), (1, 0, 0), (0, 1, 0), 0, HW + 0.05, 0, HD + 0.025, (0, 0, 1),
         build=False)
    # chimney top / ceiling junction is implicit
    window("wb", "back", win_b[0], win_b[1], win_b[2], win_b[3], M)
    window("wl1", "left", 1.2, 2.5, 0.8, 2.45, M)
    window("wl2", "left", 3.3, 4.6, 0.8, 2.45, M)
    portal("pb", "back", win_b[0], win_b[1], win_b[2], win_b[3])
    haze("hz_b", "back", win_b[0], win_b[1], win_b[2], win_b[3], eve)
    portal("pl1", "left", 1.2, 2.5, 0.8, 2.45)
    portal("pl2", "left", 3.3, 4.6, 0.8, 2.45)
    # mantel
    box("mantel", (-0.80, CD, 2.20), (0.80, CD + 0.21, 2.39), M["timber"], bevel=0.012, segs=2)
    # stove + pipe
    if VARIANT == "open":
        # Empty hearth for catalog stoves (the app stands a stove cutout here): no stove, pipe or
        # thimble. In the evening a door-sized warm light where a typical stove's glass would be,
        # facing the room, stands in for the fire, so the hearth and the room get the glow. It is
        # named "firelight", so the fire pass isolates it and the app can take it away when no stove
        # is shown. Stove spot: back at y = CD + 0.22, centred on x = 0, standing on the slab (z = HH).
        if eve:
            Lf = bpy.data.lights.new("fire", "AREA"); Lf.shape = "RECTANGLE"; Lf.size = 0.40; Lf.size_y = 0.30
            Lf.energy = 16.0; Lf.color = (1.0, 0.45, 0.13)
            lo = add_obj("firelight", Lf); lo.location = (0.0, CD + 0.22 + 0.50, HH + 0.45)
            lo.rotation_euler = (math.pi / 2, 0, 0)       # area lights shine along local -Z: this faces +y, into the room
            lo.visible_camera = False; lo.visible_glossy = False; lo.visible_transmission = False
        if os.environ.get("PROBE"):
            # a matte white box the size of a stove where catalog stoves stand: renders with it measure
            # the light on a stove's front, side and top, and the shadow it casts (PROBE="w,d,h" metres)
            pw, pd, ph = [float(v) for v in os.environ["PROBE"].split(",")]
            box("probe", (-pw / 2, CD + 0.22, HH), (pw / 2, CD + 0.22 + pd, HH + ph), mat("probe", (0.8, 0.8, 0.8), rough=0.95, spec=0.1))
    else:
        if VARIANT == "trad":
            top, flue = stove_trad(0.0, CD + 0.22, HH, M)
            bend_z = 1.62
        else:
            top, flue = stove_modern(0.0, CD + 0.22, HH, M)
            bend_z = 1.80
        R = 0.13
        pts = [(flue[0], flue[1], top - 0.01)]
        pts.append((flue[0], flue[1], bend_z - R))
        for k in range(1, 12):
            th = math.pi / 2 * k / 12
            pts.append((flue[0], flue[1] - R + R * math.cos(th), bend_z - R + R * math.sin(th)))
        pts.append((flue[0], CD - 0.05, bend_z))
        pipe("stovepipe", pts, 0.0762, M["pipe"])
        for zz in [top + 0.18, top + 0.42]:
            if zz < bend_z - R - 0.05:
                cyl(f"pipeband{zz:.2f}", (flue[0], flue[1], zz), 0.081, 0.018, M["pipe"])
        cyl("thimble", (flue[0], CD + 0.006, bend_z), 0.13, 0.012, M["pipe"], axis="Y")
    # firewood stack on hearth (left of stove)
    log_stack(hx0 + 0.06, -0.47, CD + 0.18, CD + 0.62, HH, M)
    # rug, chair, side table, lamp
    box("rug", (-1.35, HD + 0.35, 0), (1.25, HD + 2.05, 0.012), M["rug"], bevel=0.004)
    r = ALL_OBJS[-1]
    me = r.data
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = ((v.x + 1.3) / 2.6, (v.y + 0.85) / 1.7)
    cyl("tbl_top", (2.15, 1.25, 0.6), 0.27, 0.035, M["wood_tbl"], verts=48)
    cyl("tbl_post", (2.15, 1.25, 0.3), 0.04, 0.58, M["wood_tbl"])
    cyl("tbl_foot", (2.15, 1.25, 0.02), 0.2, 0.03, M["wood_tbl"], verts=48)
    cyl("lamp_base", (2.15, 1.22, 0.75), 0.075, 0.26, M["ceramic"], r2=0.05, verts=48)
    cyl("lamp_neck", (2.15, 1.22, 0.95), 0.008, 0.16, M["brass"])
    sh = cyl("lamp_shade", (2.15, 1.22, 1.08), 0.2, 0.24, M["shade"], r2=0.15, verts=64)
    # open-ended drum: delete caps
    me = sh.data; bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.9], context="FACES")
    bm.to_mesh(me); bm.free()
    # books + mug on table
    box("book1", (2.0, 1.12, 0.6175), (2.26, 1.32, 0.645), mat("book1", (0.25, 0.08, 0.06), rough=0.6), bevel=0.003)
    box("book2", (2.02, 1.13, 0.645), (2.24, 1.3, 0.668), mat("book2", (0.12, 0.18, 0.2), rough=0.6), bevel=0.003)
    # lights
    outdoors(M, eve)
    world(eve)
    if not eve:
        sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 7.0; sun.angle = math.radians(2.5)
        sun.color = (1.0, 0.93, 0.84)
        so = add_obj("sun", sun)
        # light travels toward -x (from the near-side windows), toward the back wall, downward
        d = Vector((-1.0, -0.42, -0.36)).normalized()
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    else:
        lp = bpy.data.lights.new("lamp", "POINT"); lp.energy = 28; lp.color = (1.0, 0.68, 0.38); lp.shadow_soft_size = 0.05
        add_obj("lamp", lp).location = (2.15, 1.22, 1.05)
        for sx in (-0.5, 0.5):
            sp = bpy.data.lights.new(f"can{sx}", "SPOT"); sp.energy = 55; sp.color = (1.0, 0.78, 0.55)
            sp.spot_size = math.radians(70); sp.spot_blend = 0.6; sp.shadow_soft_size = 0.03
            so = add_obj(f"can{sx}", sp); so.location = (sx, CD + 0.33, RZ - 0.02)
            d = Vector((0, -0.18, -1)).normalized()
            so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
            cyl(f"cantrim{sx}", (sx, CD + 0.33, RZ - 0.004), 0.07, 0.008, M["trim"])
        fill = bpy.data.lights.new("fill", "AREA"); fill.energy = 18; fill.size = 3; fill.color = (1.0, 0.8, 0.6)
        fo = add_obj("fill", fill); fo.location = (1.0, 5.5, 2.85); fo.rotation_euler = (0, 0, 0)
    # camera
    cam = bpy.data.cameras.new("cam"); cam.lens = 31; cam.sensor_width = 36; cam.sensor_fit = "HORIZONTAL"
    cam.shift_y = -0.03
    co = add_obj("cam", cam); SC.camera = co
    co.location = (1.30, 5.35, 1.22)
    tgt = Vector((-0.15, 0.0, 1.22))
    if os.environ.get("CAM_ALT"):
        cam.lens = 26; cam.shift_y = 0.0
        co.location = (-1.25, 4.1, 1.18)
        tgt = Vector((0.35, 0.0, 1.3))
    d = (tgt - co.location).normalized()
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    meta = dict(name="Lake cabin great room", room=dict(x=[RX0, RX1], y=[0, RY1], z=[0, RZ]),
                dims=dict(chimney_w=CW, chimney_d=CD, hearth_w=HW, hearth_d=HD, hearth_h=HH, ceiling=RZ),
                # where a catalog stove stands in the "open" variant (metres, scene axes: x right,
                # y out of the back wall, z up): centred on x, its back y_back off the back wall, on the
                # slab. The firewood stack starts at x = -0.47, so stoves up to max_w wide fit beside it;
                # the slab runs to y = hearth_d at the front.
                stove_spot=dict(x=0.0, y_back=round(CD + 0.22, 4), z=HH, max_w=0.90,
                                hearth_front_y=HD, chimney_face_y=CD, thimble_z=1.62))
    return meta

# ------------------------------------------------------------------ scene: linear gas fireplace
def build_linear():
    global WALL_X
    eve = LIGHT == "eve"
    WALL_X = -3.0
    M = {
        "paint": mat("paint", (0.78, 0.77, 0.74), rough=0.95, spec=0.2),
        "trim": mat("trim", (0.84, 0.83, 0.80), rough=0.45, spec=0.4),
        "floor": img_mat("floor", f"{TEX}/pale_oak_floor.jpg", rough=0.38, scale=(1 / 2.4, 1 / 2.4), spec=0.5),
        "timber": img_mat("timber", f"{TEX}/timber.jpg", rough=0.65, scale=(0.5, 0.5), height=f"{TEX}/timber_h.png", bump=0.4, coord="Object", proj="BOX", blend=0.2, tint=(0.95, 0.85, 0.75)),
        "black": mat("black", (0.012, 0.012, 0.012), rough=0.5),
        "glass": glass_mat("glass", (0.9, 0.9, 0.9)),
        "firebrick": mat("fbox", (0.015, 0.015, 0.016), rough=0.35, spec=0.6),
        "sofa": mat("sofa", (0.36, 0.38, 0.36), rough=0.95, spec=0.15, bump=0.25, bump_scale=300, var=0.08, var_scale=8),
        "pillow": mat("pillow", (0.55, 0.32, 0.18), rough=0.95, spec=0.1, bump=0.2, bump_scale=300),
        "walnut": mat("walnut", (0.08, 0.045, 0.025), rough=0.4),
        "ceramic": mat("ceramic", (0.75, 0.72, 0.66), rough=0.3, spec=0.6),
        "ceramic2": mat("ceramic2", (0.1, 0.12, 0.13), rough=0.35, spec=0.6),
        "nickel": mat("nickel", (0.7, 0.68, 0.64), rough=0.25, metal=1.0),
        "rug": mat("rug2", (0.62, 0.58, 0.52), rough=1.0, spec=0.05, bump=0.35, bump_scale=400, var=0.06, var_scale=2),
        "media": mat("media", (0.04, 0.05, 0.06), rough=0.15, spec=0.8, bump=0.8, bump_scale=200),
    }
    RX0, RX1, RY1, RZ = -3.0, 3.0, 6.5, 2.75
    CW, CD = 2.13, 0.41   # 7 ft chase, 16 in deep
    cx0, cx1 = -CW / 2, CW / 2
    FW, FH, FZ = 1.32, 0.42, 0.50  # 52 in x 16.5 in viewing area, 20 in off floor
    quad("floor", (RX0, 0, 0), (RX1 - RX0, 0, 0), (0, RY1, 0), M["floor"], (0, 0, 1))
    quad("ceiling", (RX0, 0, RZ), (RX1 - RX0, 0, 0), (0, RY1, 0), M["paint"], (0, 0, -1))
    rect_with_holes("wall_left", (RX0, 0, 0), (0, 1, 0), (0, 0, 1), RY1, RZ, [(0.9, 2.3, 0.7, 2.3)], M["paint"], (1, 0, 0))
    quad("wall_right", (RX1, 0, 0), (0, RY1, 0), (0, 0, RZ), M["paint"], (-1, 0, 0))
    quad("wall_front", (RX0, RY1, 0), (RX1 - RX0, 0, 0), (0, 0, RZ), M["paint"], (0, -1, 0))
    box("base_left", (RX0, 0, 0), (RX0 + 0.015, RY1, 0.1), M["trim"])
    box("base_right", (RX1 - 0.015, 0, 0), (RX1, RY1, 0.1), M["trim"])
    for a, b in [(RX0, cx0), (cx1, RX1)]:
        box(f"base_back{a}", (a, 0, 0), (b, 0.015, 0.1), M["trim"])
    fx0, fx1 = -FW / 2, FW / 2
    # "open": the wall with no fireplace in it, for catalog fireplaces (the app draws one's front on
    # the bump-out at its real size, any size). The fire's light stays, as a stand-in (below).
    # Built here, 1 Nov 2026 (Ben: "let's get it dialed here").
    empty = VARIANT == "open"
    zone("chase_front", "chase", "Fireplace wall", (cx0, CD, 0), (1, 0, 0), (0, 0, 1), 0, CW, 0, RZ, (0, 1, 0),
         holes=[] if empty else [(fx0 - cx0 - 0.02, fx1 - cx0 + 0.02, FZ - 0.02, FZ + FH + 0.02)],
         corners=[["v", 0.0, 0, RZ], ["v", CW, 0, RZ]])
    zone("chase_left", "chase", "Fireplace wall side (left)", (cx0, 0, 0), (0, 1, 0), (0, 0, 1), 0, CD, 0, RZ, (-1, 0, 0), u_off=-CD)
    zone("chase_right", "chase", "Fireplace wall side (right)", (cx1, CD, 0), (0, -1, 0), (0, 0, 1), 0, CD, 0, RZ, (1, 0, 0),
         u_off=CW, visible=False)
    zone("wall_back", "wall", "Wall beside the fireplace", (RX0, 0, 0), (1, 0, 0), (0, 0, 1), 0, RX1 - RX0, 0, RZ, (0, 1, 0),
         holes=[(cx0 - RX0, cx1 - RX0, 0, RZ)])
    if not empty:
        # fireplace box (recessed) behind opening
        yb = CD - 0.30
        box("fb_back", (fx0, yb - 0.02, FZ - 0.02), (fx1, yb, FZ + FH + 0.02), M["firebrick"])
        box("fb_top", (fx0, yb, FZ + FH), (fx1, CD, FZ + FH + 0.02), M["firebrick"])
        box("fb_bot", (fx0, yb, FZ - 0.02), (fx1, CD, FZ), M["firebrick"])
        box("fb_l", (fx0 - 0.02, yb, FZ - 0.02), (fx0, CD, FZ + FH + 0.02), M["firebrick"])
        box("fb_r", (fx1, yb, FZ - 0.02), (fx1 + 0.02, CD, FZ + FH + 0.02), M["firebrick"])
        # trim frame (thin black surround) and glass
        t = 0.022
        box("frT", (fx0 - t, CD, FZ + FH), (fx1 + t, CD + 0.006, FZ + FH + t), M["black"])
        box("frB", (fx0 - t, CD, FZ - t), (fx1 + t, CD + 0.006, FZ), M["black"])
        box("frL", (fx0 - t, CD, FZ), (fx0, CD + 0.006, FZ + FH), M["black"])
        box("frR", (fx1, CD, FZ), (fx1 + t, CD + 0.006, FZ + FH), M["black"])
        box("fglass", (fx0, CD - 0.03, FZ), (fx1, CD - 0.025, FZ + FH), M["glass"])
        # media bed + burner flames (row of flame cards)
        box("media", (fx0 + 0.02, yb, FZ), (fx1 - 0.02, CD - 0.05, FZ + 0.05), M["media"], bevel=0.005)
        n = 9
        for i in range(n):
            x = fx0 + 0.09 + (FW - 0.18) * i / (n - 1)
            fm = flame_mat(f"lflame{i}", f"{TEX}/flame{i % 4}.png", 9.0)
            sw, sh = 0.16, 0.24 + 0.06 * math.sin(i * 1.7)
            fc = quad(f"lfc{i}", (x - sw / 2, yb + 0.12 + 0.02 * (i % 2), FZ + 0.045), (sw, 0, 0), (0, 0, sh), fm, (0, 1, 0))
            fc.visible_shadow = False
    L = bpy.data.lights.new("fire", "AREA"); L.shape = "RECTANGLE"; L.size = FW * 0.8; L.size_y = 0.12
    L.energy = (60 if eve else 30) * FIRE_OPEN_K if empty else (60 if eve else 30); L.color = (1.0, 0.5, 0.18)
    lo = add_obj("firelight", L); lo.rotation_euler = (math.pi / 2, 0, 0)
    # with no firebox the stand-in sits just in front of the wall, where the glass was, facing the room;
    # FIRE_OPEN_K matches the glow the room gets from its own fireplace (measured with fire passes)
    lo.location = (0, CD + 0.004, FZ + 0.16) if empty else (0, CD - 0.06, FZ + 0.16)
    lo.visible_camera = False; lo.visible_glossy = False; lo.visible_transmission = False
    # floating mantel
    box("mantel", (-1.0, CD, 1.42), (1.0, CD + 0.24, 1.565), M["timber"], bevel=0.008)
    # decor on mantel
    cyl("vase1", (-0.72, CD + 0.11, 1.565 + 0.16), 0.07, 0.32, M["ceramic"], r2=0.045, verts=48)
    cyl("vase2", (-0.55, CD + 0.12, 1.565 + 0.09), 0.055, 0.18, M["ceramic2"], r2=0.05, verts=48)
    box("frame", (0.30, CD + 0.03, 1.565), (0.85, CD + 0.06, 1.565 + 0.62), M["walnut"], bevel=0.006)
    box("art", (0.34, CD + 0.06, 1.565 + 0.04), (0.81, CD + 0.062, 1.565 + 0.58), mat("art", (0.55, 0.6, 0.62), rough=0.8, var=0.35, var_scale=3))
    # window on left wall
    window("wl", "left", 0.9, 2.3, 0.7, 2.3, M, mull=False)
    portal("pl", "left", 0.9, 2.3, 0.7, 2.3)
    haze("hz_l", "left", 0.9, 2.3, 0.7, 2.3, eve)
    # sofa (back to camera, foreground right) and rug
    piv = bpy.data.objects.new("sofa", None); COL.objects.link(piv)
    parts = [
        box("sf_base", (-1.05, -0.45, 0.10), (1.05, 0.45, 0.42), M["sofa"], bevel=0.05, segs=3),
        box("sf_back", (-1.05, 0.25, 0.10), (1.05, 0.45, 0.82), M["sofa"], bevel=0.06, segs=3),
        box("sf_armL", (-1.05, -0.45, 0.10), (-0.88, 0.45, 0.62), M["sofa"], bevel=0.06, segs=3),
        box("sf_armR", (0.88, -0.45, 0.10), (1.05, 0.45, 0.62), M["sofa"], bevel=0.06, segs=3),
        box("sf_c1", (-0.88, -0.42, 0.40), (0.0, 0.26, 0.52), M["sofa"], bevel=0.05, segs=3),
        box("sf_c2", (0.0, -0.42, 0.40), (0.88, 0.26, 0.52), M["sofa"], bevel=0.05, segs=3),
        box("sf_p1", (-0.80, 0.05, 0.50), (-0.40, 0.22, 0.88), M["pillow"], bevel=0.07, segs=3),
    ]
    for p in parts:
        p.parent = piv
        subsurf(p, 1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            l = cyl(f"sf_leg{sx}{sy}", (sx * 0.98, sy * 0.38, 0.05), 0.02, 0.1, M["walnut"])
            l.parent = piv
    piv.location = (0.55, 3.55, 0); piv.rotation_euler = (0, 0, math.radians(8))
    box("rug", (-1.4, 1.2, 0), (1.6, 3.9, 0.012), M["rug"], bevel=0.004)
    # coffee table
    box("ct_top", (-0.55, 1.95, 0.40), (0.55, 2.55, 0.44), M["walnut"], bevel=0.006)
    for sx in (-1, 1):
        box(f"ct_leg{sx}", (sx * 0.5 - 0.03, 2.0, 0.0), (sx * 0.5 + 0.03, 2.5, 0.40), M["walnut"], bevel=0.004)
    cyl("bowl", (0.1, 2.25, 0.47), 0.13, 0.06, M["ceramic2"], r2=0.09, verts=48)
    outdoors(M, eve)
    world(eve)
    if not eve:
        sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 5.0; sun.angle = math.radians(3.0)
        sun.color = (1.0, 0.95, 0.88)
        so = add_obj("sun", sun)
        d = Vector((1.0, -0.35, -0.42)).normalized()
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    else:
        for sx in (-0.6, 0.6):
            sp = bpy.data.lights.new(f"can{sx}", "SPOT"); sp.energy = 50; sp.color = (1.0, 0.8, 0.58)
            sp.spot_size = math.radians(70); sp.spot_blend = 0.6; sp.shadow_soft_size = 0.03
            so = add_obj(f"can{sx}", sp); so.location = (sx, CD + 0.3, RZ - 0.02)
            d = Vector((0, -0.18, -1)).normalized()
            so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
            cyl(f"cantrim{sx}", (sx, CD + 0.3, RZ - 0.004), 0.07, 0.008, M["trim"])
        fl = bpy.data.lights.new("floorlamp", "POINT"); fl.energy = 30; fl.color = (1.0, 0.68, 0.4); fl.shadow_soft_size = 0.1
        add_obj("floorlamp", fl).location = (2.4, 2.6, 1.5)
        fill = bpy.data.lights.new("fill", "AREA"); fill.energy = 14; fill.size = 3; fill.color = (1.0, 0.8, 0.6)
        add_obj("fill", fill).location = (0.5, 5.0, 2.7)
    cam = bpy.data.cameras.new("cam"); cam.lens = 33; cam.sensor_width = 36; cam.sensor_fit = "HORIZONTAL"
    cam.shift_y = -0.045
    co = add_obj("cam", cam); SC.camera = co
    co.location = (-1.45, 5.55, 1.22)
    tgt = Vector((0.32, 0.0, 1.22))
    d = (tgt - co.location).normalized()
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    meta = dict(name="Lake home family room", room=dict(x=[RX0, RX1], y=[0, RY1], z=[0, RZ]),
                dims=dict(chase_w=CW, chase_d=CD, fire_w=FW, fire_h=FH, fire_z=FZ, ceiling=RZ))
    return meta

# ------------------------------------------------------------------ scene: masonry fireplace (inserts)
def build_masonry():
    """A den with a masonry fireplace: a stone chimney breast, a raised hearth, and an open firebox
    with a wood fire. Catalog inserts are drawn into its opening (their front and surround, flat on
    the breast's face, standing on the firebox floor). Built on the site's computer, 1 Nov 2026 (Ben
    chose "the insert options" next)."""
    global WALL_X, RIGHT_X
    eve = LIGHT == "eve"
    WALL_X = -3.2; RIGHT_X = 3.2
    M = {
        "paint": mat("paint", (0.70, 0.67, 0.60), rough=0.95, spec=0.2),
        "trim": mat("trim", (0.82, 0.80, 0.76), rough=0.45, spec=0.4),
        "floor": img_mat("floor", f"{TEX}/oak_floor.jpg", rough=0.42, scale=(0.5, 0.5), height=f"{TEX}/oak_floor_h.png", bump=0.25, spec=0.5),
        "ceiling": mat("ceiling", (0.80, 0.79, 0.76), rough=0.95, spec=0.1),
        "rug": img_mat("rug", f"{TEX}/lodge_rug.jpg", rough=0.95, spec=0.1),
        "timber": img_mat("timber", f"{TEX}/timber.jpg", rough=0.7, scale=(0.5, 0.5), height=f"{TEX}/timber_h.png", bump=0.5, coord="Object", proj="BOX", blend=0.2),
        "slab": mat("slab", (0.16, 0.16, 0.155), rough=0.55, bump=0.25, bump_scale=8, var=0.12, var_scale=3),
        "iron": mat("iron", (0.02, 0.02, 0.02), rough=0.55, spec=0.45, bump=0.15, bump_scale=120),
        "firebrick": mat("firebrick", (0.055, 0.032, 0.024), rough=0.9, bump=0.5, bump_scale=40, var=0.3, var_scale=9),
        "soot": mat("soot", (0.012, 0.011, 0.010), rough=0.95),
        "leather": mat("leather", (0.26, 0.11, 0.045), rough=0.42, spec=0.45, bump=0.12, bump_scale=180, var=0.18, var_scale=3),
        "walnut": mat("walnut", (0.06, 0.035, 0.02), rough=0.5),
        "bark": mat("bark", (0.07, 0.05, 0.035), rough=0.95, bump=1.0, bump_scale=25, var=0.3, var_scale=6),
        "endgrain": mat("endgrain", (0.36, 0.25, 0.15), rough=0.9, bump=0.2, bump_scale=60, var=0.2, var_scale=12),
        "brass": mat("brass", (0.6, 0.45, 0.2), rough=0.3, metal=1.0),
        "ceramic": mat("ceramic", (0.62, 0.58, 0.50), rough=0.3, spec=0.6),
        "ceramic2": mat("ceramic2", (0.10, 0.12, 0.13), rough=0.35, spec=0.6),
        "shade": fabric_shade_mat("shade", (0.82, 0.76, 0.64)),
        "wood_tbl": mat("wood_tbl", (0.22, 0.13, 0.07), rough=0.45, var=0.15, var_scale=20),
    }
    RX0, RX1, RY1, RZ = -3.2, 3.2, 6.8, 2.75
    CW, CD = 1.83, 0.56            # chimney breast 6 ft wide, 22 in deep, floor to ceiling
    HD, HZ, ST = 0.51, 0.20, 0.05  # raised hearth 20 in deep, 8 in high, the breast's width; its top slab 2 in
    OW, OH, FD = 0.864, 0.610, 0.50   # firebox opening 34 x 24 in, 20 in deep; its floor is the hearth top
    BW = 0.60                      # firebox back wall 23-1/2 in (splayed sides)
    cx0, cx1 = -CW / 2, CW / 2
    ox0, ox1, oz0, oz1 = -OW / 2, OW / 2, HZ, HZ + OH
    yb = CD - FD                   # firebox back
    win_l = (1.0, 2.5, 0.75, 2.35)  # left wall window: y from, y to, z from, z to
    # room shell
    quad("floor", (RX0, 0, 0), (RX1 - RX0, 0, 0), (0, RY1, 0), M["floor"], (0, 0, 1))
    quad("ceiling", (RX0, 0, RZ), (RX1 - RX0, 0, 0), (0, RY1, 0), M["ceiling"], (0, 0, -1))
    rect_with_holes("wall_left", (RX0, 0, 0), (0, 1, 0), (0, 0, 1), RY1, RZ, [(win_l[0], win_l[1], win_l[2], win_l[3])], M["paint"], (1, 0, 0))
    quad("wall_right", (RX1, 0, 0), (0, RY1, 0), (0, 0, RZ), M["paint"], (-1, 0, 0))
    quad("wall_front", (RX0, RY1, 0), (RX1 - RX0, 0, 0), (0, 0, RZ), M["paint"], (0, -1, 0))
    box("base_left", (RX0, 0, 0), (RX0 + 0.015, RY1, 0.11), M["trim"])
    box("base_right", (RX1 - 0.015, 0, 0), (RX1, RY1, 0.11), M["trim"])
    for a, b in [(RX0, cx0), (cx1, RX1)]:
        box(f"base_back{a}", (a, 0, 0), (b, 0.015, 0.11), M["trim"])
    # zones: the breast's face (with the firebox opening), its sides, the hearth's face and side, the wall
    zone("breast_front", "breast", "Fireplace face", (cx0, CD, 0), (1, 0, 0), (0, 0, 1), 0, CW, HZ, RZ, (0, 1, 0),
         holes=[(ox0 - cx0, ox1 - cx0, oz0, oz1)],
         corners=[["v", 0.0, HZ, RZ], ["v", CW, HZ, RZ]])
    zone("breast_right", "breast", "Fireplace side", (cx1, CD, 0), (0, -1, 0), (0, 0, 1), 0, CD, HZ, RZ, (1, 0, 0), u_off=CW)
    zone("breast_left", "breast", "Fireplace side (far)", (cx0, 0, 0), (0, 1, 0), (0, 0, 1), 0, CD, HZ, RZ, (-1, 0, 0),
         u_off=-CD, visible=False)
    zone("hearth_front", "hearth", "Hearth face", (cx0, CD + HD, 0), (1, 0, 0), (0, 0, 1), 0, CW, 0, HZ - ST, (0, 1, 0),
         corners=[["v", 0.0, 0, HZ - ST], ["v", CW, 0, HZ - ST]])
    zone("hearth_right", "hearth", "Hearth side", (cx1, CD + HD, 0), (0, -1, 0), (0, 0, 1), 0, CD + HD, 0, HZ - ST, (1, 0, 0), u_off=CW)
    zone("hearth_left", "hearth", "Hearth side (far)", (cx0, 0, 0), (0, 1, 0), (0, 0, 1), 0, CD + HD, 0, HZ - ST, (-1, 0, 0),
         u_off=-(CD + HD), visible=False)
    zone("wall_back", "wall", "Wall beside the fireplace", (RX0, 0, 0), (1, 0, 0), (0, 0, 1), 0, RX1 - RX0, 0, RZ, (0, 1, 0),
         holes=[(cx0 - RX0, cx1 - RX0, 0, RZ)])
    # hearth top: a slab whose finish the customer can change (group "pad", like the cabin's)
    slab = box("hearth_slab", (cx0 - 0.02, 0, HZ - ST), (cx1 + 0.02, CD + HD + 0.02, HZ), M["slab"], bevel=0.008)
    slab["zone"] = "hearth_top"
    zone("hearth_top", "pad", "Hearth pad", (cx0 - 0.02, 0, HZ), (1, 0, 0), (0, 1, 0), 0, CW + 0.04, 0, CD + HD + 0.02, (0, 0, 1),
         build=False)
    # firebox: firebrick floor, back and splayed sides; soot-dark smoke shelf above the opening
    bx0, bx1 = -BW / 2, BW / 2
    box("fb_floor", (ox0, yb, oz0 - 0.02), (ox1, CD, oz0), M["firebrick"])
    quad("fb_back", (bx0, yb, oz0), (BW, 0, 0), (0, 0, OH), M["firebrick"], (0, 1, 0))
    mesh("fb_left", [(ox0, CD, oz0), (bx0, yb, oz0), (bx0, yb, oz1), (ox0, CD, oz1)], [(0, 1, 2, 3)], M["firebrick"])
    mesh("fb_right", [(bx1, yb, oz0), (ox1, CD, oz0), (ox1, CD, oz1), (bx1, yb, oz1)], [(0, 1, 2, 3)], M["firebrick"])
    box("fb_top", (ox0, yb, oz1), (ox1, CD, oz1 + 0.03), M["soot"])
    # the open wood fire on a grate (room's own; inserts are drawn over the opening)
    for gx in (-0.2, -0.1, 0.0, 0.1, 0.2):
        box(f"grate{gx}", (gx - 0.008, yb + 0.12, oz0), (gx + 0.008, CD - 0.10, oz0 + 0.07), M["iron"])
    box("grate_rail", (-0.24, CD - 0.115, oz0 + 0.05), (0.24, CD - 0.10, oz0 + 0.075), M["iron"])
    hearth_fire(0.0, yb + 0.27, oz0 + 0.07, 0.52, 0.26, 1.15, 50.0 if eve else 28.0)
    # mantel and what's on it
    box("mantel", (-0.98, CD, 1.40), (0.98, CD + 0.22, 1.53), M["timber"], bevel=0.008)
    cyl("vase1", (-0.70, CD + 0.10, 1.53 + 0.13), 0.06, 0.26, M["ceramic"], r2=0.04, verts=48)
    cyl("vase2", (-0.54, CD + 0.12, 1.53 + 0.08), 0.05, 0.16, M["ceramic2"], r2=0.045, verts=48)
    box("frame", (0.28, CD + 0.03, 1.53), (0.80, CD + 0.06, 1.53 + 0.58), M["walnut"], bevel=0.006)
    box("art", (0.32, CD + 0.06, 1.53 + 0.04), (0.76, CD + 0.062, 1.53 + 0.54), mat("art", (0.42, 0.48, 0.44), rough=0.8, var=0.35, var_scale=3))
    # a few split logs on the hearth, left of the opening
    log_stack(cx0 + 0.05, cx0 + 0.40, CD + 0.06, CD + 0.42, HZ, M, seed=11)
    # window on the left wall: the afternoon sun comes in here
    window("wl", "left", win_l[0], win_l[1], win_l[2], win_l[3], M)
    portal("pl", "left", win_l[0], win_l[1], win_l[2], win_l[3])
    haze("hz_l", "left", win_l[0], win_l[1], win_l[2], win_l[3], eve)
    # rug, armchair (right, angled to the fire), side table and lamp
    box("rug", (-1.30, CD + HD + 0.35, 0), (1.30, CD + HD + 2.25, 0.012), M["rug"], bevel=0.004)
    r = ALL_OBJS[-1]
    me = r.data
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = ((v.x + 1.3) / 2.6, (v.y - CD - HD - 0.35) / 1.9)
    armchair(1.95, 2.45, math.radians(-38), M)   # its seat faces -y; turned toward the fire
    cyl("tbl_top", (2.35, 1.55, 0.6), 0.25, 0.035, M["wood_tbl"], verts=48)
    cyl("tbl_post", (2.35, 1.55, 0.3), 0.04, 0.58, M["wood_tbl"])
    cyl("tbl_foot", (2.35, 1.55, 0.02), 0.2, 0.03, M["wood_tbl"], verts=48)
    cyl("lamp_base", (2.35, 1.52, 0.75), 0.075, 0.26, M["ceramic2"], r2=0.05, verts=48)
    cyl("lamp_neck", (2.35, 1.52, 0.95), 0.008, 0.16, M["brass"])
    sh = cyl("lamp_shade", (2.35, 1.52, 1.08), 0.2, 0.24, M["shade"], r2=0.15, verts=64)
    me = sh.data; bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.9], context="FACES")
    bm.to_mesh(me); bm.free()
    # lights
    outdoors(M, eve)
    world(eve)
    if not eve:
        sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 6.0; sun.angle = math.radians(2.5)
        sun.color = (1.0, 0.94, 0.86)
        so = add_obj("sun", sun)
        d = Vector((1.0, -0.40, -0.40)).normalized()    # in through the left window, toward the back wall
        so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    else:
        lp = bpy.data.lights.new("lamp", "POINT"); lp.energy = 28; lp.color = (1.0, 0.68, 0.38); lp.shadow_soft_size = 0.05
        add_obj("lamp", lp).location = (2.35, 1.52, 1.05)
        for sx in (-0.55, 0.55):
            sp = bpy.data.lights.new(f"can{sx}", "SPOT"); sp.energy = 45; sp.color = (1.0, 0.78, 0.55)
            sp.spot_size = math.radians(70); sp.spot_blend = 0.6; sp.shadow_soft_size = 0.03
            so = add_obj(f"can{sx}", sp); so.location = (sx, CD + 0.35, RZ - 0.02)
            d = Vector((0, -0.18, -1)).normalized()
            so.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
            cyl(f"cantrim{sx}", (sx, CD + 0.35, RZ - 0.004), 0.07, 0.008, M["trim"])
        fill = bpy.data.lights.new("fill", "AREA"); fill.energy = 16; fill.size = 3; fill.color = (1.0, 0.8, 0.6)
        add_obj("fill", fill).location = (0.5, 5.2, 2.7)
    # camera: near-frontal, a little from the right (inserts are drawn flat on the breast's face)
    cam = bpy.data.cameras.new("cam"); cam.lens = 30; cam.sensor_width = 36; cam.sensor_fit = "HORIZONTAL"
    cam.shift_y = -0.05
    co = add_obj("cam", cam); SC.camera = co
    co.location = (0.85, 4.30, 1.15)
    tgt = Vector((0.45, 0.0, 1.15))
    d = (tgt - co.location).normalized()
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    meta = dict(name="Lake house den", room=dict(x=[RX0, RX1], y=[0, RY1], z=[0, RZ]),
                dims=dict(breast_w=CW, breast_d=CD, hearth_d=HD, hearth_h=HZ, opening_w=OW, opening_h=OH,
                          firebox_d=FD, ceiling=RZ),
                # where a catalog insert goes (metres, scene axes): on the breast's face (y), centred on
                # x, standing on the firebox floor (z, anchor "floor"); its front has to cover the
                # opening (cover: x0, z0, x1, z1; a centimetre in from the floor)
                fire_spot=dict(y=CD, x=0.0, z=HZ, anchor="floor",
                               cover=[round(ox0, 4), round(oz0 + 0.01, 4), round(ox1, 4), round(oz1, 4)]))
    return meta

# ------------------------------------------------------------------ build + render
meta = build_cabin() if SCENE == "cabin" else build_linear() if SCENE == "linear" else build_masonry()
for ob in ALL_OBJS:
    if ob.name.startswith("flamecard") or ob.name.startswith("lfc"):
        uvl = ob.data.uv_layers[0]
        for poly in ob.data.polygons:
            for li in poly.loop_indices:
                vi = ob.data.loops[li].vertex_index
                uvl.data[li].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][vi]

R = SC.render
R.engine = "CYCLES"
SC.cycles.device = "CPU"
R.resolution_x, R.resolution_y = 1800, 1200
R.resolution_percentage = SCALE
R.film_transparent = False
R.filter_size = 1.5
SC.cycles.samples = SPP
SC.cycles.use_adaptive_sampling = True
SC.cycles.adaptive_threshold = 0.012
SC.cycles.use_denoising = True
SC.cycles.max_bounces = 6
SC.cycles.diffuse_bounces = 4
SC.cycles.glossy_bounces = 3
SC.cycles.transmission_bounces = 6
SC.cycles.transparent_max_bounces = 16
SC.cycles.sample_clamp_indirect = 8.0
SC.cycles.caustics_reflective = False
SC.cycles.caustics_refractive = False
SC.cycles.blur_glossy = 1.0
s = R.image_settings
s.media_type = "IMAGE"
s.file_format = "OPEN_EXR"; s.color_depth = "32"; s.exr_codec = "ZIP"; s.color_mode = "RGB"
R.filepath = OUT

if MODE == "geo":
    cam = SC.camera
    bpy.context.view_layer.update()
    mw = [list(r) for r in cam.matrix_world]
    data = dict(scene=SCENE, variant=VARIANT, meta=meta,
                camera=dict(matrix_world=mw, lens=cam.data.lens, sensor_width=cam.data.sensor_width,
                            shift_x=cam.data.shift_x, shift_y=cam.data.shift_y,
                            res=[R.resolution_x, R.resolution_y]),
                zones=ZONES, drywall=DRYWALL, tilt_deg=math.degrees(TILT))
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    print("geo written", OUT)
    sys.exit(0)

if MODE.startswith("mask"):
    order = [z["id"] for z in ZONES if z["visible"]]
    chunk = order[0:3] if MODE == "mask1" else order[3:6]
    black = emission_mat("black_em", (0, 0, 0), 0.0)
    cols = [(1, 0, 0), (0, 1, 0), (0, 0, 1)]
    for ob in list(SC.objects):
        if ob.type == "LIGHT":
            ob.hide_render = True
            continue
        if ob.type not in ("MESH", "CURVE"):
            continue
        zid = ob.get("zone")
        if zid in chunk:
            m = emission_mat("em_" + zid, cols[chunk.index(zid)], 1.0)
        else:
            m = black
        if hasattr(ob.data, "materials"):
            ob.data.materials.clear(); ob.data.materials.append(m)
            if ob.type == "MESH":
                for p in ob.data.polygons:
                    p.material_index = 0
    # booleans may transfer materials: force all slots
    w = SC.world; w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    SC.cycles.use_denoising = False
    SC.cycles.use_adaptive_sampling = False
    SC.cycles.max_bounces = 0
    SC.cycles.transparent_max_bounces = 16
    SC.cycles.samples = SPP
    with open(OUT + ".json", "w") as f:
        json.dump(chunk, f)

if MODE.startswith("tilt"):
    SC.cycles.adaptive_threshold = 0.02

if MODE == "dist":
    # distance from the camera to whatever each pixel sees (metres, in all three channels): with the
    # camera, this puts every pixel in the room, so a catalog stove's shadows can fall on anything
    em = bpy.data.materials.new("distem"); nt = em.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    cd = nt.nodes.new("ShaderNodeCameraData")
    es = nt.nodes.new("ShaderNodeEmission"); es.inputs["Strength"].default_value = 1.0
    cr = nt.nodes.new("ShaderNodeCombineColor")
    for i in range(3):
        link(nt, cd.outputs["View Distance"], cr.inputs[i])
    link(nt, cr.outputs[0], es.inputs["Color"])
    link(nt, es.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    for ob in list(SC.objects):
        if ob.type == "LIGHT":
            ob.hide_render = True
            continue
        if ob.name.startswith("hz_") or ob.name.startswith("flamecard"):
            ob.hide_render = True
            continue
        if ob.type in ("MESH", "CURVE") and hasattr(ob.data, "materials"):
            ob.data.materials.clear(); ob.data.materials.append(em)
            if ob.type == "MESH":
                for poly in ob.data.polygons:
                    poly.material_index = 0
    SC.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    SC.cycles.use_denoising = False
    SC.cycles.use_adaptive_sampling = False
    SC.cycles.max_bounces = 0
    SC.view_settings.view_transform = "Standard"
    R.filter_size = 0.01

if MODE == "sundirect":
    for ob in list(SC.objects):
        if ob.type == "LIGHT" and ob.name != "sun":
            ob.hide_render = True
        if ob.name.startswith("hz_"):
            ob.hide_render = True
    SC.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    SC.cycles.max_bounces = 0
    SC.cycles.use_denoising = False
    SC.cycles.adaptive_threshold = 0.03

if MODE == "fire":
    # only the fire lights the room: everything else off, sky black; used for the flicker share map
    for ob in list(SC.objects):
        if ob.type == "LIGHT" and ob.name != "firelight":
            ob.hide_render = True
    SC.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    for ob in list(SC.objects):
        if ob.name.startswith("hz_"):
            ob.hide_render = True
    SC.cycles.adaptive_threshold = 0.03

bpy.ops.render.render(write_still=True)
print("rendered", OUT)
