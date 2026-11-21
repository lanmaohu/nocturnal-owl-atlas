import records from '../data/records.json' with {type:'json'}
import production from '../data/production.json' with {type:'json'}

const limit = (x, low, high) => Math.min(high,Math.max(low,x))

// Dimensionless ratios retain the differences between relatives with markedly
// different absolute sizes. The scene and perch use normalized display units.
function proportions(traits) {
  const t=traits, w=t.wingMm
  return {
    wing:w/Math.cbrt(t.massG), tail:t.tailMm/w, tarsus:t.tarsusMm/w,
    culmen:t.beakCulmenMm/w, billWidth:t.beakWidthMm/w, tip:t.handWingIndex,
  }
}

const byGenus=new Map()
for(const record of Object.values(records)){
  if(!record.traits)continue
  const genus=record.taxonomy.genus
  if(!byGenus.has(genus))byGenus.set(genus,[])
  byGenus.get(genus).push(proportions(record.traits))
}
const median=values=>{
  const sorted=values.sort((a,b)=>a-b), i=Math.floor(sorted.length/2)
  return (sorted[i]+sorted[sorted.length-i-1])/2
}
const centers=new Map([...byGenus].map(([genus,rows])=>{
  const center=Object.fromEntries(Object.keys(rows[0]).map(key=>[key,median(rows.map(r=>r[key]))]))
  return [genus,center]
}))

const specimens = {
  Phodilus_badius:{width:.86,body:.91,head:1.00,tall:1.03,legs:.19,tail:.20,eye:1.10,
    features:['raised-ruff','deep-orbits','peppered-belly']},
  Athene_cunicularia:{width:.78,body:.78,head:.83,tall:.79,legs:.42,tail:.36,
    features:['long-legs','bare-toes','white-brow','white-throat','spotted-crown','pale-spots','transverse-belly']},
  Surnia_ulula:{width:.82,body:1.04,head:.85,tall:.84,tail:1.28,legs:.11,
    features:['long-tail','facial-rim','white-brow','spotted-crown','transverse-belly','feathered-toes']},
  Strix_nebulosa:{width:1.04,body:1.16,head:1.31,tall:1.19,tail:.76,legs:.05,eye:.82,
    features:['rings','bow-tie','feathered-toes','mottled-mantle','crown-shafts']},
  Pulsatrix_perspicillata:{width:1.02,body:1.01,head:1.01,tall:.94,tail:.47,legs:.10,
    features:['spectacles','white-throat','dark-collar','plain-belly']},
  Scotopelia_peli:{width:1.19,body:1.12,head:.96,tall:.89,tail:.44,legs:.28,eye:1.04,
    features:['bare-toes','transverse-belly','fish-talons','cinnamon-stipple']},
  Xenoglaux_loweryi:{width:.87,body:.71,head:.96,tall:.91,tail:.23,legs:.12,eye:1.10,
    features:['whiskers','transverse-belly','pale-belly-freckles','crown-shafts','pale-spots']},
}

export function speciesMorphology(item,base) {
  const r=records[item.id], appearance=production[item.id]
  if(!appearance)throw new Error('Missing species appearance: '+item.id)
  const specimen=specimens[item.id] || {}
  const features=new Set([...(appearance.features||[]),...(specimen.features||[])])
  if(features.has('chest-band'))features.add('dark-collar')
  if(features.has('breast-bars'))features.add('transverse-belly')
  if(features.has('dark-mask'))features.add('deep-orbits')
  const p={...base,...specimen, colors:appearance.colors, design:appearance.design,
    disk:appearance.disk,ears:appearance.ears,stance:appearance.stance,features, source:appearance.source,note:appearance.note,
    wingLength:1,billLength:1,billBreadth:1, wingTip:1,eye:specimen.eye||1}
  const center=centers.get(item.genus)
  if(r.traits && center){
    const prop=proportions(r.traits), ratio=key=>prop[key]/center[key]
    // Median within genus anchors the anatomy of the shared skeleton.
    p.width*=limit((1/ratio('wing'))**.50,.84,1.17)
    p.body*=limit(ratio('wing')**.23,.92,1.09)
    p.tail*=limit(ratio('tail')**1.55,.68,1.45)
    p.legs=limit(p.legs+.60*(prop.tarsus-center.tarsus),.01,.64)
    p.wingLength=limit((prop.wing/32)**.33*ratio('wing')**.24,.85,1.18)
    p.billLength=limit((prop.culmen/.14)**.49*ratio('culmen')**.31,.73,1.35)
    p.billBreadth=limit((prop.billWidth/.041)**.5*ratio('billWidth')**.30,.74,1.39)
    p.wingTip=limit(.83+.0063*prop.tip,.91,1.14)
  }
  if(features.has('long-tail'))p.tail=Math.max(p.tail,.93)
  if(features.has('long-legs'))p.legs=Math.max(p.legs,.42)
  if(features.has('fish-talons'))p.billBreadth*=1.14
  return p
}
