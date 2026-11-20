"""Run with Blender --background --disable-autoexec --python prepare_model.py."""
import bpy, json, struct, sys
from pathlib import Path
from collections import Counter
ROOT = Path(__file__).resolve().parent
args = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
source = Path(args[0]).resolve() if args else ROOT / 'model/Virtual_Worm_February_2012.blend'
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
print('COLLECTIONS', [(c.name,len(c.objects)) for c in bpy.data.collections])
source_scene=set(o.name for o in bpy.context.scene.objects)
source_groups={o.name:[c.name for c in o.users_collection] for o in bpy.data.objects}
for o in list(bpy.data.objects):
    if o.name not in source_scene and not o.name.startswith('Guide') and o.type in {'MESH','CURVE','SURFACE','META'}:
        bpy.context.scene.collection.objects.link(o)
# Include hidden anatomical objects too; evaluate every cell without changing coordinates.
for c in bpy.data.collections: c.hide_viewport=False
for o in bpy.data.objects: o.hide_viewport=False; o.hide_set(False)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
objects=[]; binary=bytearray()
for obj in sorted(bpy.context.scene.objects, key=lambda o:o.name.lower()):
    if obj.type not in {'MESH','CURVE','SURFACE','META'}: continue
    evaluated=obj.evaluated_get(deps)
    mesh=evaluated.to_mesh()
    if not mesh or not mesh.vertices: continue
    mesh.calc_loop_triangles()
    positions=[float(v) for vertex in mesh.vertices for v in (obj.matrix_world @ vertex.co)]
    indices=[v for t in mesh.loop_triangles for v in t.vertices]
    po=len(binary); binary.extend(struct.pack('<%sf'%len(positions),*positions))
    io=len(binary); binary.extend(struct.pack('<%sI'%len(indices),*indices))
    materials=[m.name for m in obj.data.materials if m]
    mat=obj.active_material
    color=list(mat.diffuse_color[:3]) if mat else [0.5,0.7,0.7]
    objects.append(dict(name=obj.name,sourceInScene=obj.name in source_scene,groups=source_groups[obj.name],materials=materials,color=color,positionOffset=po,positionCount=len(positions),indexOffset=io,indexCount=len(indices)))
    evaluated.to_mesh_clear()
(ROOT/'web/model.bin').write_bytes(binary)
(ROOT/'web/catalog.json').write_text(json.dumps(dict(source=source.name,coordinateSystem='Original Blender world coordinates; no centering or scaling',objects=objects)))
print('PREPARED',len(objects),'objects',len(binary),'bytes')
