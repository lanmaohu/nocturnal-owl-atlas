import * as T from '../vendor/three.module.js'
import { createForest } from './forest.js'
import { perchAt, perchRadius } from './perch.js'
import { random } from './feathers.js'
import { motionFor } from './behavior.js'

const TAU = Math.PI * 2
const v = (x,y,z) => new T.Vector3(x,y,z)
const lerp = T.MathUtils.lerp
const clamp = T.MathUtils.clamp
function standard(color, roughness = .95) {
  return new T.MeshStandardMaterial({ color, roughness })
}

// Wood grain, shakes and weathered pockets are drawn along the timber grain.
function timber(seed, weathered) {
  const rng = random(seed)
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(1024,256)
  const knots = Array.from({length:5}, () => [rng()*1024, rng()*256, 4+rng()*9])
  const base = weathered ? [107,103,90] : [86,77,65]
  for(let y=0;y<256;y++) for(let x=0;x<1024;x++) {
    let distortion = 0, knot = 0
    for (const [cx,cy,r] of knots) {
      const dx=(x-cx)*.31, dy=y-cy, ring=Math.sqrt(dx*dx+dy*dy)
      distortion += 19 * Math.exp(-ring/(r*1.7)) * Math.sin(dy/r)
      knot += Math.exp(-ring/(r*.8)) * (.55+.45*Math.sin(ring*1.4))
    }
    const p=y+distortion+1.9*Math.sin(x*.013+y*.11)+1.1*Math.sin(x*.032+y*.17)
    const grain = .46*Math.sin(p*1.64)+.27*Math.sin(p*3.19+.3)+.27*Math.sin(p*.54+x*.0008)
    const broad = .5 + .5*Math.cos(y*.11+Math.sin(x*.007)*.64)
    const ink=Math.pow(Math.max(0,grain),2.5)
    const fissure=Math.max(0,Math.cos(y*.33+distortion*.27+Math.sin(x*.009)*.7))**15
    const t=.99+.17*broad+.13*grain-.74*ink-.65*knot-.25*fissure+(rng()-.5)*.14
    const i=(y*1024+x)*4
    for(let c=0;c<3;c++) image.data[i+c]=base[c]*t
    image.data[i+3]=255
  }
  ctx.putImageData(image,0,0)
  for(let k=0;k<53;k++){
    let x=rng()*1000,y=rng()*256
    const size=20+rng()*156
    ctx.beginPath();ctx.moveTo(x,y)
    for(let j=1;j<8;j++){x+=size/8; y+=(rng()-.5)*2.2;ctx.lineTo(x,y)}
    ctx.strokeStyle='rgba(22,17,12,'+(.13+rng()*.35)+')'
    ctx.lineWidth=.4+rng()*1.18;ctx.stroke()
  }
  const map = new T.CanvasTexture(canvas)
  map.colorSpace = T.SRGBColorSpace
  map.wrapS=map.wrapT=T.RepeatWrapping
  map.anisotropy=4
  return new T.MeshStandardMaterial({map, bumpMap:map,bumpScale:.033,roughness:.93})
}

function sky(scene, heights, colors, sun, glow) {
  const tex = document.createElement('canvas')
  tex.width = 768;tex.height=256
  const ctx=tex.getContext('2d'), image=ctx.createImageData(tex.width,tex.height)
  const palette=colors.map(c=>new T.Color(c)), highlight=new T.Color(glow), rng=random(12)
  const out=new T.Color()
  for(let y=0;y<tex.height;y++){
    const phi=Math.PI*y/(tex.height-1), elev=Math.cos(phi)
    let idx=0
    while(idx+2<heights.length && elev>heights[idx+1])idx++
    const blend=clamp((elev-heights[idx])/(heights[idx+1]-heights[idx]),0,1)
    for(let x=0;x<tex.width;x++){
      const az=x/(tex.width-1)*TAU, dx=-Math.cos(az)*Math.sin(phi), dz=Math.sin(az)*Math.sin(phi)
      const dot=dx*sun.x+elev*sun.y+dz*sun.z
      const bloom=Math.pow(Math.max(0,dot),24)
      out.copy(palette[idx]).lerp(palette[idx+1],blend).lerp(highlight,bloom*.65)
      const wisp=Math.max(0,1-Math.abs(elev-.15)*3)*(.5+.5*Math.sin(elev*140+dx*23+Math.sin(dz*13)*1.5))
      out.multiplyScalar(.985+.018*wisp+rng()*.01).convertLinearToSRGB()
      const i=(y*tex.width+x)*4
      image.data[i]=out.r*255;image.data[i+1]=out.g*255;image.data[i+2]=out.b*255;image.data[i+3]=255
    }
  }
  ctx.putImageData(image,0,0)
  const map=new T.CanvasTexture(tex);map.colorSpace=T.SRGBColorSpace
  scene.add(new T.Mesh(new T.SphereGeometry(52,48,24),new T.MeshBasicMaterial({map,side:T.BackSide,fog:false,toneMapped:false})))
}

