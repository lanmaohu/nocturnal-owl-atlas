import * as T from '../vendor/three.module.js'

export const v=(x,y,z)=>new T.Vector3(x,y,z)
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x))
export const mix=(a,b,f)=>a+(b-a)*f
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
export const color=x=>new T.Color(x)
export function random(seed){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
}

const motion = `
attribute vec3 anchor, grow, lift, groundTint, inkTint;
attribute vec4 form, pattern;
uniform float time, wind;
vec3 displaceBlade(out vec3 n, out vec3 g){
  float x=position.x, t=position.y;
  g=normalize(grow);
  n=normalize(lift);
  vec3 right=normalize(cross(g,n));
  n=normalize(cross(right,g));
  float spine=sin((.063+.937*t)*3.14159265);
  float width=pow(max(.001,spine),mix(.59,.43,form.w));
  float rounded=width*(1.-.024*x*x*sin(t*69.+pattern.w*9.));
  float motion=wind*.079*t*t*(sin(dot(anchor,vec3(4.,8.,-3.))+time*2.4-t*1.9) + .3*sin(time*4.5+pattern.w*9.-t*3.));
  float rise=form.z*3.4*t*(1.-t)-.084*(1.-t)*(1.-t)-.12*t*t+motion;
  rise-=width*x*x*mix(.138,.078,form.w);
  float r=(x*rounded*(1.+x*form.w*.23)+.117*form.w*t*t)*form.y;
  vec3 point=anchor+g*(t*form.x)+right*r+n*(rise*form.x);
  vec3 tangent=normalize(g+n*(form.z*3.4*(1.-2.*t)+.168*(1.-t)-.24*t));
  n=normalize(cross(right,tangent)+right*x*width*.26);
  return point;
}
`

function layerMesh(seg,col){
  const position=[],idx=[]
  for(let i=0;i<=seg;i++){
    for(let j=0;j<col;j++){
      const s=j/(col-1)*2-1
      position.push(Math.sign(s)*Math.pow(Math.abs(s),1.37),i/seg,0)
      if(i&&j){
        const o=i*col+j
        idx.push(o-col-1,o,o-1,o-col-1,o-col,o)
      }
    }
  }
  const geo=new T.InstancedBufferGeometry()
  geo.setAttribute('position',new T.Float32BufferAttribute(position,3))
  geo.setIndex(idx)
  return geo
}

