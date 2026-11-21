import * as T from '../vendor/three.module.js'
import {v,random,mix,smooth,clamp,color,plumage} from './feathers.js'
import {perchAt,perchRadius} from './perch.js'
import {profileFor,studies} from './profiles.js'

const TAU=Math.PI*2
const sphere=new T.SphereGeometry(1,32,22)
const modes={bars:1,streaks:2,spot:3}
const snowInk=new T.Color('#453d38')
const silverBuff=new T.Color('#9f978c')

function model(geometry,material,parent,point,scale){
  const mesh=new T.Mesh(geometry,material)
  mesh.position.copy(point)
  mesh.scale.copy(scale)
  mesh.castShadow=mesh.receiveShadow=true
  parent.add(mesh)
  return mesh
}
const std=(x,roughness=.86)=>new T.MeshStandardMaterial({color:x,roughness})
const nd=(a,b)=>a.clone().sub(b).normalize()
const blend=(a,b,t)=>a.clone().lerp(b,clamp(t))

function taperedCurve(points,radii,material,parent,sections=18,sides=9,aspect=1){
  const line=new T.CatmullRomCurve3(points)
  const basis=line.computeFrenetFrames(sections,false)
  const pos=[],idx=[]
  for(let i=0;i<=sections;i++){
    const t=i/sections,q=t*(radii.length-1),a=Math.floor(q)
    const r=mix(radii[a],radii[Math.min(a+1,radii.length-1)],q-a)
    const qpoint=line.getPointAt(t)
    for(let j=0;j<=sides;j++){
      const angle=j/sides*TAU
      const p=qpoint.clone().addScaledVector(basis.normals[i],r*Math.cos(angle))
        .addScaledVector(basis.binormals[i],r*aspect*Math.sin(angle))
      pos.push(...p)
      if(i&&j){
        const n=i*(sides+1)+j
        idx.push(n-sides-2,n-sides-1,n,n-sides-2,n,n-1)
      }
    }
  }
  const geo=new T.BufferGeometry()
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return model(geo,material,parent,v(0,0,0),v(1,1,1))
}

// Longitudinal body sections are measured along the breast-to-rump axis. A
// forward keel, a raised mantle and a trailing rump make the profile change
// continuously between the frontal breast and the folded dorsal silhouette.
function fitBody(t,phi,p) {
  const h=Math.cos(t), r=Math.sin(t), front=Math.cos(phi), side=Math.sin(phi)
  const barn=p.id==='Tyto_alba', snowy=p.id==='Bubo_scandiacus'
  const shoulder=Math.exp(-(((h-.49)/.42)**2))
  const keel=Math.exp(-(((h-.04)/.56)**2))
  const width=.52*p.width*(1+.23*h-.08*h*h+shoulder*(snowy?.24:barn?.04:.21))
  const depth=.46*p.width*(1+.12*h+.18*keel*Math.max(0,front))
  const axis=(barn?.39:snowy?.49:.44)*h-(barn?.26:snowy?.22:.30)*h*h
  const y=.81*p.body*h + r*Math.max(0,-front)*shoulder*(barn?.06:.16)
  const throat=smooth(.19,.76,h)*r*Math.max(0,front)*(barn?.07:.27)
  return v(width*r*side,y,axis+r*front*depth-throat)
}

function headSection(h,p){
  const snowy=p.id==='Bubo_scandiacus', barn=p.disk==='heart'
  return {
    width:p.head*(barn?.66:snowy?.68:.64)*(1-.12*h*h+.055*h),
    depth:p.head*(barn?.485:snowy?.54:.515)*(1+.14*h),
    axis:p.head*(-.046+.044*h)
  }
}

function skullFront(x,h,p){
  const {width,depth,axis}=headSection(h,p)
  const z=Math.sqrt(Math.max(0,1-h*h-(x/width)**2))*depth
  const ax=Math.abs(x)/p.head
  const orbit=Math.exp(-(((ax-.209)/.144)**2+((h-.16)/.38)**2))
  const rim=Math.exp(-(((ax-.383)/.109)**2+((h-.10)/.52)**2))
  return axis+z + p.head*(-orbit*(p.disk==='heart'?.138:.089)+rim*.028)
}

function fitHead(t,phi,p) {
  const h=Math.cos(t),r=Math.sin(t),front=Math.cos(phi)
  const {width,depth,axis}=headSection(h,p)
  const x=r*Math.sin(phi)*width
  return v(x,.508*p.tall*h,front>0?skullFront(x,h,p):axis+depth*r*front)
}

// The down layer follows the same shape as the outer feather tracts. An
// ellipsoid would poke through the narrower belly and the flattened owl face.
function downLayer(parent,p,isHead){
  const fit=isHead?fitHead:fitBody
  const [back,belly,face,ink]=p.colors.map(color)
  const pos=[],rgb=[],indices=[]
  const rows=36,sides=76
  for(let i=0;i<=rows;i++){
    const pole=i===0||i===rows
    const t=Math.PI*i/rows
    for(let j=0;j<(pole?1:sides);j++){
      const phi=j/sides*TAU
      const q=fit(t,phi,p).multiplyScalar(.968)
      const tone=blend(back,isHead?face:belly,smooth(-.13,.93,Math.cos(phi))*(isHead?.48:.98))
      if(isHead&&p.id==='Bubo_bubo'){
        const m=featherField(q.x*28+q.z*3,q.y*32)
        tone.lerp(ink,.35+.47*m)
      }
      pos.push(...q)
      rgb.push(...tone.toArray())
    }
  }
  const last=1+(rows-1)*sides
  for(let j=0;j<sides;j++){
    const k=(j+1)%sides
    indices.push(0,1+j,1+k)
    for(let i=0;i<rows-2;i++){
      const a=1+i*sides+j,b=1+i*sides+k
      indices.push(a,a+sides,b+sides,a,b+sides,b)
    }
    indices.push(last-sides+j,last,last-sides+k)
  }
  const g=new T.BufferGeometry()
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3))
  g.setAttribute('color',new T.Float32BufferAttribute(rgb,3))
  g.setIndex(indices); g.computeVertexNormals()
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1})
  const mesh=model(g,material,parent,v(0,0,0),v(1,1,1))
  mesh.name=isHead?'Cranial down':'Body down'
}

function makeLayer(owner,samples,detail,shader,pieces){
  const layer=plumage(samples,shader,detail)
  owner.add(layer)
  pieces.push(layer)
  layer.userData.featherRegion=detail==='flight'?'flight':detail==='fine'?'facial':'down'
  return layer
}

function featherField(x,y){
  const i=Math.floor(x),j=Math.floor(y)
  const fx=smooth(0,1,x-i),fy=smooth(0,1,y-j)
  const cell=(a,b)=>{
    const n=Math.sin(a*127.1+b*311.7)*43758.5453
    return n-Math.floor(n)
  }
  return mix(mix(cell(i,j),cell(i+1,j),fx),mix(cell(i,j+1),cell(i+1,j+1),fx),fy)
}

// Regional marks share positions between the facial undercoat, its individual
// feathers and the skin-backed lid rim. They follow the owl when it turns.
const cream=color('#efe5ce'), bone=color('#f2e9dd'), peat=color('#302923')
const ochre=color('#aa652c'), earth=color('#62452e'), carbon=color('#201b19')