function box(group, geo, material, size, position, rotation) {
  const m=new T.Mesh(geo,material);m.scale.set(...size);m.position.set(...position)
  if(rotation)m.rotation.set(...rotation)
  group.add(m);return m
}

function makeSeat(scene, type, wood) {
  // The crest spans the exact toe-gripping curve in the model, wider wood below and beside the feet.
  const count=92, sides=28, points=[], uv=[], indices=[], rng=random(217)
  const rings=Array.from({length:sides},()=>rng()-.5)
  for (let i=0;i<=count;i++){
    const x=lerp(-8,8,i/count), center=perchAt(x)
    const edge=T.MathUtils.smoothstep(Math.abs(x),.32,1.45)
    const r=perchRadius(clamp(x,-3,3)), taper=clamp(1-x*.065,.70,1.4)
    for(let j=0;j<=sides;j++){
      const a=TAU*j/sides, cos=Math.cos(a), sin=Math.sin(a)
      const irregular=.035*Math.sin(a*3+x*.91)+.065*rings[j%sides]+.028*Math.cos(a*8+x*.25)
      const ry=type==='barn'?Math.sign(cos)*Math.pow(Math.abs(cos),.50):cos
      const rz=type==='barn'?Math.sign(sin)*Math.pow(Math.abs(sin),.53):sin
      // Keep a grip-sized rounded ridge above a continuous heft of timber beneath it.
      const lower=Math.max(0,-cos)
      const h=type==='barn'?.42:type==='snow'?.21:.35
      const breadth=r*(1+edge*(type==='barn'?.42:.75)*taper)
      const top=r*(1+edge*.30*taper)*ry*(1+irregular)
      const bend=type==='barn'?0:edge*(.047*Math.sin(x*1.22)+.026*x)
      const zBend=type==='barn'?0:edge*.070*Math.sin(x*.85)
      points.push(x,center.y+top-lower*lower*h*taper+bend,center.z+rz*(breadth+.12*lower*lower)*(1+irregular)+zBend)
      uv.push(x*.74, j/sides*1.28)
      if(i && j){const n=i*(sides+1)+j;indices.push(n-sides-2,n-sides-1,n,n-sides-2,n,n-1)}
    }
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals()
  const seat=new T.Mesh(g,wood);seat.castShadow=seat.receiveShadow=true;scene.add(seat)
}

function distantHedgerow(scene,rng) {
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=512
  const c=canvas.getContext('2d')
  function twig(x,y,len,angle,level) {
    const px=x+len*Math.cos(angle),py=y+len*Math.sin(angle)
    c.lineWidth=level*level*.47+.85
    c.strokeStyle=level>2?'#414042':'#555750'
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x*.48+px*.52+len*.065,y*.5+py*.5,px,py);c.stroke()
    if(level<=2) {
      for(let i=0;i<145;i++){
        const a=rng()*TAU, r=Math.sqrt(rng())*len*1.15
        const bx=px+Math.cos(a)*r*.91,by=py+Math.sin(a)*r*.72
        const size=.9+rng()*3.5
        c.fillStyle='hsl('+Math.floor(80+rng()*20)+' 13% '+Math.floor(24+rng()*12)+'%)'
        c.beginPath();c.ellipse(bx,by,size*1.3,size*.65,a,0,TAU);c.fill()
      }
    }
    if(!level)return
    twig(px,py,len*(.68+rng()*.13),angle-.22-rng()*.50,level-1)
    twig(px,py,len*(.64+rng()*.16),angle+.26+rng()*.55,level-1)
    if(level>2)twig(px,py,len*.77,angle+(rng()-.5)*.76,level-1)
  }
  twig(252,510,113,-1.50,5)
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace
  const mat=new T.MeshBasicMaterial({map,transparent:true,alphaTest:.21,depthWrite:true,side:T.DoubleSide})
  const forest=new T.InstancedMesh(new T.PlaneGeometry(1,1),mat,140),marker=new T.Object3D()
  for(let i=0;i<forest.count;i++){
    const a=TAU*i/forest.count, r=18+rng()*13,h=4+rng()*6
    marker.position.set(Math.sin(a)*r,-3.75+h*.47,Math.cos(a)*r)
    marker.rotation.set(0,a,0);marker.scale.set(h*(.86+.27*rng()),h,1)
    marker.updateMatrix();forest.setMatrixAt(i,marker.matrix)
  }
  forest.userData.backgroundPlant=true;scene.add(forest)
}

