import bpy,sys,json
from mathutils import Vector
from mathutils.geometry import interpolate_bezier
blend,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False,use_scripts=False)
res={}
for o in bpy.data.objects:
    if o.type!='CURVE': continue
    cs=[o.matrix_world@Vector(c) for c in o.bound_box]
    if max(c.z for c in cs)<1.40: continue
    w=o.matrix_world
    sp=[]
    for s in o.data.splines:
        pts=[]
        if s.type=='BEZIER':
            b=s.bezier_points
            n=len(b)
            for i in range(n-1+(1 if s.use_cyclic_u else 0)):
                a,c=b[i],b[(i+1)%n]
                seg=interpolate_bezier(a.co,a.handle_right,c.handle_left,c.co,7)
                if pts: seg=seg[1:]
                pts+=list(seg)
            if n==1: pts=[b[0].co]
        else:
            pts=[p.co.to_3d() for p in s.points]
        wp=[w@Vector(p) for p in pts]
        sp.append([[round(v.x*1000,2),round(v.y*1000,2),round(v.z*1000,2)] for v in wp])
    res[o.name]=sp
json.dump(res,open(out,'w'))
print('curves',len(res))