// Regional field marks from the adult plates. Upper and lower tracts may
// change both ground colour and marking direction on the same bird.
const breastTracts={
  Ninox_strenua:['#f0e9db','#322b28','bars'],
  Ninox_rufa:['#d5ab78','#843e20','bars'],
  Ninox_sumbaensis:['#e5d5af','#9b5830','broken','#884221'],
  Taenioptynx_brodiei:['#e0d9bf','#533820','shafts','#97754d','bars'],
  Taenioptynx_sylvaticus:['#ebe4d3','#985836','shafts'],
  Aegolius_harrisii:['#e3ad51','#ac6c26','plain'],
  Athene_blewitti:['#eee8db','#4b392c','sides'],
  Athene_jacquinoti:['#dfab59','#793f26','broken','#493022'],
  Glaucidium_tephronotum:['#f3e9d8','#57331e','drops','#8f4323'],
  Glaucidium_albertinum:['#974823','#e7ce9c','broken'],
  Glaucidium_cuculoides:['#e6d7be','#76503a','shafts','#be946c','bars'],
  Glaucidium_castanotum:['#e9decc','#714427','shafts','#c69665','bars'],
  Glaucidium_castanopterum:['#eed9b9','#884723','shafts','#b88050','bars'],
  Glaucidium_cobanense:['#ddbb8b','#9c592e','shafts'],
  Glaucidium_bolivianum:['#e9dbc1','#945a2e','shafts'],
  Glaucidium_griseiceps:['#f1e1c5','#9c542e','shafts'],
  Glaucidium_brasilianum:['#e9d3b2','#9a4c23','shafts'],
  Otus_gurneyi:['#daa767','#50351e','shafts'],
  Otus_alfredi:['#dfd9c2','#91644e','bars','#994a2c'],
  Asio_clamator:['#ead1a4','#392a21','shafts'],
  Asio_otus:['#d6b98c','#4c3b29','shafts'],
  Asio_solomonensis:['#c98944','#312721','shafts'],
  Jubula_lettii:['#c78c49','#69402b','bars'],
  Bubo_virginianus:['#d8c9a8','#48392c','bars','#927756','drops'],
  Bubo_nacurutu:['#e0d7ba','#514335','bars','#8f785c','drops'],
  Bubo_magellanicus:['#c9c7b7','#4a413a','bars','#77716a','drops'],
  Bubo_nigrescens:['#524b44','#938c80','broken','#332e29','drops'],
  Bubo_bengalensis:['#e0b77d','#3a291d','shafts','#c39260','drops'],
  Bubo_capensis:['#d1c5b2','#493a30','bars','#ccb99a','drops'],
  Bubo_africanus:['#d1bf9d','#534332','bars','#9c805a','drops'],
  Ketupa_leucosticta:['#e6c198','#773d22','broken','#5b3021','spots'],
  Ketupa_shelleyi:['#e2d3be','#4f3e36','bars','#674e40','broken'],
  Ketupa_nipalensis:['#ece5d3','#4c3828','drops'],
  Ketupa_flavipes:['#cb924b','#66401f','shafts'],
  Ketupa_ketupu:['#cd9b5b','#6d482a','shafts'],
  Ketupa_philippensis:['#d4a167','#563621','shafts'],
  Gymnasio_nudipes:['#d8cebb','#8f5737','bars','#975b38','broken'],
  Megascops_albogularis:['#c69b66','#503722','bars','#46372b','spots'],
  Pulsatrix_koeniswaldiana:['#d79d49','#995c28','plain','#4d352b'],
  Pulsatrix_melanota:['#dbc29e','#5f412e','bars','#47352c'],
  Strix_occidentalis:['#665343','#e2d1b0','spots'],
  Strix_varia:['#ded6be','#5b4936','shafts','#dfd2b9','bars'],
  Strix_sartorii:['#e2d8c6','#594d42','shafts','#d9ccc0','bars'],
  Strix_hylophila:['#875235','#cdaa85','bars'],
  Strix_rufipes:['#e9dbc4','#634637','bars'],
  Strix_nigrolineata:['#e7e6dc','#312e2b','fine-bars'],
  Strix_huhula:['#342e2a','#cbc5b6','narrow'],
  Strix_albitarsis:['#d5bf9e','#714831','broken','#653d2a','broken'],
}
const crownTracts={
  Glaucidium_tephronotum:'#555253',Glaucidium_albertinum:'#884023',
  Glaucidium_cobanense:'#82461f',Glaucidium_griseiceps:'#6b6664',
  Glaucidium_brasilianum:'#974c24',Otus_alfredi:'#93462a',
}
const paleTufts=new Set(['Otus_sagittatus','Otus_brookii','Lophostrix_cristata'])
const lateralTufts={
  Jubula_lettii:.76,Lophostrix_cristata:.94,Ketupa_blakistoni:.82,Ketupa_zeylonensis:.90,
  Ketupa_flavipes:.79,Ketupa_ketupu:.98,Ketupa_sumatrana:1,Ketupa_nipalensis:.94,Ketupa_philippensis:.94,
}
const eagleTracts=new Set(['Bubo_virginianus','Bubo_nigrescens','Bubo_nacurutu','Bubo_magellanicus','Bubo_bengalensis','Bubo_capensis','Bubo_africanus'])
const whiteDiscs=new Set(['Ptilopsis_leucotis','Ptilopsis_granti','Asio_clamator'])
const darkHoods=new Set(['Pulsatrix_koeniswaldiana','Pulsatrix_melanota','Strix_nigrolineata','Strix_huhula'])
function individualBreast(tone,p,breast,theta,phi,h,side,grain){
  const tract=breastTracts[p.id]
  if(!tract||breast<.001)return
  const [ground,dye,pattern,collar,upperPattern]=tract
  const base=color(ground),pigment=color(dye)
  const band=smooth(.12,.78,.5+.5*Math.cos(theta*(p.id==='Ninox_rufa'?43:31)+1.8*Math.cos(4*phi)+grain*1.2))
  const stem=smooth(.49,.84,.5+.5*Math.cos(phi*20+1.6*grain+Math.sin(theta*4+.6)))
  const patch=smooth(.52,.88,featherField(phi*16,theta*12))
  let mark=0
  if(pattern==='bars')mark=band
  if(pattern==='shafts')mark=stem*(.66+.33*grain)
  if(pattern==='sides')mark=band*smooth(.21,.54,side)
  const drop=stem*smooth(.20,.74,.5+.5*Math.cos(theta*23+grain*.9))
  if(pattern==='drops')mark=drop
  if(pattern==='narrow'||pattern==='fine-bars'){
    const ribbon=.5+.5*Math.cos(theta*52+.71*Math.sin(phi*7)+grain*.57)
    mark=smooth(pattern==='narrow'?.81:.64,.975,ribbon)
  }
  if(pattern==='spots')mark=smooth(.42,.76,grain)*smooth(.19,.81,.5+.5*Math.cos(theta*22+3.2*Math.sin(phi*6)))
  if(pattern==='broken')mark=band*smooth(.26,.72,grain)
  const lower=base.lerp(pigment,mark*(.79+.19*grain))
  if(collar){
    const upper=color(collar)
    if(upperPattern==='bars')upper.lerp(pigment,band*.89)
    else if(upperPattern==='drops')upper.lerp(pigment,drop*.95)
    else if(upperPattern==='broken')upper.lerp(pigment,band*smooth(.28,.65,grain)*.82)
    else if(upperPattern==='spots')upper.lerp(cream,patch*.86)
    else upper.lerp(pigment,patch*.27)
    lower.lerp(upper,smooth(-.10,.22,h+.09*Math.cos(3*phi)))
  }
  tone.lerp(lower,breast*(.89+.08*grain))
}
function plumageDensity(value){
  // Deeper incident shadows in pigment-rich tracts; the shaft and white spots
  // keep their separate light reflectance even under the same studio lights.
  return .52+.49*smooth(.045,.53,Math.max(value.r,value.g,value.b))
}
function facePigment(point,r,p,tone){
  const f=p.features
  if(!f)return tone
  const x=Math.abs(point.x)/p.head,y=point.y/p.tall
  const dx=x-.224,dy=y-(p.disk==='brow'?.053:.077)
  const ellipse=Math.hypot(dx/.18,dy/.139)
  const grain=featherField(x*57+y*3,y*64)
  const edge=smooth(.83,.95,r)
  const gauss=t=>Math.exp(-t*t)
  const ink=color(p.colors[3])
  if(p.disk==='shallow')tone.lerp(color(p.colors[2]),.45).lerp(ink,.43*smooth(.47,.80,grain))
  if(f.has('spectacles'))tone.lerp(carbon,.42)
  if(f.has('cinnamon-stipple')){
    const freckles=smooth(.43,.73,featherField(x*52+y*11,y*39))
    tone.lerp(ochre,.60).lerp(ink,freckles*.58)
  }
  if(f.has('rings')){
    const dial=Math.hypot(dx/.36,dy/.39)
    const ripples=smooth(.30,.90,.5+.5*Math.cos(dial*34+grain*3.9+1.9*Math.sin(Math.atan2(dy,dx)*5.1)))
    tone.lerp(ink,ripples*(.52+.25*grain)*(1-edge)).lerp(peat,.14*smooth(.24,.66,grain))
    tone.lerp(cream,(1-ripples)*.25)
  }
  if(f.has('deep-orbits'))tone.lerp(peat,(1-smooth(.79,1.29,ellipse))*.76)
  if(f.has('facial-rim')){
    const sideMask=smooth(.264,.417,x)*(1-smooth(.455,.558,x))*smooth(-.371,-.244,y)
    const frame=p.id==='Surnia_ulula'?Math.max(.9*edge,sideMask):edge
    tone.lerp(ink,frame*(.57+.38*smooth(.09,.44,x))).lerp(carbon,sideMask*(p.id==='Surnia_ulula'?.78:.07))
  }
  if(f.has('white-brow')||f.has('spectacles')){
    const slope=.103+.27*x+.025*Math.sin(x*7)
    const brow=gauss((y-slope)/(.029+.017*smooth(0,.37,x)))*
      smooth(.025,.11,x)*(1-smooth(.44,.56,x))
    const sideburn= f.has('spectacles') ? gauss((x-(.083+.33*Math.max(0,-y)))/.043)*
      smooth(-.25,-.15,y)*(1-smooth(.039,.14,y)) : 0
    const sweep=f.has('spectacles')?gauss((ellipse-1.07)/.19)*smooth(.035,-.07,dy)*smooth(.28,.14,x)*.72:0
    tone.lerp(bone,Math.max(brow,.97*sideburn,sweep)*(.90+.08*grain))
  }
  if(f.has('bow-tie')){
    const band=gauss((y-(-.20-.36*x))/ .059)*smooth(.017,.11,x)*(1-smooth(.24,.34,x))
    const knot=gauss(x/.085)*gauss((y+.201)/.096)
    tone.lerp(peat,knot*.93).lerp(bone,band*.98)
  }
  if(whiteDiscs.has(p.id)){
    const cheek=gauss((x-(.40+.13*y))/.067)*smooth(-.36,-.23,y)
    const ring=smooth(.74,.91,r)*smooth(.038,.27,x)
    tone.lerp(bone,.77).lerp(carbon,Math.max(cheek,ring)*.99)
  }
  if(p.id==='Asio_otus'||p.id==='Asio_solomonensis'){
    const outer=gauss((x-(.367+.23*y))/.052)*smooth(-.32,-.20,y)
    const base=p.id==='Asio_solomonensis'?color('#5e3426'):color('#956c48')
    tone.lerp(base,.65).lerp(carbon,Math.max(outer,1-smooth(.67,1.33,ellipse))*.86)
    if(p.id==='Asio_solomonensis'){
      const brow=gauss((y-.104-.41*x)/.045)*smooth(.023,.09,x)
      const bridge=gauss((x-.104+.56*y)/.043)*smooth(-.27,-.20,y)*(1-smooth(.012,.10,y))
      tone.lerp(bone,.98*Math.max(brow,bridge))
    }
  }
  if(darkHoods.has(p.id)){
    const dark=p.id.startsWith('Strix')?color('#292528'):color('#483026')
    tone.lerp(dark,.82)
    if(p.id.startsWith('Pulsatrix')){
      const brow=gauss((y-.098-.37*x)/.046)*smooth(.018,.11,x)
      const bridge=gauss((x-.125+.47*y)/.043)*smooth(-.28,-.17,y)*(1-smooth(.04,.14,y))
      tone.lerp(p.id==='Pulsatrix_koeniswaldiana'?color('#d7ac6f'):bone,.98*Math.max(brow,bridge))
    }
  }
  if(p.id==='Aegolius_harrisii'){
    const blackMask=(1-smooth(1.02,1.84,ellipse))*.90
    const yellowBrow=gauss((y-(.13+.25*x))/.045)*smooth(.032,.14,x)*(1-smooth(.43,.51,x))
    tone.lerp(color('#392b25'),blackMask).lerp(color('#e9bb5d'),yellowBrow)
  }
  if(p.id==='Otus_gurneyi'){
    const cheek=smooth(.30,.46,x)*(1-smooth(.50,.57,x))
    tone.lerp(carbon,.69*(1-smooth(.70,1.2,ellipse))).lerp(earth,cheek)
    tone.lerp(color('#e1bd80'),cheek*gauss((x-.443-.2*y)/.040))
  }
  if(paleTufts.has(p.id)){
    const brow=gauss((y-.12-.44*x)/.063)*smooth(.013,.12,x)
    tone.lerp(bone,brow*(.86+.12*grain))
  }
  if(crownTracts[p.id])tone.lerp(color(crownTracts[p.id]),.38*(1-edge))
  if(f.has('white-throat'))tone.lerp(cream,gauss((y+.32)/.079)*gauss(x/.22)*.85)
  return tone
}