function barn(scene) {
  scene.fog=new T.FogExp2(0x807975,.026)
  sky(scene,[-1,-.15,.02,.16,.63,1],['#38423d','#51605a','#d49d7c','#b79ca0','#647f96','#496980'],v(-.80,.07,-.45).normalize(),'#f4c692')
  const boxGeo=new T.BoxGeometry(1,1,1), wall=new T.Group(),rng=random(393)
  // A lateral opening lets the owl's face sit against shadow while the sun catches its rim.
  wall.rotation.y=1.03;scene.add(wall)
  const wallGrain=timber(25,true)
  wallGrain.map=wallGrain.map.clone()
  wallGrain.map.center.set(.5,.5);wallGrain.map.rotation=Math.PI/2;wallGrain.map.repeat.set(1.23,.47)
  wallGrain.bumpMap=wallGrain.map;wallGrain.bumpScale=.012
  const woods=[0xada297,0xbab1a5,0x8a8881,0x9d978b,0xaeaba4].map(c=>{
    const m=wallGrain.clone();m.color.setHex(c);return m
  })
  for(let i=0;i<45;i++){
    const x=-11+i*.51
    const sill=-1.35, eave=6.25+rng()*.23
    const opening=x>-5.2&&x<.12
    const top=opening ? 1.12+.08*Math.sin(i*1.5) : eave
    box(wall,boxGeo,woods[i%5],[.495,.1+top+3.2,.16],[x,(top-3.2)/2,-6.8+rng()*.08],[0,0,(rng()-.5)*.007])
    if(opening)box(wall,boxGeo,woods[(i+2)%5],[.493,2.30,.16],[x,5.46,-6.8])
    if(i%8===0)box(wall,boxGeo,woods[2],[.19,eave-sill+2,.32],[x,1.8,-6.4])
  }
  box(wall,boxGeo,woods[4],[19,.22,.38],[0,1.04,-6.48])
  box(wall,boxGeo,woods[2],[19,.24,.56],[0,4.22,-6.46])
  box(wall,boxGeo,woods[0],[.13,3.32,.2],[-2.45,2.66,-6.63])
  for(const sign of [-1,1]){
    box(wall,boxGeo,woods[0],[.26,9,.34],[sign*7.5,.85,1.45],[.07,0,0])
    box(wall,boxGeo,woods[4],[.18,.25,17],[sign*7.4,4.38,-.43])
    const rise=4.22-1.04,run=3.45
    box(wall,boxGeo,woods[2],[Math.hypot(run,rise),.22,.31],[sign*5.35,(4.22+1.04)/2,-6.48],[0,0,sign*Math.atan2(rise,run)])
  }
  const ground=new T.Mesh(new T.PlaneGeometry(96,96),standard(0x534b36))
  ground.rotation.x=-Math.PI/2;ground.position.y=-3.4;scene.add(ground)
  distantHedgerow(scene,rng)
  const wood=timber(8,false)
  makeSeat(scene,'barn',wood)
  // The crossbeam dies into two upright posts outside the bird's workspace.
  for(const x of [-5.1,5.7]){
    const p=perchAt(x)
    box(scene,boxGeo,woods[3],[.42,6.4,.46],[x,-.20,p.z])
    box(scene,boxGeo,woods[1],[1.42,.16,.27],[x-Math.sign(x)*.42,p.y-.6,p.z],[0,0,Math.sign(x)*-.72])
  }
}

