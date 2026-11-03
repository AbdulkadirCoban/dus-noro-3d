import bpy,sys,json,re,os
import numpy as np
blend,outdir=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend,load_ui=False,use_scripts=False)
want=["Frontal bone","Ethmoid bone","Sphenoid bone","Occipital bone","Temporal bone","Parietal bone","Maxilla","Palatine bone","Zygomatic bone","Nasal bone","Lacrimal bone","Inferior nasal concha bone","Vomer","Mandible","Atlas (C1)","Axis (C2)","Hyoid bone","Cavernous sinus","Basilar venous plexus","Tentorium cerebelli","Falx cerebri","Midbrain","Pons","Medulla oblongata","Cochlear nerve","Vestibule"]
names=set()
for w in want:
    names|={w,w+'.r',w+'.l'}
# Diş hekimliği katmanları. Yalnız sağ taraf alınır, sol taraf derlemede aynalanır.
# Z-Anatomy'de "Lateral temporomandibular ligament.l" hasta sağındadır (x<0), bu yüzden .l alınır.
teeth=[f"{a} {b}" for a in ("Upper","Lower") for b in ("medial incisor","lateral incisor","canine","first premolar","second premolar","first molar tooth","second molar tooth")]
muscles=["Superficial part of masseter","Deep part of masseter","Temporalis muscle","Medial pterygoid muscle","Inferior head of lateral pterygoid muscle","Superior head of lateral pterygoid muscle","Anterior belly of digastric muscle","Intermediate tendon of digastric muscle","Posterior belly of digastric muscle","Mylohyoid muscle","Geniohyoid muscle","Stylohyoid muscle","Genioglossus muscle","Hyoglossus muscle","Orbicularis oris muscle","Mentalis muscle","Depressor anguli oris","Depressor labii inferioris","Levator anguli oris","Levator labii superioris","Zygomaticus major muscle","Zygomaticus minor muscle","Risorius muscle","Articular disc of temporomandibular joint","Articular capsule of temporomandibular joint","Sphenomandibular ligament","Stylomandibular ligament"]
names|={n+'.r' for n in teeth+muscles}
names|={"Tongue","Lateral temporomandibular ligament.l"}
# Boyun (hyoid üstü ve altı, klavikulaya kadar), bezler, mimik ve boyun kasları, boyun üçgenleri
neck_mid=["Vertebra C3","Vertebra C4","Vertebra C5","Vertebra C6","Vertebra C7","Manubrium of sternum","Thyroid cartilage","Cricoid cartilage","Epiglottis","Trachea","Thyroid gland","Adenohypophysis","Neurohypophysis","Pineal gland"]
neck_r=["Clavicle","First rib","Costal cartilage of first rib","Parotid gland","(Accessory parotid gland)","Submandibular gland","Sublingual gland","Superior parathyroid gland","Inferior parathyroid gland","Lacrimal gland",
  "Sternocleidomastoid muscle","Platysma","Omohyoid muscle","Sternohyoid muscle","Sternothyroid muscle","Thyrohyoid muscle","Scalenus anterior muscle","Scalenus medius muscle","Scalenus posterior muscle","Ascending part of trapezius muscle","Levator scapulae","Splenius capitis muscle","Longus colli muscle","Longus capitis muscle","Superior pharyngeal constrictor","Middle pharyngeal constrictor","Inferior pharyngeal constrictor","Stylopharyngeus muscle",
  "Frontalis muscle","Occipitalis muscle","Epicranial aponeurosis","Temporoparietalis muscle","Procerus muscle","Corrugator supercilii","Orbital part of orbicularis oculi","Palpebral part of orbicularis oculi","Nasalis muscle","Depressor septi nasi","Levator palpebrae superioris",
  "Carotid triangle","Muscular triangle","Submandibular triangle","Submental triangle","Greater supraclavicular fossa","Lesser supraclavicular fossa","Sternocleidomastoid region"]
names|=set(neck_mid)|{n+'.r' for n in neck_r}|{"Sternocleidomastoid muscle.or","Sternocleidomastoid muscle.o1r","Sternocleidomastoid muscle.er"}
# Yapışma mesh'leri: .o* origo, .e* insersiyo
names|={"Masseter.or","Masseter.o1r","Masseter.er","Temporalis muscle.o1r","Temporalis muscle.o2r","Temporalis muscle.o3r","Temporalis muscle.o4r","Temporalis muscle.er","Medial pterygoid muscle.or","Medial pterygoid muscle.er","Lateral pterygoid muscle.or","Lateral pterygoid muscle.o1r","Anterior belly of digastric muscle.er","Geniohyoid muscle.or","Geniohyoid muscle.er","Mylohyoid muscle.or","Mentalis muscle.or","Depressor anguli oris.or","Depressor labii inferioris.or","Levator anguli oris.or","Levator labii superioris.or","Zygomaticus major muscle.or","Zygomaticus minor muscle.or","Orbicularis oris muscle.or"}
dg=bpy.context.evaluated_depsgraph_get()
idx={}
for o in bpy.data.objects:
    if o.type!='MESH' or o.name not in names: continue
    ev=o.evaluated_get(dg); m=ev.to_mesh(); m.calc_loop_triangles()
    w=np.array(o.matrix_world)
    v=np.zeros(len(m.vertices)*3,dtype=np.float64); m.vertices.foreach_get('co',v); v=v.reshape(-1,3)
    v=(v@w[:3,:3].T+w[:3,3])*1000
    t=np.zeros(len(m.loop_triangles)*3,dtype=np.int32); m.loop_triangles.foreach_get('vertices',t)
    fn=re.sub(r'[^A-Za-z0-9.]+','_',o.name)
    v.astype('f4').tofile(os.path.join(outdir,fn+'.pos')); t.astype('u4').tofile(os.path.join(outdir,fn+'.idx'))
    idx[o.name]=dict(file=fn,v=len(v),t=len(t)//3,min=v.min(0).round(1).tolist(),max=v.max(0).round(1).tolist())
    ev.to_mesh_clear()
json.dump(idx,open(os.path.join(outdir,'index.json'),'w'),indent=0)
print('exported',len(idx),sum(x['t'] for x in idx.values()))
# anchors: zero-face meshes (.j) with names of interest
pat=re.compile(r'(?i)foram|canal|fissure|hiatus|meatus|fossa|groove|sulcus for|lingula|notch|tubercle|incisive')
anch={}
for o in bpy.data.objects:
    if o.type=='MESH' and o.name.endswith('.j') and pat.search(o.name) and len(o.data.polygons)==0:
        wm=o.matrix_world
        vs=[wm@x.co for x in o.data.vertices]
        if vs and max(v.z for v in vs)>1.45:
            anch[o.name]=[[round(v.x*1000,1),round(v.y*1000,1),round(v.z*1000,1)] for v in vs][:6]
json.dump(anch,open(os.path.join(outdir,'anchors.json'),'w'),indent=0)
print('anchors',len(anch))