export function makePlumageMaterial(){
  const uniforms=T.UniformsUtils.merge([T.UniformsLib.lights,{
    time:{value:0},wind:{value:.25},sun:{value:v(3.8,5.8,4.5)},
  }])
  const material=new T.ShaderMaterial({
    side:T.DoubleSide, lights:true,defines:{HAS_NORMAL:1}, uniforms,
    vertexShader:`
    ${motion}
    #include <common>
    #include <shadowmap_pars_vertex>
    varying vec3 World, N, Tangent, Base, Ink;
    varying vec2 B;
    varying vec4 Pattern;
    void main(){
      vec3 n,g;
      vec3 p=displaceBlade(n,g);
      vec3 transformedNormal=normalize(normalMatrix*n);
      vec4 worldPosition=modelMatrix*vec4(p,1.);
      World=worldPosition.xyz;
      N=normalize(mat3(modelMatrix)*n);
      Tangent=normalize(mat3(modelMatrix)*g);
      B=position.xy;
      Base=groundTint;
      Ink=inkTint;
      Pattern=pattern;
      gl_Position=projectionMatrix*viewMatrix*worldPosition;
      #include <shadowmap_vertex>
    }`,
    fragmentShader:`
    uniform vec3 sun;
    uniform bool receiveShadow;
    varying vec3 World, N, Tangent, Base, Ink;
    varying vec2 B;
    varying vec4 Pattern;
    #include <common>
    #include <packing>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>
    void main(){
      float x=B.x,t=B.y,ax=abs(x);
      float fiber=(t-ax*.255+ax*ax*.048)*43.+Pattern.w*4.;
      float ribs=sin(fiber*6.283)*(1.-smoothstep(.24,.65,fwidth(fiber)));
      float ash=sin(23.*x+57.*t+Pattern.w*6.)*cos(31.*t-14.*x);
      float stripes=sin((t+ax*.082)*Pattern.z*6.283+Pattern.w*6.283);
      float barred=smoothstep(.13,.57,stripes+.23*ash);
      float drop=exp(-x*x*(6.+4.*t))*smoothstep(.25,.72,t)*(1.-smoothstep(.90,1.,t));
      float fleck=smoothstep(.50,.78,t+ash*.08)*smoothstep(.98,.12,ax);
      float style=Pattern.x;
      float marks=style<.5?0.:style<1.5?barred:style<2.5?drop:fleck;
      vec3 n=normalize(N)*(gl_FrontFacing?1.:-1.);
      vec3 bitangent=normalize(cross(Tangent,n));
      n=normalize(n + bitangent*ribs*.052 + normalize(Tangent)*ash*.018);
      vec3 light=normalize(sun-World), eye=normalize(cameraPosition-World);
      vec3 h=normalize(eye+light);
      float diffuse=max(0.,dot(n,light));
      float sky=.50+.50*dot(n,normalize(vec3(-.3,.72,.49)));
      float porcelain=pow(max(0.,dot(n,h)),18.)*.062;
      float seam=exp(-x*x*123.)*(1.-smoothstep(.47,.95,t));
      vec3 hue=mix(Base,Ink,Pattern.y*marks);
      float fine=.90+ribs*.046+ash*.033+seam*.14;
      float occlusion=mix(.45,1.,smoothstep(.06,.56,t))*(1.-smoothstep(.72,1.,ax)*.14);
      float shadow=mix(.53,1.,getShadowMask());
      vec3 lighting=mix(vec3(.35,.40,.48),vec3(.64,.68,.71),sky)+vec3(.98,.83,.63)*diffuse*.83*shadow;
      vec3 outputColor=hue*lighting*occlusion*fine+porcelain*(.08+hue*.27)*shadow;
      outputColor+=hue*vec3(.11,.19,.25)*pow(1.-max(0.,dot(n,eye)),3.);
      gl_FragColor=vec4(outputColor,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`.replace('smoothstep(.98,.12,ax)','(1.-smoothstep(.12,.98,ax))'),
  })
  const depth=new T.ShaderMaterial({
    side:T.DoubleSide,uniforms,vertexShader:`
    ${motion}
    void main(){
      vec3 n,g;gl_Position=projectionMatrix*modelViewMatrix*vec4(displaceBlade(n,g),1.);
    }`,
    fragmentShader:'void main(){ gl_FragColor=vec4(1.); }',
  })
  return {material,depth,uniforms}
}

export function plumage(samples,shader,detail){
  const [rows,cols]=detail==='flight'?[15,7]:detail==='fine'?[6,5]:[4,5]
  const geo=layerMesh(rows,cols)
  const itemSize={anchor:3,grow:3,lift:3,groundTint:3,inkTint:3,form:4,pattern:4}
  const attributes=Object.fromEntries(Object.keys(itemSize).map(k=>[k,[]]))
  const bounds=new T.Box3()
  for(const f of samples){
    attributes.anchor.push(...f.p)
    attributes.grow.push(...f.dir)
    attributes.lift.push(...f.n)
    attributes.groundTint.push(f.base.r,f.base.g,f.base.b)
    attributes.inkTint.push(f.ink.r,f.ink.g,f.ink.b)
    attributes.form.push(f.length,f.width,f.arch??.16,f.flight??0)
    attributes.pattern.push(f.mode??0,f.strength??.72,f.freq??1.5,f.phase??.5)
    const reach=f.length+f.width
    bounds.expandByPoint(f.p.clone().addScalar(reach))
    bounds.expandByPoint(f.p.clone().addScalar(-reach))
  }
  for(const [k,size] of Object.entries(itemSize)) geo.setAttribute(k,new T.InstancedBufferAttribute(new Float32Array(attributes[k]),size))
  geo.boundingBox=bounds
  geo.boundingSphere=bounds.getBoundingSphere(new T.Sphere())
  geo.instanceCount=samples.length
  const mesh=new T.Mesh(geo,shader.material)
  mesh.castShadow=true
  mesh.receiveShadow=true
  mesh.customDepthMaterial=shader.depth
  mesh.userData={plumage:samples.length}
  return mesh
}