function driftHeight(x,z) {
  return -.56-.057*Math.min(58,Math.hypot(x,z))+.22*Math.sin(x*.64+z*.28)+.12*Math.cos(z*.82-x*.19)+.07*Math.cos(x*1.77+z*.48)
}
function tundra(scene) {
  scene.fog=new T.FogExp2(0xc8d3dc,.035)
  sky(scene,[-1,-.08,.04,.24,.76,1],['#909cac','#bcbdc8','#e7cdb9','#b3c7d3','#7694ad','#5d809e'],v(-.9,.13,-.35).normalize(),'#fff0c6')
  const terrain=new T.PlaneGeometry(72,72,128,128)
  terrain.rotateX(-Math.PI/2)
  const pos=terrain.attributes.position, colors=[],high=new T.Color(0xdfe8ed),low=new T.Color(0x9bb2c3)
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i),y=driftHeight(x,z)
    pos.setY(i,y)
    const tone=low.clone().lerp(high,.52+.24*Math.sin(x*.67+z*.35)+.21*Math.sin(x*2.1+z*.75))
    colors.push(tone.r,tone.g,tone.b)
  }
  terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.computeVertexNormals()
  const ground=new T.Mesh(terrain,new T.MeshStandardMaterial({vertexColors:true,roughness:.91}));ground.receiveShadow=true;scene.add(ground)
  const rng=random(9218)
  for(let line=0;line<3;line++){
    const positions=[],tints=[],inds=[],band=[0xafc1ce,0x8ea9bb,0x7895a7][line],base=new T.Color(band)
    const snowCap=new T.Color(0xe6e1df),r=35-line*5
    for(let i=0;i<=240;i++){
      const a=i/240*TAU
      const broad=.85*Math.sin(a*3+.7*line)+.7*Math.cos(a*7+line)+.48*Math.sin(a*11+2*line)
      const crag=.8*Math.abs(Math.sin(a*19+line))+.20*Math.sin(a*47+.8*line)+.1*Math.cos(a*79)
      const h=.95-line*.25+broad+crag
      const flute=Math.sin(a*27+Math.sin(a*13)*1.7)*.5+.5
      for(let row=0;row<5;row++) {
        const t=row/4,rad=r-2.8*t+flute*.8
        const y=lerp(h,-3.3,t)+(row===0?0:.3*Math.sin(a*17+t*3)*Math.sin(t*Math.PI))
        positions.push(Math.sin(a)*rad,y,Math.cos(a)*rad)
        const c=base.clone().lerp(snowCap,(.09+(1-t)*.4)*(.35+flute*.65))
        c.multiplyScalar(.92+.135*flute);tints.push(c.r,c.g,c.b)
        if(i&&row){const k=i*5+row;inds.push(k-6,k-5,k,k-6,k,k-1)}
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(tints,3));g.setIndex(inds)
    const ridge=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));scene.add(ridge)
  }
  const grass=[],color=new T.Color(),tints=[]
  for(let i=0;i<430;i++){
    const a=TAU*rng(),r=2.4+Math.pow(rng(),.73)*13
    const x=Math.cos(a)*r,z=Math.sin(a)*r,y=driftHeight(x,z)+.014
    if(Math.sin(x*1.3+z*.7)<-.25)continue
    for(let blade=0;blade<6;blade++) {
      const dx=(rng()-.5)*.16,dz=(rng()-.5)*.12, height=.11+rng()*.35
      grass.push(x+dx-.008,y,z+dz,x+dx+.012,y,z+dz,x+dx+.08+rng()*.21,y+height,z+dz+rng()*.08)
      color.setHSL(.09+rng()*.04,.19,.25+rng()*.25);for(let n=0;n<3;n++)tints.push(color.r,color.g,color.b)
    }
  }
  const grassGeo=new T.BufferGeometry();grassGeo.setAttribute('position',new T.Float32BufferAttribute(grass,3));grassGeo.setAttribute('color',new T.Float32BufferAttribute(tints,3))
  scene.add(new T.Mesh(grassGeo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})))
  // Drifted snow gathers on and around the windfall where it meets the bank.
  const stone=new T.IcosahedronGeometry(1,2), powder=standard(0xe0e6e7)
  for (const [x,z,scale] of [[-2.35,-.31,.57],[-3.15,-.56,.85],[2.25,.60,.56],[3.10,.95,.90]]) {
    const mound=new T.Mesh(stone,powder)
    mound.position.set(x,driftHeight(x,z)+.045,z);mound.scale.set(scale*1.55,scale*.66,scale*.96);mound.rotation.y=x
    mound.castShadow=true;mound.receiveShadow=true;scene.add(mound)
  }
  makeSeat(scene,'snow',timber(13,true))
}

