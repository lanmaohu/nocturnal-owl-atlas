import * as T from '../vendor/three.module.js'
import {v, mix, random} from './feathers.js'
import {perchAt,perchRadius} from './perch.js'

const turn=Math.PI*2
const up=v(0,1,0)

function woodMaterial(color, hero) {
  const material=new T.MeshStandardMaterial({color,roughness:.98})
  if(!hero) return material
  material.onBeforeCompile = shader => {
    shader.vertexShader='varying vec3 barkP;\n' + shader.vertexShader
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbarkP=position;')
    shader.fragmentShader=`
      varying vec3 barkP;
      float hashB(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float bn(vec3 p){
        vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(hashB(i),hashB(i+vec3(1,0,0)),f.x),
          mix(hashB(i+vec3(0,1,0)),hashB(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hashB(i+vec3(0,0,1)),hashB(i+vec3(1,0,1)),f.x),
          mix(hashB(i+vec3(0,1,1)),hashB(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float grainB(vec3 p){
        vec3 q=vec3(p.x*7.,(p.y-p.x*.089)*116.,(p.z-p.x*.16)*114.);
        return .56*bn(q + bn(q*.47)*1.8) + .29*bn(q*2.12) + .15*bn(q*4.8);
      }
    `+shader.fragmentShader
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float grain=grainB(barkP);
      float fleck=bn(barkP*137.);
      float scaleB=bn(vec3(barkP.x*18.,barkP.y*39.,barkP.z*44.));
      float lichen=smoothstep(.61,.78,scaleB*.80+fleck*.20)*smoothstep(.12,.71,bn(barkP*7.3));
      vec3 bark=mix(vec3(.065,.041,.036),vec3(.31,.234,.163),grain);
      bark=mix(bark,vec3(.273,.320,.160)*(.6+.4*fleck),lichen*.74);
      diffuseColor.rgb *= bark/vec3(.185,.134,.077);
    `)
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec3 tx=dFdx(-vViewPosition), ty=dFdy(-vViewPosition);
      vec3 rx=cross(ty,normal), ry=cross(normal,tx);
      float det=dot(tx,rx);
      normal=normalize(abs(det)*normal - sign(det)*(dFdx(grain)*rx+dFdy(grain)*ry)*.0062);
    `)
  }
  return material
}

function stem(centers,radii,radial,mat,seed,hero=false) {
  const rng=random(seed)
  const spine=new T.CatmullRomCurve3(centers)
  const count=hero?128:Math.max(8,centers.length*3)
  const frame=spine.computeFrenetFrames(count,false)
  const positions=[],indices=[]
  const ridges=Array.from({length:radial},()=>rng()-.5)
  for(let row=0;row<=count;row++){
    const t=row/count, point=spine.getPointAt(t)
    const q=t*(radii.length-1), r=Math.floor(q)
    const radius=mix(radii[r],radii[Math.min(r+1,radii.length-1)],q-r)
    for(let col=0;col<=radial;col++){
      const a=col/radial*turn
      const jitter=ridges[col%radial]*.16+.052*Math.sin(a*5+t*13)+.028*Math.sin(a*11-t*31)
      const p=point.clone().addScaledVector(frame.normals[row],Math.cos(a)*radius*(1+jitter))
        .addScaledVector(frame.binormals[row],Math.sin(a)*radius*(1+jitter))
      positions.push(...p)
      if(row&&col){
        const i=row*(radial+1)+col
        indices.push(i-radial-2,i-radial-1,i,i-radial-2,i,i-1)
      }
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh=new T.Mesh(geometry,mat)
  mesh.castShadow=mesh.receiveShadow=hero
  return mesh
}

export function makePerch(scene) {
  const mat=woodMaterial(0x6c5344,true)
  const ranges=[-3.6,-2.55,-1.42,-.65,-.2,.3,.77,1.15,1.64,2.2,2.95,3.63]
  scene.add(stem(ranges.map(perchAt),ranges.map(x=>perchRadius(x)),24,mat,20,true))
  const stems=[
    [v(-1.49,-.195,-.209),v(-1.99,-.08,-.2),v(-2.54,.077,-.35),v(-2.98,.18,-.46)],
    [v(.77,-.007,.133),v(1.12,-.058,.021),v(1.61,.021,-.10),v(1.93,.155,-.175)],
    [v(1.58,.084,.284),v(1.78,-.115,.47),v(2.16,-.15,.68),v(2.43,-.10,.75)],
    [v(-.84,-.150,-.125),v(-1.03,-.37,-.155),v(-1.15,-.47,-.11)],
  ]
  stems.forEach((points,i)=>scene.add(stem(points,[.032,.019,.008,.0007],13,mat,561+i,true)))

  const rng=random(7011)
  const flakes=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0xffffff,roughness:.99}),260)
  const marker=new T.Object3D()
  for(let i=0;i<flakes.count;i++){
    const at=mix(-2.45,2.65,rng())
    const angle=mix(-.86,1.05,(rng()+rng())*.5)
    marker.position.copy(perchAt(at)).add(v(0,Math.cos(angle),Math.sin(angle)).multiplyScalar(perchRadius(at)*.91))
    marker.rotation.set(angle,0,rng()*.6)
    marker.scale.set(.008+rng()*.023,.006+rng()*.012,.004+rng()*.008)
    marker.updateMatrix()
    flakes.setMatrixAt(i,marker.matrix)
    flakes.setColorAt(i,new T.Color().setHSL(.115+rng()*.13,.15+rng()*.22,.14+rng()*.19))
  }
  flakes.receiveShadow=true
  scene.add(flakes)
}