function coatPigment(tone,p,head,theta,phi,point,breast,mottle){
  const f=p.features, back=color(p.colors[0]),belly=color(p.colors[1]),ink=color(p.colors[3])
  const h=Math.cos(theta), front=Math.cos(phi)
  const side=Math.abs(Math.sin(phi)),rear=smooth(.05,-.81,front)
  const coarse=featherField(phi*6.8+Math.sin(theta*5),theta*8)
  const local=featherField(point.x*36+point.z*11,point.y*53)
  const shaftGrain=featherField(phi*26+coarse*1.9,theta*9)
  if(head){
    const crowns=smooth(-.55,.34,h), sideSurface=1-breast*.62
    if(p.design!=='plain'){
      tone.lerp(ink,(.16+.66*smooth(.43,.78,shaftGrain))*sideSurface)
      tone.lerp(cream,.27*smooth(.61,.9,local)*crowns)
    }
    if(f.has('crown-shafts')||f.has('mottled-mantle')){
      tone.lerp(cream,.58*smooth(.40,.75,local)*smooth(.31,.67,coarse)).lerp(carbon,.73*smooth(.53,.82,shaftGrain))
    }
    if(f.has('cinnamon-stipple')){
      tone.lerp(ochre,.67)
      tone.lerp(ink,smooth(.47,.74,shaftGrain)*(.57+.41*local))
    }
    if(p.id==='Surnia_ulula'){
      const sides=side*smooth(.04,.90,front)
      const cheekStripe=smooth(.55,.87,side)*smooth(-.30,.43,front)*(1-smooth(.34,.76,h))
      tone.lerp(carbon,Math.max(cheekStripe,sides*.22))
    }
    if(f.has('nape-eyes')){
      const nx=(Math.abs(point.x)/p.head-.24)/.148, ny=(point.y/p.tall-.02)/.142
      const radius=Math.hypot(nx,ny),mark=(1-smooth(.91,1.44,radius))*rear
      tone.lerp(cream,mark).lerp(ink,(1-smooth(.61,.94,radius))*rear)
    }
    if(eagleTracts.has(p.id))tone.lerp(ink,.65*smooth(.34,.75,shaftGrain)).lerp(cream,.58*smooth(.51,.80,local)*smooth(.29,.72,coarse))
    if(darkHoods.has(p.id))tone.lerp(p.id.startsWith('Pulsatrix')?color('#473127'):color('#302a29'),.7)
    if(crownTracts[p.id])tone.lerp(color(crownTracts[p.id]),(.52+.19*coarse)*crowns)
    if(f.has('spotted-crown')){
      const speck=featherField(phi*23,theta*21)
      tone.lerp(cream,smooth(.64,.87,speck)*smooth(-.60,.58,h)*(.54+.40*rear))
    }
    if(f.has('spectacles'))tone.lerp(back,.89).lerp(carbon,.46+.15*local)
    return tone.multiplyScalar(plumageDensity(tone))
  }
  const fine=featherField(phi*12+.8*Math.sin(theta*12),theta*8)
  const shaft=smooth(.51,.88,.5+.5*Math.cos(phi*27+4.2*coarse+1.2*Math.sin(4*theta)))
  const stripe=smooth(.26,.82,.5+.5*Math.cos(theta*48+2.5*Math.abs(Math.sin(4*phi))+2.2*mottle))
  const flank=.77+.23*side
  if(p.design==='bars'||f.has('transverse-belly')){
    tone.lerp(ink,stripe*breast*flank*(.60+.25*fine))
  }else if(p.design==='streaks'){
    tone.lerp(ink,shaft*breast*(.41+.42*coarse)*smooth(-.96,-.42,h))
  }
  if(p.design==='spot'||f.has('pale-spots')){
    tone.lerp(cream,smooth(.54,.83,fine)*(1-breast)*(.55+.29*mottle))
  }
  // A pale throat and dark collar mark different feather tracts. Keeping the
  // collar on the upper chest allows it to remain visible beneath a round head.
  if(f.has('mottled-mantle')){
    tone.lerp(carbon,.78*shaft*breast*(.43+.55*coarse))
    tone.lerp(cream,.71*smooth(.53,.79,fine)*(1-shaft*.72))
    tone.lerp(ink,.68*smooth(.41,.68,local)*(1-breast))
  }
  if(f.has('pale-belly-freckles')){
    tone.lerp(cream,breast*(.32+.64*smooth(.29,.77,coarse))*smooth(.62,.03,h))
    tone.lerp(ink,breast*smooth(.53,.77,shaftGrain)*.76)
  }
  if(f.has('peppered-belly')){
    tone.lerp(ochre,.13+.22*(1-h))
    tone.lerp(ink,smooth(.59,.82,local)*.88*breast)
  }
  if(f.has('cinnamon-stipple')){
    tone.lerp(ochre,.45+.28*mottle)
    tone.lerp(ink,.87*smooth(.48,.78,fine)*(1-.47*breast))
    tone.lerp(carbon,.63*shaft*smooth(.36,.79,local)*breast)
  }
  if(p.id==='Surnia_ulula'){
    const rr=smooth(.18,.72,.5+.5*Math.cos(theta*48+Math.sin(phi*6)*.91+mottle*1.3))
    tone.lerp(cream,.86*breast).lerp(earth,.95*rr*breast)
  }
  if(f.has('plain-belly'))tone.lerp(belly,breast*.99)
  individualBreast(tone,p,breast,theta,phi,h,side,coarse)
  if(f.has('dark-collar')){
    const collarY=.51-.18*(1-side)
    const band=Math.exp(-(((h-collarY)/(f.has('spectacles')?.31:.21))**4))
    tone.lerp(f.has('spectacles')?carbon:back,band*smooth(-.20,.63,front)*.98)
  }
  if(p.id==='Megascops_albogularis'||eagleTracts.has(p.id)&&f.has('white-throat')||p.id.startsWith('Pulsatrix')&&darkHoods.has(p.id)){
    const visibleBib=Math.exp(-(((h-.38)/.125)**2))*Math.exp(-((side/.67)**4))*smooth(.50,.85,front)
    tone.lerp(cream,visibleBib*.96)
  }
  if(f.has('white-throat')||f.has('bow-tie')){
    const bib=Math.exp(-(((h-.70)/.17)**2))*Math.exp(-((side/.60)**4))
    tone.lerp(cream,bib*smooth(.62,.93,front)*.91)
  }
  return tone.multiplyScalar(plumageDensity(tone))
}

function whiskers(owner,p,rng,shader,pieces){
  if(!p.features?.has('whiskers'))return
  const hairs=[], ink=color(p.colors[3]),light=color(p.colors[2])
  for(const side of [-1,1]){
    for(let j=0;j<94;j++){
      const t=rng()
      const start=facePoint(.78+.19*rng(),side*(1.37+.46*t),p)
      const n=v(side*.56,.11,.83).normalize()
      const shaft=v(side*(.86+.14*rng()),.33-.85*t+.27*rng(),-.12-.30*rng()).normalize()
      const tone=blend(ink,light,.20+.63*rng())
      hairs.push({p:start,dir:shaft,n,base:tone,ink,length:(.122+.158*rng())*p.head,
        width:.0014+.0025*rng(),arch:.045+.055*rng(),mode:0,strength:0,phase:rng()})
    }
  }
  makeLayer(owner,hairs,'fine',shader,pieces).name='Lateral facial bristles'
}

// Density and polarity of the little spots differ between sooty, masked and
// grass owls. Their small apical spots are spatially separate from the large
// white marks on a folded wing.
const barnSpotting = {
  Tyto_tenebricosa:[.16,'pale'],Tyto_multipunctata:[.22,'mixed'],
  Tyto_nigrobrunnea:[.17,'dark'],Tyto_sororcula:[.21,'dark'],
  Tyto_manusi:[.105,'dark'],Tyto_aurantia:[.09,'dark'],
  Tyto_novaehollandiae:[.14,'dark'],Tyto_rosenbergii:[.25,'dark'],
  Tyto_deroepstorffi:[.135,'dark'],Tyto_capensis:[.27,'dark'],
  Tyto_longimembris:[.15,'dark'],Tyto_prigoginei:[.31,'dark']
}
const goldenMantles=new Set(['Tyto_furcata','Tyto_javanica','Tyto_novaehollandiae','Tyto_rosenbergii','Tyto_glaucops'])