function forestUnderstory(scene, seed) {
  const rng=random(seed), leaf=[],shades=[]
  const color=new T.Color()
  for(let clump=0;clump<135;clump++){
    const a=rng()*TAU,r=3.9+rng()*9
    const x=Math.sin(a)*r,z=Math.cos(a)*r,y=-1.45-rng()*.5
    const size=.46+rng()*1.32
    for(let j=0;j<8;j++){
      const dir=TAU*(j+rng()*.45)/8,dx=Math.sin(dir),dz=Math.cos(dir)
      const width=(.19+rng()*.16)*size
      for(let pair=1;pair<=10;pair++)for(const side of [-1,1]){
        const t=pair/12,l=width*(.2+.8*Math.sin(Math.PI*Math.pow(t,.83)))
        const u=x+dx*t*size,vz=z+dz*t*size,vy=y+t*size*(1.15-.64*t)
        leaf.push(u,vy,vz, u+dx*.085*size,vy+.044*size,vz+dz*.085*size,
          u+dx*.13*size+side*dz*l,vy+.05*size,vz+dz*.13*size-side*dx*l)
        color.setHSL(.218+rng()*.03,.25+rng()*.12,.17+rng()*.12)
        for(let k=0;k<3;k++)shades.push(color.r,color.g,color.b)
      }
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(leaf,3));geo.setAttribute('color',new T.Float32BufferAttribute(shades,3))
  scene.add(new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide})))
}

function boreal(scene,seed) {
  const rng=random(seed)
  scene.fog=new T.FogExp2(0x92a5a3,.048)
  sky(scene,[-1,-.10,.04,.20,.74,1],['#55675b','#8b978c','#ded6ba','#b2c2c3','#8da6b1','#6c8696'],v(-.8,.15,-.45).normalize(),'#e6d5b0')
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=768
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='#454941';ctx.beginPath();ctx.moveTo(187,758);ctx.lineTo(193,21);ctx.lineTo(201,758);ctx.fill()
  const bough=(x,y,length,side,tier)=>{
    const droop=14+18*tier
    ctx.strokeStyle='#474d3e';ctx.lineWidth=1+2.5*tier
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+length*side*.65,y+droop*1.8,x+length*side,y+droop*.9);ctx.stroke()
    for(let shoot=1;shoot<=19;shoot++){
      const t=shoot/20,l=(1-t*.76)*length*(.15+.13*rng())
      const xx=x+side*length*t,yy=y+droop*(3.6*t-2.7*t*t)
      ctx.strokeStyle='hsl('+Math.round(116+rng()*29)+' 15% '+Math.round(19+rng()*13)+'%)';ctx.lineWidth=.8+1.5*tier
      for(let k=0;k<8;k++){
        const f=k/9
        ctx.beginPath();ctx.moveTo(xx+side*f*l*.5,yy+f*l*.35)
        ctx.lineTo(xx+side*l*(.34+f*.34),yy+l*(.65+.4*f));ctx.stroke()
      }
    }
  }
  for(let i=0;i<164;i++){
    const h=rng()*.90+.025,y=h*738,side=i%2?1:-1
    const len=(9+154*Math.pow(h,.77))*(.55+.45*rng())
    bough(193+rng()*4,y,len,side,h)
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace
  const trees=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,alphaTest:.27}),180)
  const marker=new T.Object3D()
  for(let i=0;i<trees.count;i++){
    const a=rng()*TAU,r=4.1+Math.pow(rng(),.8)*25,h=3.1+rng()*8.4
    marker.position.set(Math.sin(a)*r,-2.25+h*.5,Math.cos(a)*r);marker.rotation.set(0,a+(rng()-.5)*.24,0)
    marker.scale.set(h*(.34+.22*rng()),h,1);marker.updateMatrix();trees.setMatrixAt(i,marker.matrix)
  }
  trees.userData.backgroundPlant=true;scene.add(trees)
  const floor=new T.Mesh(new T.PlaneGeometry(70,70),standard(0x5f6452));floor.rotation.x=-Math.PI/2;floor.position.y=-2.16;scene.add(floor)
  makeSeat(scene,'forest',timber(seed%751+5,true))
}