function leafArtwork(seed) {
  const rng=random(seed)
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=256
  const c=canvas.getContext('2d')
  for(let n=0;n<53;n++){
    const phi=rng()*turn
    const r=Math.sqrt(rng())*(.70+rng()*.28)
    const x=128+Math.cos(phi)*r*107,y=128+Math.sin(phi)*r*99
    const length=11+rng()*34,width=3+rng()*13
    c.save()
    c.translate(x,y)
    c.rotate(phi+(rng()-.5)*1.5)
    const a=29+rng()*16,b=22+rng()*26,l=16+rng()*48
    const g=c.createLinearGradient(0,-width,length,width)
    g.addColorStop(0,`hsl(${a+32} ${b}% ${l*.71}%)`)
    g.addColorStop(.52,`hsl(${a+24} ${b}% ${l}%)`)
    g.addColorStop(1,`hsl(${a+18} ${b+7}% ${l*1.19}%)`)
    c.fillStyle=g
    c.beginPath()
    c.moveTo(0,0)
    c.bezierCurveTo(length*.25,-width,length*.77,-width*.66,length,0)
    c.bezierCurveTo(length*.66,width*.88,length*.19,width*.72,0,0)
    c.fill()
    c.restore()
  }
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace
  return map
}

function canopy(scene, rng) {
  const location = []
  const barkMat=new T.MeshStandardMaterial({color:0x222d20,roughness:1})
  for(let i=0;i<44;i++){
    const theta=i*2.39996
    const distance=8.5+(i%6)*2.15+rng()*2.75
    const x=Math.sin(theta)*distance,z=Math.cos(theta)*distance
    const height=6.7+rng()*9
    const leanX=(rng()-.5)*4, leanZ=(rng()-.5)*3.5
    scene.add(stem([v(x,-5,z),v(x+leanX*.32,-.7,z+leanZ*.28),v(x+leanX*.62,height*.45,z+leanZ*.62),v(x+leanX,height,z+leanZ)],
      [(.30+rng()*.65)*distance*.10,.21,.13,.052],8,barkMat,i+15))
    for(let tier=0;tier<3;tier++){
      const py=.15+tier*2.48+rng()*2.45
      const branch=v(x+(rng()-.5)*5,py+1.48,z+(rng()-.5)*5)
      if(i%2===0) scene.add(stem([v(x+leanX*.45,py-.73,z+leanZ*.45),branch.clone().add(v(.36,-.45,.29)),branch],
        [.14,.076,.012],7,barkMat,i+244+tier))
      for(let k=0;k<9;k++){
        location.push({p:branch.clone().add(v((rng()-.5)*5.7,(rng()-.5)*3.9,(rng()-.5)*4.9)),
          size:.70+rng()*2.45, light:rng()*(.32+tier*.21), type:(i+tier+k)%3})
      }
    }
    for(let k=0;k<5;k++) location.push({p:v(x+(rng()-.5)*4,-2.9+rng()*2.3,z+(rng()-.5)*4),
      size:1.7+rng()*2.2,light:.15+rng()*.39,type:(i+k)%3})
  }
  const marker=new T.Object3D()
  for(let i=0;i<3;i++){
    const subset=location.filter(a=>a.type===i)
    const material=new T.MeshBasicMaterial({map:leafArtwork(7382+i*319),color:0xffffff,side:T.DoubleSide,alphaTest:.46,fog:true})
    const mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,subset.length)
    subset.forEach(({p,size,light},k)=>{
      marker.position.copy(p)
      marker.lookAt(0,p.y*.31,0)
      marker.rotateZ(rng()*turn)
      marker.scale.set(size*1.28,size,1)
      marker.updateMatrix()
      mesh.setMatrixAt(k,marker.matrix)
      mesh.setColorAt(k,new T.Color().setHSL(.197+.042*rng(),.18+rng()*.21,.18+light*.54))
    })
    scene.add(mesh)
  }
}