function contour(owner,p,head,rng,factors,shader,pieces,lightBase){
  const [back,belly,face,ink]=p.colors.map(color)
  const fit=head?fitHead:fitBody
  const fields=[], tips=[]
  const stipple=barnSpotting[p.id]
  const rows=head?43:53, samples=head?91:100
  for(let i=0;i<rows;i++){
    const t=Math.PI*(i+.50)/rows
    const n=Math.round(Math.sin(t)*samples*.91+9)
    for(let j=0;j<n;j++){
      const theta=t+(rng()-.5)*.55/rows
      const phi=(j+(i%2)*.48+.22*rng())/n*TAU
      const point=fit(theta,phi,p)
      const a=fit(theta+.002,phi,p)
      const b=fit(theta,phi+.002,p)
      const down=nd(a,point)
      const across=nd(b,point)
      const normal=down.clone().cross(across).normalize()
      const inFront=Math.cos(phi)
      const top=Math.cos(theta)
      // Leave the forehead feathered through the cleft between the two facial lobes.
      // Only the enclosed, lower orbital part can safely omit its underlying plumes.
      if(head&&inFront>.54&&point.y<.09*p.tall&&discRadius(point.x,point.y,p)<.43) continue
      const breast=smooth(-.13,.93,inFront)
      const mottling=featherField(point.x*8+inFront*2,point.y*6+point.z*3)
      const variations=.85+.12*rng()+.16*mottling
      const neckWhite=p.id==='Bubo_bubo' ? smooth(.78,.95,top)*smooth(.85,1.,inFront)*.38 : 0
      const rootColor=head?blend(back,face,smooth(.07,.87,inFront)*.47):blend(back,belly,Math.pow(breast,.54))
      rootColor.lerp(lightBase,neckWhite).multiplyScalar(variations)
      const pale=p.id==='Bubo_scandiacus'||p.disk==='heart'
      const dark=pale?blend(ink,rootColor,.16):blend(ink,back,rng()*.33)
      // Wider marks on a snowy owl's nape and back form interrupted transverse rows.
      // A quiet white bib separates those rows from the markings on the breast.
      if(p.id==='Bubo_scandiacus'){
        const bib=head?smooth(-.24,.68,inFront):breast*smooth(.06,.49,top)
        const width=head?48:49
        const chevron=Math.abs(Math.sin(phi*5+1.4*theta))
        const wave=theta*width+2.2*featherField(phi*2.8,theta*2.7)+1.8*chevron
        const band=smooth(.32,.82,Math.cos(wave))
        const gaps=smooth(.10,.49,featherField(phi*(head?9:6),theta*8))
        const barring=band*gaps*(1-bib)*(.83+.12*(1-breast))
        rootColor.lerp(color('#b9c2bf'),.12*(1-breast)*mottling)
        rootColor.lerp(snowInk,barring)
      }
      if(p.id==='Tyto_alba'){
        const pepper=(.5+.5*Math.sin(theta*17+phi*3.2))*(.5+.5*Math.cos(phi*11.2-theta*4))
        rootColor.lerp(silverBuff,pepper*(1.-breast)*.79)
        const scapular=(1-breast)*smooth(-.65,.38,top)
        rootColor.lerp(color('#635d56'),scapular*smooth(.46,.85,mottling)*.76)
        rootColor.lerp(color('#f7e4c5'),scapular*smooth(.73,.93,featherField(phi*9,theta*11))*.75)
      }
      if(p.id==='Bubo_bubo'){
        // Dark shaft markings break up at feather-tract boundaries. Crown
        // feathers carry compact flecks while each breast tract narrows into
        // a run of finer abdominal crossbars.
        const drape=phi*18+1.9*Math.sin(theta*3.6+phi*2.3)+6*mottling
        const taper=featherField(phi*4.2,theta*3.0)
        const shaft=smooth(.61,.94,.5+.5*Math.cos(drape))*(.46+.54*taper)
        const upper=smooth(-.46,.55,top)
        const flankBar=smooth(.63,.97,.5+.5*Math.cos(theta*51+phi*8+6*mottling))
        const pigment=head?.86*shaft:Math.max(shaft*(.42+.54*upper),flankBar*(1-upper)*.54)
        const mottled=featherField(point.x*10+point.z*3,point.y*13)
        const streak=smooth(.35,.65,featherField(phi*9+1.1*mottling,theta*4))
        if(head){
          const crown=smooth(.12,.68,top)
          rootColor.lerp(color('#cbb897'),.15)
          const crownMark=clamp(.21+.68*smooth(.30,.65,pigment)+crown*mottled*.55)
          rootColor.lerp(ink,1-(1-crownMark)**2.4)
        }else{
          const fleck=smooth(.38,.76,mottled)*(1-.30*breast)
          rootColor.lerp(color('#eddbc0'),.06+.88*fleck)
          const bold=smooth(.36,.67,pigment*.84 + streak*.49 + .18*mottled)
          rootColor.lerp(color('#302624'),.97*bold)
          const oak=smooth(.50,.87,featherField(point.x*12+point.z*4,point.y*7))
          rootColor.lerp(color('#d0914e'),oak*(1-bold)*(1-fleck)*.44)
        }
        const throat=smooth(.49,.88,top)*smooth(.82,.97,inFront)
        rootColor.lerp(lightBase,throat*.85)
      }
      if(p.features)coatPigment(rootColor,p,head,theta,phi,point,breast,mottling)
      const lay=head?.33:p.id==='Tyto_alba'?.43:.62
      const flow=lay*Math.sin(phi)*Math.sin(theta)+.17*(mottling-.5)
      const along=down.clone().addScaledVector(across,flow).normalize()
      let mode=head?(p.disk==='heart'?1:3):(modes[p.design]||0)
      if(!head && p.features?.has('plain-belly')&&breast>.52)mode=0
      if(p.id==='Strix_varia'&&top>.45&&breast>.49)mode=1
      if(p.id==='Bubo_scandiacus'&&head)mode=1
      const strength=(pale?(p.disk==='heart'?.40:.76):.77)*(.67+.32*rng())*(.46+.54*factors)
      const ringSpacing=point.distanceTo(fit(theta,phi+TAU/n,p))
      const length=point.distanceTo(fit(theta+Math.PI/rows,phi,p))*(head?2.15:2.46)
      const loose=(head?.13:.32)*smooth(.20,.88,Math.abs(Math.sin(phi)))*(1-Math.abs(top))
      fields.push({p:point,dir:along,n:normal,length:length*(1.02+.49*rng()+loose),
        width:ringSpacing*(.71+.28*rng()),arch:.040+.055*rng()+loose*.14,base:rootColor,ink:dark,
        mode,strength:strength*(p.id==='Tyto_alba'?1-.92*breast:
          p.id==='Bubo_scandiacus'?.40-.31*breast*smooth(.12,.70,top):breast*.37+.63),
        freq:head?2:1.15+.77*rng(),phase:rng()})
      if(stipple && (!head||inFront<.45) && fields.at(-1).phase < stipple[0]*(head?.58:1)){
        const f=fields.at(-1), dark=stipple[1]==='dark'||stipple[1]==='mixed'&&breast>.45
        const pigment=dark?carbon:cream
        const anchor=point.clone().addScaledVector(along,f.length*.71).addScaledVector(normal,.0135)
        tips.push({p:anchor,dir:along,n:normal,base:pigment,ink:pigment,length:f.length*(dark?.22:.24),
          width:f.width*(dark?.18:.22),mode:0,strength:0,arch:.05,phase:f.phase})
      }
    }
  }
  const mantle=makeLayer(owner,fields,'coat',shader,pieces)
  mantle.name=head?'Crown and nape plumage':'Breast and dorsal contour'
  mantle.userData.featherRegion='contour'
  if(tips.length)makeLayer(owner,tips,'fine',shader,pieces).name='Pigmented contour tips'
}

function discOutline(phi,p){
  const top=Math.cos(phi)
  const side=Math.abs(Math.sin(phi))
  if(p.disk==='heart') {
    const notch=.251*Math.pow(Math.max(0,top),16)
    const cheek=.585*p.head*(1+.16*top+.32*Math.min(0,top))
    const raised=p.features?.has('raised-ruff')?.107*Math.exp(-(((Math.abs(Math.sin(phi))-.81)/.18)**2))*Math.max(0,top):0
    return v(Math.sin(phi)*cheek,(raised+.439*top-.023-notch+.235*side*Math.max(0,top)-.018*top*top*(top<0))*p.tall,0)
  }
  const flat=p.disk==='brow'?.11:p.disk==='shallow'?.06:0
  return v(Math.sin(phi)*.578*p.head*(1+.041*top),(.444*top-.034-flat*Math.pow(Math.max(0,top),2))*p.tall,0)
}

function discRadius(x,y,p){
  const centerY=-.034*p.tall
  return Math.hypot(x/(.579*p.head),(y-centerY)/(.442*p.tall))
}

function facePoint(r,phi,p){
  const tip=discOutline(phi,p)
  const out=tip.multiplyScalar(r)
  out.y-=.034*p.tall*(1.-r)
  const h=clamp(out.y/(.508*p.tall),-.999,.999)
  const faceDepth=skullFront(out.x,h,p)
  const chin=Math.max(0,-Math.cos(phi))
  const heart=p.disk==='heart'
  const centralBridge=Math.exp(-Math.pow(out.x/(.074*p.head),2))*smooth(-.22,.12,out.y/p.tall)
  const acousticRim=Math.exp(-Math.pow((r-.88)/.11,2))*(heart?.047:.018)
  out.z=faceDepth+(.016+.037*(1-r*r)+.103*chin*chin*r*r+centralBridge*.052+acousticRim)*p.head
  return out
}

function eagleFaceColor(point,r,p){
  const x=Math.abs(point.x)/p.head,y=point.y/p.tall
  const dx=x-.224,dy=y-.053
  const orbit=Math.hypot(dx/.137,dy/.096)
  const grain=featherField(x*23+y*8,y*37)
  const cheek=smooth(.09,.37,x)*smooth(.21,-.08,y)
  const warm=blend(color('#c8b89b'),color('#b67f46'),cheek*.92)
  const dial=Math.atan2(dy,dx)
  const darkOrbit=(1-smooth(.95,1.63,orbit+.13*Math.sin(dial*6)))*(.90-.12*smooth(-.05,.13,dy))
  const malarX=.088-.40*(y+.03)
  const malar=Math.exp(-Math.pow((x-malarX)/.048,2))*smooth(-.30,-.13,y)*smooth(.03,-.037,y)
  const line=.073+(x-.12)*.92
  const vStripe=Math.exp(-Math.pow((y-line)/(.045+.034*x),2))*smooth(.09,.19,x)*smooth(.62,.50,x)
  const rim=smooth(.85,.97,r)*(.20+.36*cheek)
  const cheekStreak=Math.pow(.5+.5*Math.sin(dial*19.+r*6.+grain*5.),5.)*(.28+.53*grain)*cheek
  const crown=smooth(.13,.35,y)*(.37+.60*smooth(.20,.66,grain))
  const mark=Math.max(darkOrbit,.93*malar,rim,cheekStreak,crown,.94*vStripe)
  return warm.multiplyScalar((.87+grain*.27)*(1-.98*mark))
}

function faceUndercoat(owner,p){
  const [back,,face,ink]=p.colors.map(color)
  const center=facePoint(0,0,p)
  const positions=[center.x,center.y,center.z-.012],colors=[face.r,face.g,face.b],indices=[]
  const rings=22,sectors=100
  for(let i=1;i<=rings;i++){
    const r=i/rings
    for(let j=0;j<sectors;j++){
      const q=facePoint(r,j/sectors*TAU,p)
      q.z-=.012
      const rim=smooth(.86,1,r)
      const tone=p.id==='Bubo_bubo'?eagleFaceColor(q,r,p):
        blend(face,p.disk==='heart'?back:ink,rim*(p.disk==='heart'?.88:.54))
      if(p.features)facePigment(q,r,p,tone)
      positions.push(...q)
      colors.push(tone.r,tone.g,tone.b)
      const a=1+(i-1)*sectors+j,b=1+(i-1)*sectors+(j+1)%sectors
      if(i===1)indices.push(0,b,a)
      else indices.push(a-sectors,b,a,b-sectors,b,a-sectors)
    }
  }
  const geo=new T.BufferGeometry()
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.97,side:T.DoubleSide})
  model(geo,material,owner,v(0,0,0),v(1,1,1)).name='Facial disc undercoat'
}