function openCountry(scene, kind, seed, lowPerch) {
  const rng=random(seed), water=kind==='river'||kind==='marsh', rock=kind==='stone'
  const woodland=kind==='woodland'
  const landTone=water?0x77785c:rock?0x97816c:0x9a8b62
  scene.fog=new T.FogExp2(water?0xa0b5a9:rock?0xc3b59c:0xaeb2a0,water?.041:.030)
  sky(scene,[-1,-.08,.035,.23,.77,1],
    water?['#697d73','#a7b4a6','#e4d4b5','#b3c4c3','#829ea4','#718d9c']:
      ['#7a806c','#a49d8f','#ead6b5','#bbcad0','#87a6b6','#7193a7'],
    v(-.82,.15,-.53).normalize(), '#fff1c6')

  const bankZ=(x)=>-2.95+Math.sin(x*.32)*.94+.35*Math.sin(x*.83)
  const height=(x,z)=>{
    const distance=Math.hypot(x,z)
    const hills=(.24*Math.sin(x*.62+z*.20)+.13*Math.cos(z*.88)+.15*Math.sin(x*.20-z*.34))*
      T.MathUtils.smoothstep(distance,.3,3.3)
    const base=lowPerch?.06:woodland?-2.35:water?-1.07:-1.58
    const relief=hills-.018*distance - (water ? Math.max(0,bankZ(x)-z)*.54 : 0)
    // Both feet, including the forward toes, rest on the level mound summit.
    return base + (lowPerch ? T.MathUtils.smoothstep(distance,1.03,2.5)*(relief-.24) : relief)
  }
  const land=new T.PlaneGeometry(82,82,144,144);land.rotateX(-Math.PI/2)
  const pos=land.attributes.position,colors=[],lo=new T.Color(landTone).multiplyScalar(.70)
  const hi=new T.Color(water?0xa8ac7d:rock?0xcdb9a1:0xc4b27d)
  const c=new T.Color()
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i)
    pos.setY(i,height(x,z))
    c.copy(lo).lerp(hi,.48+.20*Math.cos(x*.42+z*.53)+.14*Math.sin(z*.64-x*.37)+.10*rng())
    colors.push(c.r,c.g,c.b)
  }
  land.setAttribute('color',new T.Float32BufferAttribute(colors,3));land.computeVertexNormals()
  const terrain=new T.Mesh(land,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));terrain.receiveShadow=true;scene.add(terrain)

  const grass=[],tones=[]
  const count=rock?146:water?500:900
  for(let i=0;i<count;i++){
    const a=TAU*rng(),r=1.25+Math.pow(rng(),.65)*19
    const x=Math.sin(a)*r,z=Math.cos(a)*r,y=height(x,z)
    if(water && z<bankZ(x)-.1)continue
    const reed=water&&Math.abs(z-bankZ(x))<1.5
    const h=(reed?.72:.18)+rng()*(reed?.79:.55)
    for(let j=0;j<6;j++){
      const px=x+(rng()-.5)*.28,pz=z+(rng()-.5)*.25, dx=(rng()-.42)*.57, dz=(rng()-.5)*.33, w=.008+.013*rng()
      const midx=px+dx*.28,midz=pz+dz*.3,midy=y+h*.62
      grass.push(px-w,y,pz,px+w,y,pz,midx+w*.59,midy,midz,
        px-w,y,pz,midx+w*.59,midy,midz,midx-w*.59,midy,midz,
        midx-w*.59,midy,midz,midx+w*.59,midy,midz,px+dx,y+h,pz+dz)
      c.setHSL((water?.17:.113)+rng()*.035,.17+rng()*.18,.21+rng()*.23)
      for(let k=0;k<9;k++)tones.push(c.r,c.g,c.b)
    }
  }
  const blades=new T.BufferGeometry();blades.setAttribute('position',new T.Float32BufferAttribute(grass,3));blades.setAttribute('color',new T.Float32BufferAttribute(tones,3))
  const tuft=new T.Mesh(blades,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));tuft.userData.backgroundPlant=true;scene.add(tuft)

  if(water) {
    const pond=new T.PlaneGeometry(78,78,110,110);pond.rotateX(-Math.PI/2)
    const pts=pond.attributes.position,flow=[]
    const y=lowPerch?-.49:-1.38
    for(let i=0;i<pts.count;i++){
      const x=pts.getX(i),z=pts.getZ(i)
      pts.setY(i,y+.018*Math.sin(5.8*z+.83*Math.sin(2.4*x))+.008*Math.cos(x*2+z*11))
      const glimmer=Math.max(0,Math.cos(z*4.1+.71*Math.sin(x*.94)))**7
      c.set(0x617b76).lerp(new T.Color(0xadb6a2),.16+.43*glimmer);flow.push(c.r,c.g,c.b)
    }
    pond.setAttribute('color',new T.Float32BufferAttribute(flow,3));pond.computeVertexNormals()
    const surface=new T.Mesh(pond,new T.MeshStandardMaterial({vertexColors:true,roughness:.39,metalness:.08}))
    surface.receiveShadow=true;scene.add(surface)
  }
  if(rock || water) {
    const pebble=new T.DodecahedronGeometry(1,1),mat=standard(rock?0x907c66:0x828676)
    const stones=new T.InstancedMesh(pebble,mat,rock?110:45),dummy=new T.Object3D()
    for(let i=0;i<stones.count;i++){
      const a=rng()*TAU,r=1.45+rng()*11,x=Math.sin(a)*r,z=Math.cos(a)*r,f=.095+rng()*.34
      dummy.position.set(x,height(x,z)+f*.11,z);dummy.rotation.set(rng()*.32,a,rng()*.25)
      dummy.scale.set(f*1.4,.61*f,f*(.65+rng()));dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix)
    }
    stones.receiveShadow=stones.castShadow=true;scene.add(stones)
  }
  if(!rock) distantHedgerow(scene,rng)
  if (!lowPerch) makeSeat(scene,'forest',timber(seed%401+8,!woodland))
}

