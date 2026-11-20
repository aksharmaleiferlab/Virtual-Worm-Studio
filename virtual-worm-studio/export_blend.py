import bpy, json, sys
from pathlib import Path
root=Path(__file__).resolve().parent
job=json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())
bpy.ops.wm.open_mainfile(filepath=str(Path(job['source']).resolve()),load_ui=False,use_scripts=False)
names=set(job['names'])
missing=names-set(bpy.data.objects.keys())
if missing: raise RuntimeError('Unknown objects: '+str(missing))
for name in names:
    if name not in bpy.context.scene.objects: bpy.context.scene.collection.objects.link(bpy.data.objects[name])
# Bake parent transforms before removing unselected objects. Never recenter cells.
for obj in list(bpy.data.objects):
    if obj.name in names and obj.parent is not None:
        world=obj.matrix_world.copy(); obj.parent=None; obj.matrix_world=world
for obj in list(bpy.data.objects):
    if obj.name not in names: bpy.data.objects.remove(obj,do_unlink=True)
for c in bpy.data.collections: c.hide_viewport=False; c.hide_render=False
for obj in bpy.data.objects:
    obj.hide_viewport=False; obj.hide_render=False; obj.hide_set(False)
# Viewer colors are sRGB hex; Blender shader colors use linear RGB.
def linear(channel):
    return channel/12.92 if channel <= 0.04045 else ((channel+0.055)/1.055)**2.4
for name,hex_color in job.get('colors',{}).items():
    if name not in names: raise ValueError('Color supplied for an unselected object')
    if len(hex_color)!=6 or any(c not in '0123456789abcdefABCDEF' for c in hex_color):raise ValueError('Invalid color')
    obj=bpy.data.objects[name]
    if obj.type not in {'MESH','CURVE','SURFACE','META','FONT'}:continue
    rgb=tuple(linear(int(hex_color[i:i+2],16)/255.0) for i in (0,2,4))
    material=bpy.data.materials.new('Figure_Color_'+name)
    material.diffuse_color=(*rgb,1.0);material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*rgb,1.0)
    shader.inputs['Roughness'].default_value=0.65
    obj.data=obj.data.copy()
    if obj.data.materials:
        for slot in range(len(obj.data.materials)):obj.data.materials[slot]=material
    else:obj.data.materials.append(material)
    obj['figure_color_srgb']='#'+hex_color.lower()
bpy.ops.wm.save_as_mainfile(filepath=job['output'])
print('EXPORTED',len(names))