function bokeh(scene,rng) {
  const p=[],col=[],spec=[]
  for(let i=0;i<430;i++){
    const theta=rng()*turn
    const r=9.3+rng()*13
    const y=-3+Math.pow(rng(),.78)*11
    const world=v(Math.sin(theta)*r,y,Math.cos(theta)*r)
    p.push(...world)
    const color = new T.Color().setHSL(.166+rng()*.104,.21+rng()*.44,mix(.26,.77,rng()))
    col.push(color.r,color.g,color.b)
    spec.push(.13+Math.pow(rng(),2)*1.28,.067+rng()*.18,(i%9)*.7)
  }
  const geo=new T.BufferGeometry()
  geo.setAttribute('position',new T.Float32BufferAttribute(p,3))
  geo.setAttribute('tone',new T.Float32BufferAttribute(col,3))
  geo.setAttribute('properties',new T.Float32BufferAttribute(spec,3))
  const mat=new T.ShaderMaterial({
    uniforms:{pixels:{value:540}},
    transparent:true, depthWrite:false, blending:T.AdditiveBlending,
    vertexShader:`
      attribute vec3 tone, properties; uniform float pixels;
      varying vec3 glint, props;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(pixels*properties.x/max(1.,-mv.z),2.,142.);
        glint=tone; props=properties;
      }`,
    fragmentShader:`
      varying vec3 glint, props;
      void main(){
        vec2 uv=(gl_PointCoord-.5)*2.;
        float a=atan(uv.y,uv.x)+props.z;
        float r=length(uv)*(1.+.044*cos(a*6.));
        float fill=(1.-smoothstep(.37,1.,r))*(.73+.27*r);
        gl_FragColor=vec4(glint,fill*props.y);
        #include <colorspace_fragment>
      }`,
  })
  scene.add(new T.Points(geo,mat))
  return mat.uniforms.pixels
}

export function createForest(scene, withPerch = true, seed = 92011) {
  const rng=random(seed)
  scene.fog=new T.FogExp2(0x33453d,.088)
  const sky=new T.Mesh(new T.SphereGeometry(48,36,22),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:`
      varying vec3 P;
      void main(){
        P=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      varying vec3 P;
      void main(){
        vec3 d=normalize(P);
        float crown=smoothstep(-.27,.48,d.y);
        float clear=pow(max(0.,dot(d,normalize(vec3(-.47,.30,-1.)))),5.);
        float haze=.5+.20*sin(d.x*7.+d.y*8.)+.13*sin(d.z*20.-d.y*10.);
        vec3 color=mix(vec3(.010,.019,.016),vec3(.073,.125,.086),haze*.57+crown*.31);
        color+=vec3(.16,.174,.088)*clear*.69;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  sky.renderOrder=-9
  scene.add(sky)
  canopy(scene,rng)
  if (withPerch) makePerch(scene)
  return bokeh(scene,rng)
}