function lights(scene, kind) {
  const palettes={
    night:[0xd7ebff,0x4f5669,.78,0xe5f2ff,2.28,[-3.2,4.3,4.4],0x82afff,2.8,[2.2,3.6,-4.2]],
    barn:[0xf0f5ff,0x656764,1.25,0xffeac8,2.65,[-2.6,4.1,4.3],0xffd497,2.3,[1.1,3.6,-4.3]],
    snow:[0xe8f2ff,0xb0c0ce,1.25,0xffe3bd,2.25,[-4.2,3.7,2.85],0xe9f3ff,1.24,[2.0,4.0,-5.1]],
    forest:[0xdfeaf7,0x586154,.95,0xffe5bd,2.65,[3.0,5.1,3.5],0xffe0bd,2.2,[-2.1,3.45,-4.65]],
  }
  const field=[0xe0edf4,0x7e795f,1.13,0xffedc9,2.48,[-3.3,4.5,4.2],0xffd8ae,1.50,[3.3,3.7,-3.8]]
  const [sky,ground,bounce,keyTone,keyPower,keyAt,rimTone,rimPower,rimAt]=palettes[kind] || field
  scene.add(new T.HemisphereLight(sky,ground,bounce))
  const key=new T.DirectionalLight(keyTone,keyPower)
  key.position.set(...keyAt);key.target.position.set(0,1,0);key.castShadow=true
  Object.assign(key.shadow.camera,{left:-3.4,right:3.4,top:3.6,bottom:-2.4,near:.1,far:18})
  key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.00019;key.shadow.normalBias=.014;key.shadow.intensity=.60;key.shadow.radius=2.5
  scene.add(key,key.target)
  const lifted=new T.DirectionalLight(kind==='barn'?0xcaddfa:0xe1edff,kind==='barn'?.65:.39)
  lifted.position.set(3,2.35,4.4);scene.add(lifted)
  const rim=new T.DirectionalLight(rimTone,rimPower)
  rim.position.set(...rimAt);scene.add(rim)
}
// A bright opening and broad sky hemisphere are reflected by the cornea.
function skylight(renderer, kind) {
  const w=128,h=64, pixels=new Float32Array(w*h*4)
  const window=v(.45,.56,.69).normalize(), side=v(-.76,.39,.53).normalize()
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const lon=((i+.5)/w-.5)*TAU,lat=((j+.5)/h-.5)*Math.PI
    const c=Math.cos(lat),x=Math.cos(lon)*c,y=Math.sin(lat),z=Math.sin(lon)*c
    const outdoor=kind==='snow'
    const hemi=(outdoor?.54:.15)+Math.pow(Math.max(0,y),.5)*(outdoor?.69:.42)
    const highlight=Math.pow(Math.max(0,x*window.x+y*window.y+z*window.z),155)*46
    const reflection=Math.pow(Math.max(0,x*side.x+y*side.y+z*side.z),65)*13
    const k=(j*w+i)*4
    pixels[k]=hemi*.93+highlight+reflection*.78
    pixels[k+1]=hemi*.99+highlight*.95+reflection*.90
    pixels[k+2]=hemi*1.10+highlight*.85+reflection
    pixels[k+3]=1
  }
  const map=new T.DataTexture(pixels,w,h,T.RGBAFormat,T.FloatType)
  map.mapping=T.EquirectangularReflectionMapping;map.needsUpdate=true
  const pmrem=new T.PMREMGenerator(renderer)
  const target=pmrem.fromEquirectangular(map)
  pmrem.dispose();map.dispose();return target
}