function facialDisc(owner,p,rng,shader,pieces,eyeX,eyeY){
  faceUndercoat(owner,p)
  const [back,,light,ink]=p.colors.map(color)
  const layers=[], fringe=[[],[]]
  const barn=p.disk==='heart'
  const amount=p.disk==='round'?33:29
  for(let i=0;i<amount;i++){
    const r=.065+(i+.46)/amount*.94
    const n=Math.max(16,Math.round(118*r))
    for(let j=0;j<n;j++){
      const phi=(j+.47*(i%2)+(rng()-.5)*.40)/n*TAU
      const point=facePoint(r,phi,p)
      const dist=Math.hypot((Math.abs(point.x)-eyeX)*.98,(point.y-eyeY)*1.08)
      const eyeLimit=.098*(p.id==='Strix_nebulosa'?.83:1.)
      if(dist<eyeLimit) continue
      const a=facePoint(r+.002,phi,p)
      const b=facePoint(r,phi+.002,p)
      const radial=nd(a,point)
      const ring=nd(b,point)
      const nrm=radial.clone().cross(ring).negate().normalize()
      const eye= v(Math.sign(point.x)*eyeX,eyeY,point.z)
      const stream=nd(point,eye)
      stream.addScaledVector(nrm,-stream.dot(nrm)).normalize()
      const axis=stream.lerp(radial,.35+.56*r).normalize()
      const orbit=smooth(.228,.103,dist)
      const edging=smooth(.826,.997,r)
      const concentric=p.disk==='round'?(.5+.5*Math.sin(r*42.+Math.sin(phi*9.)*.64))*(.13+.16*r):0
      const rim=p.disk==='heart'?smooth(.915,1,r)*.91:edging*(p.disk==='shallow'?.26:.54)
      const brow=smooth(.57,.91,Math.cos(phi))*smooth(.47,.78,r)
      const highlights=brow*(p.id==='Athene_cunicularia'||p.id==='Surnia_ulula'? .67:.16)
      const white=color('#f2e9d9')
      const eyeInk=p.disk==='heart'?.39:.45
      let tone=blend(light,ink,orbit*eyeInk+rim+concentric)
      if(p.id==='Bubo_scandiacus')tone=blend(light,ink,orbit*.24+edging*.07)
      if(p.id==='Bubo_bubo')tone=eagleFaceColor(point,r,p)
      const socketY=(point.y-eyeY)/p.tall
      if(barn){
        // The orbital well holds a warm shadow. The ruff carries cool ivory
        // fibres inside a scattering of cinnamon, outermost facial feathers.
        const hollow=orbit*(.32+.30*smooth(-.09,.09,socketY))
        tone=blend(light,color('#786555'),hollow).lerp(blend(back,ink,.28),rim)
        const halo=Math.exp(-Math.pow((r-.83)/.076,2))*.33
        tone.lerp(color('#fff8e8'),halo)
      }
      if(p.features)facePigment(point,r,p,tone)
      tone.lerp(white,highlights).multiplyScalar(.90+.17*rng())
      const step=facePoint(r+.019,phi,p).distanceTo(point)
      const dest=barn && r>.82 ? fringe[point.x>0?1:0] : layers
      const nap=barn?1.19:1
      dest.push({p:point,dir:axis,n:nrm,base:tone,ink:blend(ink,back,.61),
        length:Math.max(.018,step*2.33)*(.94+.28*rng())*nap,width:.0048+point.distanceTo(facePoint(r,phi+TAU/n,p))*.19,
        arch:.034+rng()*.031,mode:p.id==='Strix_nebulosa'?1:0,strength:.29,freq:2,phase:rng()})
    }
  }
  if(barn){
    for(let j=0;j<880;j++){
      const phi=TAU*rng(),r=.91+.075*rng()
      const base=facePoint(r,phi,p)
      const direction=nd(facePoint(r+.015,phi+.031*Math.sin(phi),p),base)
      const across=nd(facePoint(r,phi+.006,p),base)
      const n=direction.clone().cross(across).negate().normalize()
      const featherBase=base.clone().addScaledVector(n,.005+rng()*.004)
      const bristle=blend(light,p.features?back:color('#bfaa8f'),.08+.25*rng())
      fringe[base.x>0?1:0].push({p:featherBase,dir:direction,n,base:bristle,ink:back,
        length:.024+.041*rng(),width:.001+.0024*rng(),arch:.051,mode:0,strength:0,phase:rng()})
    }
  }
  makeLayer(owner,layers,'fine',shader,pieces)
  if(barn)for(const side of [-1,1]){
    const pivot=new T.Group()
    pivot.name=side>0?'Ruff_L':'Ruff_R'
    pivot.position.set(side*.24*p.head,.08*p.tall,.30*p.head)
    owner.add(pivot)
    const feathers=fringe[side>0?1:0]
    feathers.forEach(f=>f.p.sub(pivot.position))
    makeLayer(pivot,feathers,'fine',shader,pieces)
  }
}

function bill(owner,p){
  const size=(p.disk==='heart'?.66:p.id==='Bubo_scandiacus'?.70:.83)*(p.billBreadth||1)
  const m=std(p.colors[5],.47)
  const before=owner.children.length
  taperedCurve([v(0,-.056,.519*p.head),v(0,-.107,.639*p.head),v(0,-.164,.665*p.head),
    v(0,-.228,.579*p.head),v(0,-.228,.552*p.head)],
    [.075*size,.069*size,.042*size,.021*size,.001],m,owner,28,18,1.09)
  const under=std(blend(color(p.colors[5]),color('#25201c'),.30),.72)
  taperedCurve([v(0,-.138,.510*p.head),v(0,-.183,.582*p.head),v(0,-.205,.563*p.head)],
    [.055*size,.044*size,.006],under,owner,13,14)
  for(const side of [-1,1]){
    const hole=model(sphere,std('#261d1b'),owner,v(side*.047*size,-.091,.599*p.head),v(.010,.007,.018))
    hole.rotation.y=side*.61
  }
  const compression=(p.disk==='heart'?.54:p.id==='Bubo_scandiacus'?.53:.76)*(p.billLength||1)
  const bridge=facePoint(.18,Math.PI,p).z
  const embed=p.id==='Bubo_scandiacus'?.062:p.disk==='heart'?.045:.050
  for(const part of owner.children.slice(before)){
    part.position.z=bridge-embed+(part.position.z-.49*p.head)*compression
    part.scale.z*=compression
    if(p.features)part.scale.y*=p.billLength
  }
}

function orbitalFeathers(owner,p,eyeX,eyeY,rng,shader,pieces){
  const [,belly,face,ink]=p.colors.map(color)
  const snowy=p.id==='Bubo_scandiacus',eagle=p.id==='Bubo_bubo',barn=p.disk==='heart'
  const brows=[],bristles=[]
  for(const side of [-1,1]){
    const radius=Math.hypot(eyeX/(.58*p.head),(eyeY+.034)/(.44*p.tall))
    const surface=facePoint(radius,Math.atan2(eyeX/(.58*p.head),(eyeY+.034)/(.44*p.tall)),p)
    for(let row=0;row<(barn?1:3);row++){
      for(let j=0;j<19;j++){
        const t=(j+rng()*.45)/19,span=(t-.5)*(barn?.20:.27)
        const arc=Math.sin(t*Math.PI)
        const x=side*(eyeX+span),y=eyeY+.052+arc*.037+span*(eagle?.21:.01)+row*.012+(rng()-.5)*.021
        const z=surface.z+(barn?-.026:-.012)-.24*span-.031*(1-arc)-row*.006
        const a=v(x,y,z),b=v(side*(.45+.26*t),.11+.32*t+(rng()-.5)*.38,.04).normalize()
        let tone=blend(face,belly,.21+rng()*.32)
        if(p.features?.has('white-brow')||p.features?.has('spectacles'))tone.lerp(bone,.83)
        if(eagle)tone=blend(color('#87663f'),color('#e6c696'),.15+.62*rng())
        brows.push({p:a,dir:b,n:v(side*.16,.30,.94).normalize(),base:tone,ink,
          length:(.022+.034*t)*(.76+.55*rng()),width:.006+.002*row,arch:.066,
          mode:eagle?2:0,strength:.60,freq:1,phase:rng()})
      }
    }
    // Fine feathers fan over the cere. Snowy owl bill bases nearly disappear
    // into white facial plumage, leaving the hooked tip exposed.
    for(let j=0;j<132;j++){
      const u=rng(),f=rng()
      const ax=(.034+.09*u)*p.head
      const ay=.006-.13*f
      const frontDepth=skullFront(ax,ay/(.508*p.tall),p)
      const start=v(side*ax,ay,frontDepth+.057*p.head+.018*f-.013*u)
      const down=v(-side*(.18+.39*f),-.84,.17+.21*u).normalize()
      bristles.push({p:start,dir:down,n:v(side*.10,.04,.99).normalize(),base:blend(face,belly,.15+.4*u),
        ink,mode:0,strength:0,freq:1,phase:rng(),length:(.069+.070*(1-u))*(snowy?1.37:1),
        width:.003+.003*u,arch:.11})
    }
  }
  makeLayer(owner,brows,'fine',shader,pieces)
  makeLayer(owner,bristles,'fine',shader,pieces)
}

function forehead(owner,p,rng,shader,pieces){
  const [back,,face,ink]=p.colors.map(color)
  const eagle=p.id==='Bubo_bubo',barn=p.disk==='heart'
  const feathers=[]
  for(let row=0;row<24;row++){
    const t=row/23
    for(let col=0;col<49;col++){
      const u=(col-24+rng()*.47)/24
      const x=u*(.18+.25*t)*p.head
      const top=.467-.071*Math.abs(u)
      const low=(barn?.135:.175)+Math.abs(u)*(barn?.135:.073)
      const y=mix(low,top,t)*p.tall
      const h=y/(.508*p.tall)
      const z=skullFront(x,h,p)
      const point=v(x,y,z+.013)
      const sample=featherField(x*51,y*36)
      const f=clamp(Math.abs(u))
      let tone=blend(back,face,.27+.42*(1-f))
      if(barn){
        const silver=featherField(x*13+y*4, y*15)
        const freckle=featherField(x*56+y*8,y*34)
        tone=blend(color('#ab7949'),color('#b6ad9b'),smooth(.19,.67,silver))
        tone.lerp(color('#67554b'),.63*smooth(.56,.84,freckle))
        tone.lerp(color('#f1e8d1'),.73*smooth(.34,.08,freckle))
        const downy=smooth(.16,-.015,t)*(.35+.36*f)
        tone.lerp(face,downy)
      }
      if(p.features){
        tone=blend(back,face,.14+.24*(1-f))
        const speck=featherField(x*49+u*6,y*42)
        tone.lerp(ink,smooth(.50,.83,sample)*.51)
        if(p.features.has('spotted-crown'))tone.lerp(cream,smooth(.59,.87,speck)*.91)
        if(p.features.has('crown-shafts'))tone.lerp(carbon,.71*smooth(.42,.77,speck)).lerp(cream,.53*smooth(.45,.77,1-sample))
        if(p.features.has('cinnamon-stipple'))tone.lerp(ochre,.71).lerp(ink,smooth(.44,.68,speck)*.80)
        if(p.features.has('spectacles'))tone.lerp(carbon,.58+.18*sample)
        tone.multiplyScalar(plumageDensity(tone))
        if(p.features.has('white-brow')||p.features.has('spectacles'))facePigment(point,.64,p,tone)
      }
      if(eagle){
        const stroke=smooth(.34,.77,featherField(x*51,y*16+u*2))
        tone=blend(color('#baaa91'),ink,.38+.59*stroke)
        const fork=.12+.88*Math.abs(x)/p.head
        tone.lerp(ink,.9*Math.exp(-Math.pow((y/p.tall-fork)/.049,2)))
      }
      if(p.id==='Bubo_scandiacus')tone=blend(face,ink,smooth(.73,.89,sample)*t*t*.71)
      const tangent=v(u*(barn?.35:.54),-.79,.50+.28*t).normalize()
      const n=v(.60*u,.28+.45*t,.90).normalize()
      feathers.push({p:point,dir:tangent,n,base:tone,ink,
        length:(.038+.032*t)*(.72+.54*rng()),width:.005+.005*rng(),arch:.072,
        mode:eagle||barn?2:0,strength:eagle?.76:barn?.47:0,phase:rng()})
    }
  }
  const layer=makeLayer(owner,feathers,'fine',shader,pieces)
  layer.name='Crown plumules';layer.userData.featherRegion='facial'
}

