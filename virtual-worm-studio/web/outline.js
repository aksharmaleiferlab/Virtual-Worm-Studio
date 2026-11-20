// Trace each structure independently so enclosing tissues do not erase inner anatomy.
import * as T from 'three';
export class SilhouetteRenderer {
 constructor(renderer,scene,camera,meshes){
  this.renderer=renderer;this.scene=scene;this.camera=camera;this.meshes=meshes;
  this.target=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
  // Readable depth textures allow filled tissues to occlude silhouette strokes.
  this.target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  this.occluders=new T.WebGLRenderTarget(1,1,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});
  this.occluders.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  this.maskMaterial=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
  this.uniforms={mask:{value:this.target.texture},maskDepth:{value:this.target.depthTexture},filledDepth:{value:this.occluders.depthTexture},texel:{value:new T.Vector2(1,1)},ink:{value:new T.Color('#243a3d')},thickness:{value:1.5}};
  this.material=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:this.uniforms,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D mask;uniform sampler2D maskDepth;uniform sampler2D filledDepth;uniform vec2 texel;uniform vec3 ink;uniform float thickness;varying vec2 vUv;
    float sampleMask(vec2 uv){if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0)return 0.0;return texture2D(mask,uv).r;}
    void main(){float center=sampleMask(vUv);float expanded=0.0;float foreground=texture2D(filledDepth,vUv).r;
     for(int ring=1;ring<=4;ring++){float r=thickness*float(ring)/4.0;for(int side=0;side<16;side++){float angle=6.28318530718*float(side)/16.0;vec2 sampleUv=vUv+vec2(cos(angle),sin(angle))*texel*r;float coverage=sampleMask(sampleUv);float boundaryDepth=texture2D(maskDepth,clamp(sampleUv,vec2(0.0),vec2(1.0))).r;float visible=step(boundaryDepth,foreground+0.00001);expanded=max(expanded,coverage*visible);}}
     float alpha=max(0.0,expanded-center);if(alpha<0.005)discard;gl_FragColor=vec4(ink,alpha);
     #include <colorspace_fragment>
    }`});
  this.quadScene=new T.Scene();this.quadScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));this.quadCamera=new T.Camera();
 }
 render(names,options,viewportWidth){
  const renderer=this.renderer,size=renderer.getDrawingBufferSize(new T.Vector2());
  if(this.target.width!==size.x||this.target.height!==size.y)this.target.setSize(size.x,size.y);
  if(this.occluders.width!==size.x||this.occluders.height!==size.y)this.occluders.setSize(size.x,size.y);
  this.uniforms.texel.value.set(1/size.x,1/size.y);this.uniforms.thickness.value=options.width*size.x/Math.max(viewportWidth,1);this.uniforms.ink.value.set(options.color);
  const visibility=this.meshes.map(m=>m.visible),oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new T.Color()),oldAlpha=renderer.getClearAlpha(),oldOverride=this.scene.overrideMaterial,oldAutoClear=renderer.autoClear;
  try{
   // Draw filled/context objects first, preserving all current view visibility.
   this.meshes.forEach((m,i)=>{m.visible=visibility[i]&&!names.has(m.name);});renderer.render(this.scene,this.camera);
   // Filled tissues occlude strokes; outlined shells remain hollow.
   this.scene.overrideMaterial=this.maskMaterial;
   this.meshes.forEach((m,i)=>{m.visible=visibility[i]&&!names.has(m.name)&&m.material.opacity>=0.999;});
   renderer.setRenderTarget(this.occluders);renderer.setClearColor(0x000000,1);renderer.autoClear=true;renderer.render(this.scene,this.camera);
   this.meshes.forEach(m=>{m.visible=false;});
   // A union mask would swallow the pharynx/intestine inside an outlined cuticle.
   // Render one silhouette per structure, retaining all nested outer boundaries.
   for(let i=0;i<this.meshes.length;i++){
    const mesh=this.meshes[i];if(!visibility[i]||!names.has(mesh.name))continue;
    mesh.visible=true;renderer.setRenderTarget(this.target);renderer.setClearColor(0x000000,1);renderer.autoClear=true;renderer.render(this.scene,this.camera);mesh.visible=false;
    renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);renderer.autoClear=false;renderer.render(this.quadScene,this.quadCamera);
   }
  }finally{
   this.meshes.forEach((m,i)=>{m.visible=visibility[i];});this.scene.overrideMaterial=oldOverride;renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);renderer.autoClear=oldAutoClear;
  }
 }
}