export function habitat(id, renderer, night = false) {
  const scene=new T.Scene()
  let glints=null
  const {stage,ground} = motionFor(id)
  const seed = Array.from(id).reduce((n,k)=>(Math.imul(n,31)+k.charCodeAt(0))>>>0,19)
  if (night) {
    sky(scene,[-1,-.12,.16,1],['#060a15','#101b36','#162744','#090e1d'],v(-.62,.24,-.75).normalize(),'#304775')
    makeSeat(scene,stage,timber(stage==='snow'?92:202,stage==='snow'))
  }else if(stage==='barn'){
    barn(scene)
  }else if(stage==='snow'){
    tundra(scene)
  }else if(stage==='boreal'){
    boreal(scene,seed)
  }else if(stage==='forest'){
    glints=createForest(scene,false,id==='Bubo_bubo'?92011:seed);scene.fog=new T.FogExp2(0x4f605a,.069)
    if(id!=='Bubo_bubo'){
      forestUnderstory(scene,seed+71)
      scene.traverse(node=>{
        if(node.isMesh && !node.material?.isShaderMaterial)node.userData.backgroundPlant=true
      })
    }
    makeSeat(scene,'forest',timber(id==='Bubo_bubo'?202:seed%415+5,false))
  }else{
    openCountry(scene,stage,seed,ground)
  }
  // Foliage cards are for the distant habitat. While orbiting, a camera can pass
  // behind a near crown; clip plants on the camera side of the specimen then.
  // The perch always remains physical and the original three scenes retain their framing.
  let plantPlane=null
  if(!['Tyto_alba','Bubo_scandiacus','Bubo_bubo'].includes(id)) {
    scene.traverse(node=>{
      if(!node.userData.backgroundPlant)return
      plantPlane ||= new T.Plane()
      for(const m of [node.material].flat())m.clippingPlanes=[plantPlane]
    })
  }
  lights(scene,night?'night':stage)
  const illumination=skylight(renderer,stage==='snow'?'snow':'shade')
  scene.environment=illumination.texture;scene.environmentIntensity=night?.49:.68
  return {scene,glints,illumination,plantPlane}
}