// A bird's eye shows through an elongated palpebral opening. A curved rim
// sits directly on the cornea at its inner edge and feathers into the socket
// at the outer edge. This also covers the caps when the animated lids blink.
function orbitalRim(mount,p,side,scale,rng,shader,pieces){
  const eagle=p.id==='Bubo_bubo',snowy=p.id==='Bubo_scandiacus',barn=p.disk==='heart'
  const pos=[],rgb=[],index=[]
  const rings=12,sectors=96
  const eyeWidth=.107*scale,eyeHeight=.089*scale,eyeDepth=.046*scale
  for(let i=0;i<=rings;i++){
    const t=i/rings
    for(let j=0;j<sectors;j++){
      const a=TAU*j/sectors, cx=Math.cos(a),sy=Math.sin(a),upper=sy>0
      const slit=Math.sign(sy)*Math.pow(Math.abs(sy),1.57)
      const tx=(upper?(eagle?.36:snowy?.52:.80):(eagle?.69:snowy?.73:.80))*eyeHeight
      const yInner=slit*tx+cx*side*eyeHeight*(eagle?.31:snowy?.14:.09)-(eagle?.007:0)
      const xInner=cx*eyeWidth*(eagle?.965:.94)
      const xOuter=cx*eyeWidth*(upper?1.77:1.62)
      const yOuter=sy*eyeHeight*(upper?1.66:1.45)+.030*cx*side
      const x=mix(xInner,xOuter,t),y=mix(yInner,yOuter,t)
      const ellipsoid=Math.max(0,1-(x/eyeWidth)**2-(y/eyeHeight)**2)
      const support=.012+eyeDepth*Math.sqrt(ellipsoid)
      const bulge=(upper?(eagle?.029:snowy?.020:.009):.008)*Math.sin(Math.PI*t)
      const z=mix(support,-.052,smooth(.45,1,t))+.0045+bulge-.014*side*x*t
      const nearNose=cx*side<0
      const inner=upper?color('#302826'):color('#594c43')
      let edge=color(p.colors[2])
      if(eagle)edge=eagleFaceColor(v(mount.position.x+x,mount.position.y+y,0),.45,p)
      if(p.features)facePigment(v(mount.position.x+x,mount.position.y+y,0),.44,p,edge)
      const shadow=upper?(eagle?.72:snowy?.23:.30):(eagle?.44:snowy?.08:.19)
      const transition=smooth(.04,.18,t)
      const tone=blend(inner,edge,transition).multiplyScalar(1-shadow*(1-t))
      if(nearNose&&eagle)tone.lerp(color('#352820'),.22*(1-t))
      if(p.id==='Ketupa_lactea'&&upper)tone.lerp(color('#dbacae'),(.4+.56*sy)*(1-smooth(.32,.65,t)))
      const seed=featherField(x*183,y*216)
      tone.multiplyScalar(.90+.18*seed)
      pos.push(x,y,z);rgb.push(...tone.toArray())
      if(i>0){
        const outer=i*sectors+j,next=i*sectors+(j+1)%sectors
        index.push(outer-sectors,outer,next,outer-sectors,next,next-sectors)
      }
    }
  }
  const geo=new T.BufferGeometry()
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3))
  geo.setAttribute('color',new T.Float32BufferAttribute(rgb,3))
  geo.setIndex(index);geo.computeVertexNormals()
  model(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.83,side:T.DoubleSide}),mount,v(0,0,0),v(1,1,1)).name='Palpebral rim'
  const filaments=[]
  const position=geo.attributes.position, shading=geo.attributes.color
  // Leave one hairline of bare skin at the opening. On its outer side, short
  // fine feathers rise from the actual rotating eye socket, not from a sphere
  // behind it; their bases therefore stay in contact from all camera angles.
  for(let row=1;row<rings;row++)for(let j=0;j<sectors;j++){
    const i=row*sectors+j,k=row*sectors+(j+1)%sectors
    const a=v().fromBufferAttribute(position,i),b=v().fromBufferAttribute(position,k)
    const next=v().fromBufferAttribute(position,i+sectors)
    const tangent=nd(b,a),outward=nd(next,a)
    const n=outward.clone().cross(tangent).normalize()
    if(n.z<0)n.negate()
    const fraction=(row+.35)/rings
    const shaft=outward.clone().addScaledVector(tangent,(rng()-.5)*.51).normalize()
    const ground=new T.Color().fromBufferAttribute(shading,i).multiplyScalar(.85+.24*rng())
    filaments.push({p:a.lerp(b,rng()*.76).addScaledVector(n,.0016),
      dir:shaft,n,base:ground,ink:color(p.colors[3]),length:(.009+.024*fraction)*(.69+.55*rng()),
      width:.0011+.0021*fraction,arch:.037,mode:eagle&&row>7?2:0,strength:eagle?.34:0,phase:rng()})
  }
  const veil=makeLayer(mount,filaments,'fine',shader,pieces)
  veil.name='Orbital plumules';veil.userData.featherRegion='facial' 
}

