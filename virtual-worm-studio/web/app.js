import * as T from 'three';
import {SilhouetteRenderer} from './outline.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFExporter} from './vendor/GLTFExporter.js';
import {matchNames} from './selection.js';
import {exportFilename,embedViewInPng,readSavedView} from './view-files.js';
import {DEFAULT_UM_PER_UNIT,convertedLength,scaleBarLayout} from './scale.js';
const $=id=>document.getElementById(id), vp=$('viewport');
let scaleCanvas=null,previousScaleUnit='um',outlineView=null;
let outlinedNames=new Set();
$('scaleCalibration').value=DEFAULT_UM_PER_UNIT;
for(const b of document.querySelectorAll('button'))b.disabled=true;
let objects=[],meshes=[],selected=new Set(),customColors={},mode='whole',contextReturnMode='isolate',direction='front',extent=1,halfHeight=1;
const scene=new T.Scene(), anatomy=new T.Group();scene.add(anatomy);
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);vp.appendChild(renderer.domElement);
renderer.outputColorSpace=T.SRGBColorSpace;
const camera=new T.OrthographicCamera(-1,1,1,-1,0.001,1e6);camera.up.set(0,1,0);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;
scene.add(new T.HemisphereLight(0xffffff,0x7b8675,1.1));
const key=new T.DirectionalLight(0xffffff,1.7);key.position.set(1,2,4);camera.add(key);scene.add(camera);
function resize(){const w=vp.clientWidth,h=vp.clientHeight;renderer.setSize(w,h);camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();render();}
new ResizeObserver(resize).observe(vp);controls.addEventListener('change',render);
function render(){if(outlineView&&$('outlineEnabled').checked&&outlinedNames.size){outlineView.render(outlinedNames,outlineConfig(),vp.clientWidth);}else{renderer.render(scene,camera);}drawScaleOverlay();}
function bounds(list){const box=new T.Box3();for(const m of list)box.expandByObject(m);return box;}
function fit(onlySelected=false){const list=onlySelected?meshes.filter(m=>selected.has(m.name)):meshes.filter(m=>m.visible&&m.material.opacity>0.1);if(!list.length)return;const box=bounds(list),c=box.getCenter(new T.Vector3()),s=box.getSize(new T.Vector3());extent=Math.max(s.x,s.y,s.z,0.01);const aspect=vp.clientWidth/vp.clientHeight;let horizontal=s.y,vertical=s.x;const d=new T.Vector3(0,0,1);camera.up.set(1,0,0);if(direction==='side'){d.set(0,-1,0);camera.up.set(0,0,1);horizontal=s.x;vertical=s.z;}if(direction==='top'){d.set(1,0,0);camera.up.set(0,0,1);horizontal=s.y;vertical=s.z;}halfHeight=Math.max(vertical,horizontal/aspect,extent*.03)*.6;camera.position.copy(c).addScaledVector(d,extent*3);camera.near=extent/100000;camera.far=extent*20;camera.zoom=1;controls.target.copy(c);controls.minDistance=extent/10000;controls.maxDistance=extent*20;controls.update();resize();}
function refresh(){for(const [id,value] of [['whole','whole'],['isolate','isolate'],['context','context']]){$(id).classList.toggle('primary',mode===value);$(id).setAttribute('aria-pressed',String(mode===value));}$('context').textContent='Faint context: '+(mode==='context'?'On':'Off');for(const m of meshes){const yes=selected.has(m.name);m.visible=yes||((mode==='whole'||mode==='context')&&m.userData.sourceInScene);m.material.opacity=mode==='context'&&!yes?.065:1;m.material.transparent=m.material.opacity<1;m.material.depthWrite=m.material.opacity===1;m.material.emissive.setHex(0);}
$('count').textContent=`${selected.size} selected / ${objects.length} objects`;$('viewstate').textContent=mode==='isolate'?'Selected anatomy only':mode==='context'?'Selected anatomy + faint context':'Whole worm';for(const el of $('catalog').querySelectorAll('input'))el.checked=selected.has(el.dataset.name);updateColorControls();render();}
function showList(){const q=$('search').value.trim().toLowerCase();$('catalog').replaceChildren();for(const o of objects.filter(o=>o.name.toLowerCase().includes(q))){const label=document.createElement('label');label.className='cell';const cb=document.createElement('input');cb.type='checkbox';cb.dataset.name=o.name;cb.checked=selected.has(o.name);cb.onchange=()=>{if(cb.checked)selected.add(o.name);else selected.delete(o.name);refresh();};const span=document.createElement('span');span.textContent=o.name+(o.sourceInScene?'':' [stored]');label.title=o.groups.join(', ')+(o.sourceInScene?'':' · Stored outside original scene');label.append(cb,span);$('catalog').append(label);}}
function selectText(add=false){const {found,missing}=matchNames($('names').value,objects);if(!add)selected.clear();found.forEach(n=>selected.add(n));$('match').textContent=`${found.length} matched.${missing.length?' Not found: '+missing.join(', '):''}`;if(found.length){mode='isolate';refresh();fit(true);}else refresh();}
$('replace').onclick=()=>selectText();$('add').onclick=()=>selectText(true);
function selectGroup(add=false){const g=$('tissue').value;if(!g)return;if(!add)selected.clear();objects.filter(o=>o.groups.includes(g)).forEach(o=>selected.add(o.name));const extras=objects.filter(o=>selected.has(o.name)&&!o.sourceInScene);$('match').textContent=`${selected.size} selected.${extras.length?' Includes '+extras.length+' objects stored outside the original scene; marked [stored] in the list.':''}`;mode='isolate';refresh();fit(true);}
$('group').onclick=()=>selectGroup();$('addgroup').onclick=()=>selectGroup(true);$('search').oninput=showList;$('clear').onclick=()=>{selected.clear();mode='whole';refresh();fit();};
$('whole').onclick=()=>{mode='whole';refresh();fit();};$('isolate').onclick=()=>{if(!selected.size)return tell('Select cells first.');mode='isolate';refresh();fit(true);};$('context').onclick=()=>{if(mode==='context'){mode=contextReturnMode;}else{if(!selected.size)return tell('Select cells first.');contextReturnMode=mode==='whole'?'whole':'isolate';mode='context';}refresh();};$('fit').onclick=()=>fit(mode!=='whole');$('view').onchange=()=>{direction=$('view').value;fit(mode!=='whole');};
$('background').onchange=()=>{vp.style.background=$('background').value==='dark'?'#17232a':$('background').value==='white'?'#fff':'';render();};
function setCellColor(mesh,hex){
 if(hex){mesh.material.color.set(hex);customColors[mesh.name]=hex.replace('#','').toLowerCase();}
 else {mesh.material.color.setRGB(...mesh.userData.originalColor);delete customColors[mesh.name];}
}
function colorTargets(){
 const target=$('colorTarget').value;
 if(target==='selection')return meshes.filter(m=>selected.has(m.name));
 if(target.startsWith('cell:'))return meshes.filter(m=>m.name===target.slice(5));
 if(target==='names'){
  const result=matchNames($('names').value,objects);
  if(result.missing.length)throw Error('Unknown names: '+result.missing.join(', ')+'. Correct the list before coloring.');
  const names=new Set(result.found);return meshes.filter(m=>names.has(m.name));
 }
 return meshes.filter(m=>m.userData.groups.includes(target.slice(6)));
}
function updateColorControls(){
 $('colorCount').textContent='('+selected.size+')';
 if(!$('cellColors').open)return;
 const q=$('colorSearch').value.trim().toLowerCase(),fragment=document.createDocumentFragment();
 for(const mesh of meshes.filter(m=>selected.has(m.name)&&m.name.toLowerCase().includes(q))){
  const row=document.createElement('div');row.className='cell-color-row';
  const name=document.createElement('span');name.textContent=mesh.name;
  const input=document.createElement('input');input.type='color';input.value='#'+mesh.material.color.getHexString();input.setAttribute('aria-label','Color for '+mesh.name);
  input.oninput=()=>{setCellColor(mesh,input.value);render();};
  const reset=document.createElement('button');reset.textContent='Reset';reset.setAttribute('aria-label','Reset color for '+mesh.name);reset.onclick=()=>{setCellColor(mesh,null);updateColorControls();render();};
  const style=document.createElement('select');style.setAttribute('aria-label','Display style for '+mesh.name);
  for(const [value,label] of [['fill','Filled'],['outline','Outline']]){const option=document.createElement('option');option.value=value;option.textContent=label;style.append(option);}
  style.value=outlinedNames.has(mesh.name)?'outline':'fill';
  style.onchange=()=>{if(style.value==='outline'){outlinedNames.add(mesh.name);$('outlineEnabled').checked=true;}else outlinedNames.delete(mesh.name);updateOutlineControls();render();};
  row.append(name,input,reset,style);fragment.append(row);
 }
 $('colorList').replaceChildren(fragment);
}
$('cellColors').ontoggle=updateColorControls;$('colorSearch').oninput=updateColorControls;
function paintTarget(reset=false){
 const targets=colorTargets();if(!targets.length)throw Error('Choose cells or a tissue group first.');
 const wasEmpty=!selected.size;
 for(const mesh of targets){setCellColor(mesh,reset?null:$('color').value);selected.add(mesh.name);}
 mode='isolate';refresh();if(wasEmpty||$('colorTarget').value!=='selection')fit(true);
 tell((reset?'Restored original colors for ':'Applied '+$('color').value+' to ')+targets.length+' objects. Earlier colors are retained.');
}
$('recolor').onclick=()=>action(()=>paintTarget());$('original').onclick=()=>action(()=>paintTarget(true));
const ray=new T.Raycaster(),mouse=new T.Vector2();function hits(e){const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);return ray.intersectObjects(meshes.filter(m=>m.visible&&m.material.opacity>.1))[0];}
let down;renderer.domElement.onpointerdown=e=>{down=[e.clientX,e.clientY];};renderer.domElement.onpointerup=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const hit=hits(e);if(hit){const n=hit.object.name;selected.add(n);refresh();let option=$('clickedCellTarget');if(!option){option=document.createElement('option');option.id='clickedCellTarget';$('colorTarget').append(option);}option.value='cell:'+n;option.textContent='Cell: '+n;$('colorTarget').value=option.value;$('color').value='#'+hit.object.material.color.getHexString();tell('Cell '+n+' targeted for coloring. Click Apply color to change it.');}};renderer.domElement.onpointermove=e=>{$('hover').textContent=hits(e)?.object.name||'';};
function tell(s){$('exportstatus').textContent=s;}
let sessionToken='';
const settingsReady=fetch('/api/settings').then(r=>r.json()).then(s=>{sessionToken=s.token;$('destination').textContent=s.export_directory;showModelSetup(s);return s;});
async function download(data,name,type){await settingsReady;const blob=data instanceof Blob?data:new Blob([data],{type});const response=await fetch('/api/save?name='+encodeURIComponent(name),{method:'POST',headers:{'X-Worm-Token':sessionToken,'Content-Type':'application/octet-stream'},body:blob});const result=await response.json();if(!response.ok)throw Error(result.error);tell('Saved: '+result.path);return result;}
window.setExportDirectory=path=>action(async()=>{await settingsReady;const response=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Worm-Token':sessionToken},body:JSON.stringify({export_directory:path})});const result=await response.json();if(!response.ok)throw Error(result.error);$('destination').textContent=result.export_directory;$('folderEditor').hidden=true;tell('Export folder updated.');});
$('changeDirectory').onclick=()=>{if(window.webkit?.messageHandlers?.chooseExportFolder)window.webkit.messageHandlers.chooseExportFolder.postMessage({});else{$('folderEditor').hidden=false;$('folderPath').value=$('destination').textContent;}};
$('applyDirectory').onclick=()=>window.setExportDirectory($('folderPath').value);
function showModelSetup(s){
 $('modelPath').value=s.model_path||'';$('blenderPath').value=s.blender_path||'';
 $('modelSetupStatus').textContent=(s.model_available?'Original model found. ':'Original model not configured. ')+(s.blender_available?'Blender found.':'Blender not configured.');
}
$('saveModelConfig').onclick=()=>action(async()=>{await settingsReady;const response=await fetch('/api/model-config',{method:'POST',headers:{'Content-Type':'application/json','X-Worm-Token':sessionToken},body:JSON.stringify({model_path:$('modelPath').value,blender_path:$('blenderPath').value})});const data=await response.json();if(!response.ok)throw Error(data.error);showModelSetup(data);tell('Local model setup saved.');});

function scaleConfig(){return {enabled:$('scaleEnabled').checked,length:Number($('scaleLength').value),unit:$('scaleUnit').value,umPerUnit:Number($('scaleCalibration').value),position:$('scalePosition').value,ink:$('scaleInk').value};}
function restoreScaleConfig(config){
 const c=config||{};$('scaleEnabled').checked=!!c.enabled;$('scaleLength').value=c.length??100;
 $('scaleUnit').value=['nm','um','mm','model'].includes(c.unit)?c.unit:'um';previousScaleUnit=$('scaleUnit').value;
 $('scaleCalibration').value=c.umPerUnit??DEFAULT_UM_PER_UNIT;
 $('scalePosition').value=['bottom-left','bottom-right','top-left','top-right'].includes(c.position)?c.position:'bottom-left';
 $('scaleInk').value=['auto','dark','light'].includes(c.ink)?c.ink:'auto';$('scaleOptions').hidden=!c.enabled;
}
function drawScaleBar(ctx,width,height){
 const config=scaleConfig();if(!config.enabled)return;
 const layout=scaleBarLayout(config,{width,height,top:camera.top,bottom:camera.bottom,zoom:camera.zoom});
 const factor=width/Math.max(vp.clientWidth,1),fontSize=13*factor,margin=28*factor,tick=5*factor;
 const x=config.position.endsWith('right')?width-margin-layout.pixels:margin;
 const y=config.position.startsWith('top')?margin+fontSize+12*factor:height-margin-fontSize-10*factor;
 const color=config.ink==='light'||(config.ink==='auto'&&$('background').value==='dark')?'#ffffff':'#243a3d';
 ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2*factor;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+layout.pixels,y);ctx.moveTo(x,y-tick);ctx.lineTo(x,y+tick);ctx.moveTo(x+layout.pixels,y-tick);ctx.lineTo(x+layout.pixels,y+tick);ctx.stroke();
 ctx.font=fontSize+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='top';const labelWidth=ctx.measureText(layout.label).width;const labelX=Math.max(margin+labelWidth/2,Math.min(width-margin-labelWidth/2,x+layout.pixels/2));ctx.fillText(layout.label,labelX,y+8*factor);ctx.restore();
}
function drawScaleOverlay(){
 if(!scaleCanvas)return;
 const width=vp.clientWidth,height=vp.clientHeight,ratio=Math.min(devicePixelRatio,2);
 scaleCanvas.width=Math.round(width*ratio);scaleCanvas.height=Math.round(height*ratio);const ctx=scaleCanvas.getContext('2d');ctx.scale(ratio,ratio);
 try{drawScaleBar(ctx,width,height);$('scaleStatus').textContent='';}catch(error){$('scaleStatus').textContent=error.message;}
}
scaleCanvas=document.createElement('canvas');scaleCanvas.setAttribute('aria-label','Scale bar overlay');scaleCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';vp.append(scaleCanvas);
$('scaleEnabled').onchange=()=>{$('scaleOptions').hidden=!$('scaleEnabled').checked;render();};
for(const id of ['scaleLength','scaleCalibration','scalePosition','scaleInk'])$(id).addEventListener('input',render);
$('scaleUnit').onchange=()=>{
 const to=$('scaleUnit').value;try{const n=convertedLength(Number($('scaleLength').value),previousScaleUnit,to,Number($('scaleCalibration').value));if(Number.isFinite(n)&&n>0)$('scaleLength').value=Number(n.toPrecision(10));}finally{previousScaleUnit=to;render();}
};
function outlineConfig(){return {enabled:$('outlineEnabled').checked,names:[...outlinedNames],color:$('outlineColor').value,width:Math.max(.5,Math.min(8,Number($('outlineWidth').value)||1.5))};}
function updateOutlineControls(){
 $('outlineOptions').hidden=!$('outlineEnabled').checked;
 updateColorControls();
 $('outlineStatus').textContent=outlinedNames.size+' objects assigned to line art. Each structure keeps its own outer boundary, including tissues inside the cuticle. Set Filled or Outline per item above. PNG includes outlines; 3D exports retain surfaces.';
}
function restoreOutlineConfig(config){
 const c=config||{},known=new Set(objects.map(o=>o.name));outlinedNames=new Set(Array.isArray(c.names)?c.names.filter(n=>known.has(n)):[]);
 $('outlineEnabled').checked=!!c.enabled;$('outlineColor').value=/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'#243a3d';$('outlineWidth').value=Number.isFinite(c.width)?Math.max(.5,Math.min(8,c.width)):1.5;updateOutlineControls();
}
outlineView=new SilhouetteRenderer(renderer,scene,camera,meshes);
$('outlineApply').onclick=()=>action(()=>{requireSelection();selected.forEach(n=>outlinedNames.add(n));$('outlineEnabled').checked=true;updateOutlineControls();render();tell('Selected structures now show their individual outer boundaries.');});
$('outlineRestore').onclick=()=>action(()=>{requireSelection();selected.forEach(n=>outlinedNames.delete(n));if(!outlinedNames.size)$('outlineEnabled').checked=false;updateOutlineControls();render();tell('Selected structures restored to filled surfaces.');});
$('outlineEnabled').onchange=()=>{if($('outlineEnabled').checked&&!outlinedNames.size){if(!selected.size){$('outlineEnabled').checked=false;tell('Select one or more structures first.');}else selected.forEach(n=>outlinedNames.add(n));}updateOutlineControls();render();};
for(const id of ['outlineColor','outlineWidth'])$(id).addEventListener('input',render);
function fileName(extension){return exportFilename($('exportBase').value,extension);}
function requireSelection(){if(!selected.size)throw Error('Select one or more cells first.');}
async function action(fn){try{await fn();}catch(e){tell(e.message);console.error(e);}}
$('png').onclick=()=>action(async()=>{const name=fileName('png'),savedView=state();const w=Number($('resolution').value),h=Math.round(w/($('aspect').value==='view'?vp.clientWidth/vp.clientHeight:Number($('aspect').value))),bg=$('background').value;const oldColor=renderer.getClearColor(new T.Color()),oldAlpha=renderer.getClearAlpha();const originalHalfHeight=halfHeight,oldAspect=vp.clientWidth/vp.clientHeight,newAspect=w/h;camera.left=-originalHalfHeight*Math.max(oldAspect,newAspect);camera.right=-camera.left;camera.top=originalHalfHeight*Math.max(1,oldAspect/newAspect);camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.setPixelRatio(1);renderer.setSize(w,h,false);renderer.setClearColor(bg==='dark'?0x17232a:0xffffff,bg==='transparent'?0:1);let canvas;try{render();canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);if($('labels').checked){ctx.font=`${Math.max(16,Math.round(w/160))}px sans-serif`;ctx.fillStyle=bg==='dark'?'#fff':'#233e37';ctx.strokeStyle=bg==='dark'?'#17232a':'#fff';ctx.lineWidth=4;for(const m of meshes.filter(m=>selected.has(m.name)&&m.visible)){const p=m.geometry.boundingBox.getCenter(new T.Vector3()).project(camera);if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)continue;const x=(p.x+1)*w/2,y=(-p.y+1)*h/2;ctx.strokeText(m.name,x+7,y-7);ctx.fillText(m.name,x+7,y-7);}}drawScaleBar(ctx,w,h);}finally{renderer.setClearColor(oldColor,oldAlpha);renderer.setPixelRatio(Math.min(devicePixelRatio,2));resize();}const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('Could not create PNG.');const withView=embedViewInPng(new Uint8Array(await blob.arrayBuffer()),savedView);await download(withView,name,'image/png');});
$('glb').onclick=()=>action(async()=>{requireSelection();const group=new T.Group();for(const m of meshes.filter(m=>selected.has(m.name))){const copy=m.clone();copy.visible=true;copy.material=m.material.clone();copy.material.opacity=1;copy.material.transparent=false;copy.material.emissive.setHex(0);group.add(copy);}group.userData={source:'Virtual Worm February 2012',attribution:'Chris Grove / WormBase / Caltech',coordinates:'Original Blender world axes and numeric coordinates; no rescaling'};const buffer=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});await download(buffer,fileName('glb'),'model/gltf-binary');});
$('blend').onclick=()=>action(async()=>{requireSelection();await settingsReady;tell('Extracting original .blend objects…');const response=await fetch('/api/export-blend',{method:'POST',headers:{'Content-Type':'application/json','X-Worm-Token':sessionToken},body:JSON.stringify({filename:fileName('blend'),names:[...selected],colors:Object.fromEntries(meshes.filter(m=>selected.has(m.name)).map(m=>[m.name,m.material.color.getHexString()]))})});const data=await response.json();if(!response.ok)throw Error(data.error);tell('Saved: '+data.path);});
$('csv').onclick=()=>action(async()=>{requireSelection();const quote=s=>'"'+s.replaceAll('"','""')+'"';const csv='name,groups,color_hex\n'+objects.filter(o=>selected.has(o.name)).map(o=>[o.name,o.groups.join('; '),'#'+meshes.find(m=>m.name===o.name).material.color.getHexString()].map(quote).join(',')).join('\n');await download(csv,fileName('csv'),'text/csv');});
function state(){return {version:3,exportBase:$('exportBase').value,aspect:$('aspect').value,resolution:$('resolution').value,source:'Virtual_Worm_February_2012.blend',names:[...selected],mode,contextReturnMode,direction,halfHeight,camera:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray(),zoom:camera.zoom,colors:{...customColors},scaleBar:scaleConfig(),lineArt:outlineConfig(),background:$('background').value,labels:$('labels').checked};}
$('save').onclick=()=>action(()=>download(JSON.stringify(state(),null,2),fileName('json').replace(/\.json$/,'-view.json'),'application/json'));
$('load').onchange=()=>action(async()=>{const file=$('load').files?.[0];if(!file)return;let bytes;try{if(file.size>150*1024*1024)throw Error('File is too large.');bytes=new Uint8Array(await file.arrayBuffer());}finally{$('load').value='';}const s=readSavedView(bytes);const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);if(!s||![1,2,3].includes(s.version)||!Array.isArray(s.names)||!s.names.every(n=>typeof n==='string')||!vector(s.camera)||!vector(s.target)||!vector(s.up)||!Number.isFinite(s.halfHeight)||s.halfHeight<=0||!Number.isFinite(s.zoom)||s.zoom<=0)throw Error('Invalid saved-view settings.');if(typeof s.exportBase==='string')$('exportBase').value=s.exportBase;if(['view','1','1.333333333','1.777777778'].includes(s.aspect))$('aspect').value=s.aspect;if(['2400','3840','6000'].includes(s.resolution))$('resolution').value=s.resolution;const match=matchNames(s.names.join(','),objects);selected=new Set(match.found);mode=['whole','context','isolate'].includes(s.mode)?s.mode:'isolate';contextReturnMode=s.contextReturnMode==='whole'?'whole':'isolate';direction=s.direction;halfHeight=s.halfHeight;camera.position.fromArray(s.camera);camera.up.fromArray(s.up);camera.zoom=s.zoom;controls.target.fromArray(s.target);customColors={};for(const m of meshes){const color=s.colors?.[m.name];setCellColor(m,typeof color==='string'&&/^[0-9a-f]{6}$/i.test(color)?'#'+color:null);}$('background').value=s.background;$('background').onchange();$('labels').checked=!!s.labels;$('view').value=direction;restoreScaleConfig(s.scaleBar);restoreOutlineConfig(s.lineArt);controls.update();resize();refresh();tell(match.missing.length?'Missing: '+match.missing.join(', '):'Loaded view and selection.');});
// Labels are drawn in a separate overlay, then also included in high resolution PNGs.
const labels=document.createElement('div');labels.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';vp.append(labels);
function drawLabels(){labels.replaceChildren();if(!$('labels').checked)return;for(const m of meshes.filter(m=>m.visible&&selected.has(m.name))){const p=m.geometry.boundingBox.getCenter(new T.Vector3()).project(camera);if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)continue;const el=document.createElement('span');el.textContent=m.name;el.style.cssText=`position:absolute;left:${(p.x+1)*50}%;top:${(-p.y+1)*50}%;font:11px sans-serif;color:#254c40;background:#ffffffc9;border-radius:3px;padding:2px 4px;white-space:nowrap`;labels.append(el);}}
controls.addEventListener('change',drawLabels);$('labels').onchange=drawLabels;
// Label updates also follow all selection and view changes
new MutationObserver(drawLabels).observe($('count'),{childList:true});
try{const [catalog,buffer]=await Promise.all([fetch('catalog.json').then(r=>r.json()),fetch('model.bin').then(r=>r.arrayBuffer())]);objects=catalog.objects.filter(o=>!/^\d+(um|mm)$/.test(o.name));for(const o of objects){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,o.positionOffset,o.positionCount),3));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,o.indexOffset,o.indexCount),1));g.computeVertexNormals();g.computeBoundingBox();const mat=new T.MeshStandardMaterial({color:new T.Color(...o.color),roughness:.65,metalness:0,side:T.DoubleSide});const m=new T.Mesh(g,mat);m.name=o.name;m.userData={groups:o.groups,originalColor:o.color,sourceInScene:o.sourceInScene};anatomy.add(m);meshes.push(m);}const groups=[...new Set(objects.flatMap(o=>o.groups))].filter(g=>!/^Collection \d+$/.test(g)).sort();for(const g of groups){const opt=document.createElement('option');opt.value=g;opt.textContent=g.replaceAll('_',' ');$('tissue').append(opt);const colorOption=document.createElement('option');colorOption.value='group:'+g;colorOption.textContent=g.replaceAll('_',' ');$('colorTarget').append(colorOption);}showList();refresh();fit();$('loading').remove();for(const b of document.querySelectorAll('button'))b.disabled=false;$('status').textContent=`${objects.length} objects · local & offline`;window.wormStudio={getState:state,selectNames:text=>{$('names').value=text;selectText();},get objects(){return objects;},get meshes(){return meshes;},renderer,camera};}catch(e){$('loading').textContent='Could not load viewer: '+e.message;console.error(e);}