function eyes(owner,p,x,y,rng,shader,pieces){
  const result=[]
  const iris=color(p.colors[4])
  const dark=iris.r<.15
  const scale=p.features?(p.eye||1):p.id==='Strix_nebulosa'?.79:p.id==='Bubo_scandiacus'?.90:p.disk==='heart'?.88:1.07
  for(const side of [-1,1]){
    const mount=new T.Group()
    const r=Math.hypot(x/(.58*p.head),(y+.034)/(.44*p.tall))
    const surface=facePoint(r,Math.atan2(x/(.58*p.head),(y+.034)/(.44*p.tall)),p)
    mount.position.set(side*x,y,surface.z-.010*p.head)
    mount.rotation.y=side*(p.disk==='heart'?.16:.21)
    mount.rotation.z=side*(p.disk==='brow'?.11:.045)
    owner.add(mount)
    orbitalRim(mount,p,side,scale,rng,shader,pieces)
    const closure={value:0}
    const eye=new T.ShaderMaterial({
      uniforms:{iris:{value:iris},closure, pupil:{value:dark?.70:.52}},
      vertexShader:`
        varying vec3 W,P,N;
        void main(){
          vec4 wp=modelMatrix*vec4(position,1.);
          W=wp.xyz;P=position;N=normalize(mat3(modelMatrix)*position);
          gl_Position=projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader:`
        uniform float closure,pupil; uniform vec3 iris;
        varying vec3 W,P,N;
        void main(){
          vec3 p=normalize(P);
          vec3 n=normalize(N),eye=normalize(cameraPosition-W);
          float r=length(p.xy);
          float angle=atan(p.y,p.x);
          float spokes=.50+.24*sin(angle*84.+sin(r*21.)*2.)+.18*cos(angle*43.-r*35.);
          float central=smoothstep(pupil-.025,pupil+.022,r);
          float outer=1.-smoothstep(.81,.973,r);
          vec3 c=vec3(.004,.003,.003)+iris*central*outer*(.36+.69*spokes);
          c*=.60+.57*smoothstep(-.9,.28,p.y);
          vec3 reflected=reflect(-eye,n);
          float key=pow(max(0.,dot(reflected,normalize(vec3(.52,.69,.81)))),83.);
          float fill=pow(max(0.,dot(reflected,normalize(vec3(-.59,.38,.49)))),205.);
          c+=vec3(1.15,.94,.72)*key*1.65+vec3(.47,.65,.84)*fill*.56;
          if(p.y>1.04-1.92*closure) c=iris*.13+vec3(.026,.017,.013);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const globe=model(new T.SphereGeometry(1,36,25),eye,mount,v(0,0,.012),v(.107,.089,.046).multiplyScalar(scale))
    globe.castShadow=false
    result.push(closure)
  }
  return result
}

function tufts(owner,p,rng,shader,pieces){
  if(p.ears<=.06)return
  const [back,,face,ink]=p.colors.map(color)
  for (const side of [-1,1]){
    const fan=[]
    const pivot=new T.Group()
    pivot.name=side>0?'Tuft_L':'Tuft_R'
    pivot.position.set(side*.38*p.head,.28*p.tall,.05*p.head)
    owner.add(pivot)
    if(p.id==='Bubo_bubo'){
      for(let layer=0;layer<4;layer++)for(let k=0;k<15;k++){
        const t=k/14,fringe=rng(),crest=Math.sin(t*Math.PI)
        const from=v(side*(.296+.231*t+.009*layer)*p.head,.247+.106*crest+.018*layer,
          .21-.25*t-.033*layer)
        const to=v(side*(.42+.36*t+.071*crest+.021*fringe)*p.head,(.359+.35*crest+.085*fringe+.095*t)*p.tall,
          -.018-.333*t-.037*layer+.047*Math.sin(k))
        const inner=layer>1 && k%4!==0
        const edge=k%6===2&&layer<2
        const ground=inner?blend(ink,back,.045+.14*rng()):
          edge?blend(back,face,.28+.32*rng()):blend(ink,back,.13+.40*rng())
        fan.push({p:from,dir:nd(to,from),n:v(.19*side,.03,.981).normalize(),
          length:to.distanceTo(from),width:.012+.007*rng()+.010*crest,
          arch:.06+.072*rng(),base:ground,ink,mode:2,strength:inner?.42:.72,freq:1.8,
          phase:rng(),flight:.55})
      }
    }else for(let row=0;row<9;row++){
      for(let j=0;j<17;j++){
        const t=j/16,m=row/8
        const spread=(t-.5)
        const base=v(side*(.395+.133*m+.099*spread)*p.head,(.323+.103*m)*p.tall,.025-.17*m+spread*.20)
        const tip=v(side*(.554+.102*p.ears+spread*.08)*p.head,(.38+.53*p.ears-.126*t+.075*rng())*p.tall,-.14-.066*t)
        const flat=lateralTufts[p.id]
        if(flat){
          const fan=p.id==='Jubula_lettii'?.15*Math.sin(j*2.399+row*1.06):.029*Math.sin(j*1.7+.19*row)
          tip.x+=side*(flat*(.22+.13*m)+fan*.48)*p.head
          tip.y+=(fan-flat*(.18+.09*t))*p.tall
          tip.z-=flat*(.06+.17*t)*p.head
          if(p.id==='Ketupa_ketupu'){
            tip.y-=(.16+.15*t+.065*Math.sin(row*1.3))*p.tall
            tip.x-=side*(.04+.09*t)*p.head
          }
        }
        fan.push({p:base,dir:nd(tip,base),n:v(side*.27,.04,.959).normalize(),
          length:tip.distanceTo(base),width:.029+rng()*.017,
          arch:.087+(rng()-.5)*.08,base:blend(back,paleTufts.has(p.id)?bone:face,.12+rng()*.19+(paleTufts.has(p.id)?.75*(1-m*.50):0)),
          ink,mode:2,strength:paleTufts.has(p.id)?.30:.84,phase:rng(),flight:.66})
      }
    }
    fan.forEach(f=>f.p.sub(pivot.position))
    makeLayer(pivot,fan,'flight',shader,pieces)
  }
}

function foldedWings(body,p,rng,shader,pieces){
  const [back,belly,,ink]=p.colors.map(color)
  const snowy=p.id==='Bubo_scandiacus'
  const barn=p.id==='Tyto_alba'
  const hinges=[]
  const segments=18
  for(const side of [-1,1]){
    const g=new T.Group()
    g.name=side>0?'Wing_L':'Wing_R'
    g.position.set((barn?.414:snowy?.491:.486)*p.width*side,.448*p.body,barn?.028:.041)
    g.scale.x=side
    body.add(g)
    const panels=[]

    // Each overlapping section carries a flight feather and its own coverts. At rest
    // their bases overlap at the flank. The wing opens from the shoulder to the wrist,
    // where the primaries spread into a broad, rounded hand.
    for(let j=0;j<segments;j++){
      const u=j/(segments-1)
      const hand=smooth(.46,1,u)
      const arch=Math.sin(Math.PI*u)
      const closed=v((.012+.100*arch-.12*u*u-.047*(1-u)**2)*p.width,-(.07+.50*u)*p.body,
        .070+.061*arch-.40*Math.pow(1-u,2)-.35*u*u)
      const open=v(.024+.112*arch,-u*(barn?1.68:1.58)*p.body*(p.wingLength||1),
        .045+.20*arch+.07*u)
      const panel=new T.Group()
      panel.position.copy(closed)
      panel.name=g.name+'_Fan_'+String(j+1).padStart(2,'0')
      g.add(panel)
      const sweep=(.97-.82*hand)*(.9+.12*arch)
      panels.push({panel,closed,open,sweep,u})

      const length=(.66+.255*arch+(barn?.66:snowy?.44:.48)*u-.074*hand)*p.body*(p.wingLength||1)*(1+((p.wingTip||1)-1)*hand)
      const width=(.102+.031*arch-.018*u)*p.width
      const dir=v(-.10-.14*hand,-.89,-(barn?.62:snowy?.78:.66)-.15*(1-u)).normalize()
      const normal=v(.998,.025,.045).normalize()
      const right=v(0,-dir.z,dir.y).normalize()
      const shade=blend(back,belly,snowy?.40:.10+.055*Math.cos(j*1.9))
      if(barn)shade.lerp(silverBuff,.22+.19*Math.sin(j*1.6))
      const base=v(0,0,0)
      const remiges=[{p:base,dir,n:normal,length,width,arch:.053,flight:1,base:shade,ink,
        mode:1,strength:snowy?.89:barn?.41:.70,freq:4.3+.36*u,phase:.09+.11*u}]
      makeLayer(panel,remiges,'flight',shader,pieces)
      pieces.at(-1).userData.ventralTint=blend(belly,back,barn?.035:snowy?.06:.22).toArray()

      const cover=[]
      // Layered rows on BOTH wing surfaces keep the pale underwing visible in flight.
      for(const surface of [1,-1]){
        const outer=surface===1
        const coverColor=outer?shade:blend(belly,back,snowy?.04:barn?.03:.19)
        for(let row=0;row<7;row++){
          const chord=(row-.32)/7
          for(let col=0;col<3;col++){
            const f=(col-1+.26*(row%2))*width*.52
            const anchor=base.clone().addScaledVector(dir,length*(.045+chord*.60))
              .addScaledVector(right,f).addScaledVector(normal,surface*(.048-.027*row/7))
            const angle=(col-1)*.079+(rng()-.5)*.060
            const down=dir.clone().addScaledVector(right,angle).normalize()
            const tint=coverColor.clone().multiplyScalar(.92+.13*rng())
            if(barn&&outer)tint.lerp(silverBuff,.51*(.5+.5*Math.cos(row*1.23+j*.71)))
            if(p.id==='Bubo_bubo'&&outer){
              const m=featherField(j*.49,row*.82+col*.09)
              tint.lerp(ink,smooth(.41,.80,m)*.80).lerp(color('#ddc59b'),smooth(.14,.03,m)*.64)
            }
            if(p.features&&outer){
              const blotch=featherField(j*.97+col*.19,row*1.17)
              if(eagleTracts.has(p.id))tint.lerp(ink,.76*smooth(.33,.74,blotch)).lerp(cream,.65*smooth(.42,.80,1-blotch))
              if(goldenMantles.has(p.id))tint.lerp(ochre,.49*smooth(.30,.65,blotch)).lerp(ink,.75*smooth(.48,.76,1-blotch))
              if(p.design==='bars')tint.lerp(ink,.80*smooth(.51,.88,.5+.5*Math.cos(j*1.5-row*1.38+blotch*1.1)))
              if(p.design==='streaks')tint.lerp(ink,.69*smooth(.54,.83,blotch))
              if(p.features.has('pale-spots'))tint.lerp(ink,.59*smooth(.37,.79,blotch))
              if(p.features.has('white-scapulars'))tint.lerp(ink,.46*smooth(.42,.69,blotch)*(1-hand))
              if(p.features.has('mottled-mantle'))tint.lerp(cream,.76*smooth(.47,.83,blotch)).lerp(carbon,.78*smooth(.54,.85,1-blotch))
              if(p.features.has('cinnamon-stipple'))tint.lerp(ochre,.57).lerp(carbon,smooth(.37,.84,.5+.5*Math.sin(j*.9+row*2.06+blotch))*.88)
              if(p.features.has('spectacles'))tint.lerp(carbon,.31)
              tint.multiplyScalar(plumageDensity(tint))
            }
            const intensity=(outer?(snowy?.93:.68):(barn?.08:snowy?.52:.57))*(p.design==='plain'?.28:1)
            cover.push({p:anchor,dir:down,n:normal.clone().multiplyScalar(surface),length:length*(.23+.12*chord),
              width:width*(.48+.15*chord),arch:.059,flight:.48,base:tint,ink,
              mode:p.features?(modes[p.design]||0):barn?3:1,strength:intensity*(.83+.16*rng()),freq:1.43,phase:.11*row+.055*u})
            if(outer && p.features && (p.features.has('pale-spots')||p.features.has('white-scapulars')||p.features.has('mottled-mantle')) &&
                (j+row*2+col*3)%5===0 && (!hand||row<4)){
              const base=cover.at(-1), dotScale=p.features.has('peppered-belly')?.56:1
              const markBase=base.p.clone().addScaledVector(down,base.length*.56)
                .addScaledVector(base.n,base.length*.067+.007)
              cover.push({p:markBase,dir:down,n:base.n,length:.043*dotScale,width:.0155*dotScale,
                base:cream,ink:cream,mode:0,strength:0,arch:.033,phase:.33})
            }
          }
        }
      }
      const coverts=makeLayer(panel,cover,'fine',shader,pieces)
      coverts.name='Wing coverts'; coverts.userData.featherRegion='wing'
    }
    hinges.push({g,side,panels})
  }
  return hinges
}

// Long scapular plumes travel from the withers diagonally down the wing.
// Each tract has its own hinge so the mantle can rise without the bird
// extending a flight feather or losing contact with the perch.
function scapulars(body,p,rng,shader,pieces){
  const [back,belly,,ink]=p.colors.map(color)
  const barn=p.disk==='heart',snowy=p.id==='Bubo_scandiacus'
  for(const side of [-1,1]){
    const pivot=new T.Group()
    pivot.name=side>0?'Shoulder_L':'Shoulder_R'
    pivot.position.set(side*.43*p.width,.45*p.body,0)
    body.add(pivot)
    const cover=[],spots=[]
    for(let row=0;row<18;row++){
      const t=row/17
      for(let j=0;j<22;j++){
        const u=(j+.45*(row%2)+rng()*.42)/22
        const theta=.69+t*.92+(rng()-.5)*.025
        const phi=side*(1.35+u*1.48+t*.10)
        const surface=fitBody(theta,phi,p)
        const tangent=nd(fitBody(theta+.008,phi,p),surface)
        const around=nd(fitBody(theta,phi+.008,p),surface)
        const normal=tangent.clone().cross(around).normalize()
        const outward=.025+.043*(1-t)*Math.sin(u*Math.PI)
        const root=surface.clone().addScaledVector(normal,outward)
        // Mantle feathers roof the folded wing and reach back towards the rump.
        const direction=tangent.clone().addScaledVector(around,side*(.38+.70*(1-t))).addScaledVector(normal,.22+.18*(1-u)).normalize()
        const length=(barn?.215:snowy?.252:.273)*(.75+.45*t+.21*rng())
        const width=(barn?.026:snowy?.038:.035)*(.83+.37*rng())
        const fleck=featherField(u*9+t,t*7+u*.8)
        let tone=blend(back,belly,snowy?.62+.22*rng():.08+.17*rng())
        if(barn&&!p.features)tone.lerp(silverBuff,.79*smooth(.28,.75,fleck))
        if(snowy){
          const stripe=smooth(.30,.88,.5+.5*Math.cos(t*34+4*fleck+Math.sin(5*u)))
          tone.lerp(snowInk,stripe*smooth(.19,.70,fleck)*.86)
        }
        if(p.id==='Bubo_bubo')tone.lerp(ink,.91*smooth(.29,.69,fleck)).lerp(color('#ead6af'),.52*smooth(.67,.86,featherField(u*14,t*11)))
        if(p.features){
          const light=smooth(.53,.84,fleck)
          if(goldenMantles.has(p.id))tone.lerp(ochre,.53*smooth(.30,.65,fleck)).lerp(ink,.79*smooth(.48,.76,1-fleck))
          const edge=smooth(.09,.36,u)*(1-smooth(.49,.81,u))
          if(p.features.has('pale-spots'))tone.lerp(ink,light*.65)
          if(p.features.has('white-scapulars'))tone.lerp(cream,edge*light*.97)
          if(p.features.has('mottled-mantle'))tone.lerp(cream,.9*smooth(.47,.77,fleck)).lerp(carbon,.9*smooth(.36,.67,1-fleck))
          if(p.features.has('spectacles'))tone.lerp(carbon,.39)
          if(p.features.has('cinnamon-stipple'))tone.lerp(ochre,.54)
          if(p.design==='bars')tone.lerp(ink,.87*smooth(.44,.9,.5+.5*Math.cos(t*32+4*fleck)))
          if(p.design==='streaks')tone.lerp(ink,.76*smooth(.44,.76,featherField(u*14,t*4)))
          tone.multiplyScalar(plumageDensity(tone))
        }
        const anchor=root.clone().sub(pivot.position)
        cover.push({p:anchor,dir:direction,n:normal,base:tone,ink,
          length,width,arch:.11+.073*rng(),mode:barn?0:snowy?1:2,
          strength:snowy?.47:.76,freq:2.1,phase:u+row*.1,flight:.36})
        if(p.features && (p.features.has('pale-spots')||p.features.has('white-scapulars')) && (row*3+j*7)%19<2){
          const tip=anchor.clone().addScaledVector(direction,length*.68).addScaledVector(normal,length*.116)
          const factor=p.features.has('peppered-belly')?.48:1
          spots.push({p:tip,dir:direction,n:normal,base:cream,ink:cream,length:.031*factor,width:.012*factor,arch:.04,mode:0,strength:0,phase:.5})
        }
        if(barn && (row+j*3)%7===0){
          const dotRoot=anchor.clone().addScaledVector(direction,length*.56).addScaledVector(normal,length*.112)
          const charcoal=blend(ink,color('#5e554d'),rng())
          const mark={p:dotRoot,dir:direction,n:normal,base:charcoal,ink:charcoal,
            length:.018,width:.0055,arch:.03,mode:0,strength:0,phase:rng()}
          spots.push(mark,{...mark,p:dotRoot.clone().addScaledVector(direction,.009).addScaledVector(normal,.0018),
            length:.010,width:.0044,base:color('#f2e7cc')})
        }
      }
    }
    const tract=makeLayer(pivot,cover,'fine',shader,pieces)
    tract.name='Scapular coverts';tract.userData.featherRegion='wing'
    if(spots.length)makeLayer(pivot,spots,'fine',shader,pieces).name='Speckled scapular tips'
  }
}

function makeTail(body,p,rng,shader,pieces){
  const [back,belly,,ink]=p.colors.map(color)
  const samples=[]
  const group=new T.Group()
  group.name='Tail'
  group.position.set(0,-.46*p.body,-.39*p.width)
  body.add(group)
  for(let j=0;j<12;j++){
    const s=(j-5.5)/5.5
    const snowy=p.id==='Bubo_scandiacus'
    const length=(p.features?.has('long-tail')?.72+p.tail*.80:.47+p.tail*.52)*(1.-(snowy?.055:.14)*Math.abs(s))
    samples.push({p:v(s*.169,.022-.031*Math.abs(s),-.011-j*.0015),dir:v(s*(p.features?.has('long-tail')?.13:.251),p.id==='Bubo_scandiacus'?-.59:-.76,-.80).normalize(),
      n:v(.1*Math.sign(s),-.48,.83).normalize(),length,width:.068-.010*Math.abs(s),
      arch:.048,flight:.82,base:blend(back,belly,.24+rng()*.11),ink,mode:1,strength:snowy?.95:.78,freq:snowy?3.3:4.5+p.tail,phase:snowy?.22+.03*Math.floor(Math.abs(j-5.5)/2):.34+j*.035})
  }
  makeLayer(group,samples,'flight',shader,pieces)
  return group
}

function feet(root,p,rng,shader,pieces){
  const snowy=p.id==='Bubo_scandiacus'
  const booted=snowy||p.id==='Bubo_bubo'||p.features?.has('feathered-toes')
  const bare=p.features?.has('bare-toes'),ground=p.stance==='ground'
  const fish=p.features?.has('fish-talons')||p.genus==='Scotopelia'
  const leather=std(snowy?'#d8d4c9':fish?'#ba9455':ground?'#8a8373':p.disk==='heart'?'#937668':'#776152')
  const dark=std('#342b29',.55)
  const scales=std('#988176')
  const sleeves=[]
  for(const side of [-1,1]){
    const x=side*.234*p.width
    const perch=perchAt(x)
    const r=perchRadius(x)
    const heel=ground?v(x,.124,0):perch.clone().add(v(0,r+.062,-.014))
    const ankle=heel.clone().add(v(side*.015,.182+p.legs*.75,-.075))
    const upper=ankle.clone().add(v(-side*.046,booted?.14:.22,-.064))
    taperedCurve([heel,heel.clone().lerp(ankle,.55),ankle,upper],ground?[.027,.029,.042,.070]:fish?[.055,.060,.068,.085]:[.046,.045,.059,.081],leather,root,15,12)
    for(let j=0;j<4;j++){
      const back=j>1,sideAngle=back?-1:1,lane=j%2
      const path=[heel.clone().add(v((lane-.50)*.060,-.016,sideAngle*.020))]
      for(let k=0;k<=6;k++){
        const t=k/6
        const angle=sideAngle*mix(.32,1.83+lane*.18,t)
        const d=r+.027+.042*(1.-t)*(1.-t)
        if(ground){
          const reach=(back?.155:.25)*(lane?.85:1)
          path.push(v(heel.x+(lane-.5)*(.064+.11*t),.081+.027*(1-t)**2,sideAngle*(.022+t*reach)))
          continue
        }
        path.push(perch.clone().add(v((lane-.5)*(.07+.079*t)+side*(back?-.026:.015),Math.cos(angle)*d,Math.sin(angle)*d)))
      }
      const digitRadii=(fish?[.039,.033,.029,.022,.016]:[.029,.025,.021,.016,.013])
      taperedCurve(path,digitRadii,leather,root,16,9)
      const line=new T.CatmullRomCurve3(path)
      const inst=new T.InstancedMesh(new T.SphereGeometry(1.,8,5),scales,6), marker=new T.Object3D()
      marker.scale.set(.019,.009,.012)
      for(let k=0;k<inst.count;k++){
        marker.position.copy(line.getPoint(.19+k*.119)).add(v(0,.017,0))
        marker.updateMatrix()
        inst.setMatrixAt(k,marker.matrix)
      }
      root.add(inst)
      if(booted){
        const snow=color(snowy?'#eeeae2':p.features?p.colors[1]:'#ae8d67'),shadow=color(snowy?'#cfcbc2':p.features?p.colors[3]:'#82694e')
        for(let row=0;row<8;row++){
          const t=.05+row*.098
          const toe=line.getPoint(t)
          const down=line.getTangent(t)
          const outside=v(0,Math.cos(t*1.75),sideAngle*Math.sin(t*1.75)).normalize()
          for(let k=-1;k<=1;k++){
            const n=outside.clone().add(v(k*.83,0,0)).normalize()
            sleeves.push({p:toe.clone().addScaledVector(n,.030-.008*t),dir:down,n,
              base:snow.clone().multiplyScalar(.92+.09*rng()),ink:shadow,length:.038,width:.017,
              arch:.12,mode:0,strength:0,phase:rng()})
          }
        }
      }
      const tip=path.at(-1)
      const hook=ground ? [tip.clone().add(v(0,-.005,sideAngle*.023)),tip.clone().add(v(0,-.021,sideAngle*.051))]
        : [tip.clone().add(v(0,-.038,sideAngle*.009)),perch.clone().add(v(tip.x-perch.x,-.082,sideAngle*(r*.77)))]
      taperedCurve([tip.clone().lerp(path.at(-2),.24),tip,...hook],fish?[.023,.020,.014,.0005]:[.016,.014,.010,.0005],dark,root,9,8)
    }
    const [back,belly,,ink]=p.colors.map(color)
    const legStart=booted?heel:heel.clone().lerp(ankle,ground?.52:bare?.76:.36)
    const legRows=booted?18:13
    for(let row=0;row<legRows;row++){
      const t=row/(legRows-1)
      for(let i=0;i<15;i++){
        const phi=i/15*TAU+(row%2)*.13
        const outward=v(Math.sin(phi),.0,Math.cos(phi))
        const radius=(snowy?.092:booted?.071:.051)+(snowy?.158:.107)*t*t
        const foot=legStart.clone().lerp(upper,t).addScaledVector(outward,radius)
        const terminal=(1.-p.legs*.87)
        sleeves.push({p:foot,dir:v(0,-1,.04),n:outward,base:blend(belly,back,(snowy?.10:.61)*t+rng()*.10),ink,
          length:(.071+.050*t)*terminal,width:.022+.019*t,arch:.1,mode:2,strength:.31,phase:rng()})
      }
    }
  }
  makeLayer(root,sleeves,'coat',shader,pieces)
}

export function createOwl(item,shader) {
  const p={...profileFor(item),id:item.id,genus:item.genus}
  const rng=random(p.seed),root=new T.Group(),body=new T.Group(),head=new T.Group(),pieces=[]
  root.name=item.id
  body.name='Body'
  head.name='Head'
  const lift=p.legs*.54
  const pale=color('#f3e9d6')
  body.position.y=.84*p.body+(p.id==='Bubo_scandiacus'?.022:p.id==='Bubo_bubo'?.13:.205)+lift
  root.add(body)
  downLayer(body,p,false)
  contour(body,p,false,rng,1.,shader,pieces,pale)
  scapulars(body,p,rng,shader,pieces)
  const tail=makeTail(body,p,rng,shader,pieces)
  const wings=foldedWings(body,p,rng,shader,pieces)
  const barn=p.disk==='heart',snowy=p.id==='Bubo_scandiacus'
  head.position.set(0,(barn?.815:snowy?.72:.75)*p.body,barn?.247:snowy?.323:.341)
  body.add(head)
  downLayer(head,p,true)
  contour(head,p,true,rng,.72,shader,pieces,pale)
  const eyeX=(p.disk==='heart'?.210:.224)*p.head
  const eyeY=(p.disk==='brow'?.053:.077)*p.tall
  facialDisc(head,p,rng,shader,pieces,eyeX,eyeY)
  whiskers(head,p,rng,shader,pieces)
  tufts(head,p,rng,shader,pieces)
  bill(head,p)
  orbitalFeathers(head,p,eyeX,eyeY,rng,shader,pieces)
  forehead(head,p,rng,shader,pieces)
  const lids=eyes(head,p,eyeX,eyeY,rng,shader,pieces)
  feet(root,p,rng,shader,pieces)
  const gaze=new T.Vector2()
  const isStudy=Object.hasOwn(studies,item.id)

  function update(t,spread,dt){
    const twist=.13*Math.sin(t*.53-.33)+.034*Math.cos(t*1.13)
    head.rotation.y=twist+gaze.x*.18
    head.rotation.x=.036*Math.sin(t*.76)+gaze.y*.07
    head.rotation.z=.048*Math.sin(t*.42+1.3)
    body.scale.y=1.+.007*Math.sin(t*3.4)
    body.scale.z=1.+.012*Math.sin(t*3.4-.6)
    const blink=t%4.98
    const closure=smooth(4.48,4.55,blink)*(1.-smooth(4.56,4.69,blink))
    for(const lid of lids)lid.value=closure
    for(const {g,side,panels} of wings){
      const wave=.025*Math.sin(t*2.6+side)
      g.rotation.z=side*(spread*1.60+wave*.32)
      g.rotation.x=-.13*spread+.024*spread*Math.cos(t*3)
      g.rotation.y=side*.09*spread
      for(const {panel,closed,open,sweep,u} of panels){
        const fan=smooth(.08+u*.11,1,spread)
        panel.position.lerpVectors(closed,open,fan)
        panel.rotation.x=sweep*fan
      }
    }
    tail.rotation.x=.09*spread+.015*Math.sin(t*1.58)
  }
  function dispose(){
    const seen=new Set()
    root.traverse(node=>{
      if(node.geometry&&node.geometry!==sphere)seen.add(node.geometry)
      if(node.material&&node.material!==shader.material)seen.add(node.material)
    })
    for(const obj of seen)obj.dispose()
  }
  return {root,gaze,update,dispose,isStudy,profile:p,pieces,
    featherCount:pieces.reduce((n,m)=>n+m.userData.plumage,0),eyeY:body.position.y+head.position.y+eyeY,
    height:body.position.y+head.position.y+.52*p.tall+.28*p.ears}
}
