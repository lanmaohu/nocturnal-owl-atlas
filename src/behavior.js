import records from '../data/records.json' with {type: 'json'}
import production from '../data/production.json' with {type: 'json'}

const originals = {
  Tyto_alba: ['listen', '侧耳寻声', 6, 2.65, 'barn'],
  Bubo_scandiacus: ['wind', '迎风敛羽', 5.6, 2.15, 'snow'],
  Bubo_bubo: ['gaze', '回首凝视', 5.8, 2.6, 'forest'],
}
const motions = {
  listen: ['侧首聆听',6,2.65],
  wind: ['迎风回望',5.6,2.15],
  gaze: ['转头凝视',5.8,2.6],
  horizon: ['远眺侧望',6.2,2.75],
  below: ['俯身探看',5.8,2.48],
  ground: ['探身环视',5.8,2.50],
  peer: ['侧身探望',5.65,2.42],
  canopy: ['仰望树冠',5.9,2.55],
}
const watch = new Set(['Surnia','Ninox','Uroglaux','Taenioptynx'])
const small = new Set(['Glaucidium','Micrathene','Xenoglaux','Aegolius','Margarobyas','Athene'])
const leaf = new Set(['Otus','Megascops','Lophostrix','Jubula','Psiloscops','Gymnasio'])
const fish = new Set(['Ketupa_blakistoni','Ketupa_flavipes','Ketupa_ketupu','Ketupa_zeylonensis'])
const terrestrial = new Set(['Athene_cunicularia','Asio_capensis','Asio_flammeus','Tyto_longimembris','Tyto_capensis'])
const bareRocks = new Set(['Bubo_ascalaphus','Bubo_bengalensis'])
const settings = {
  forest:   {start:55,settle:37,portrait:18,elevation:.07,offset:.01,exposure:1.06},
  boreal:   {start:63,settle:44,portrait:21,elevation:.105,offset:.016,exposure:1.08},
  woodland: {start:60,settle:36,portrait:19,elevation:.06,offset:.015,exposure:1.04},
  meadow:   {start:50,settle:40,portrait:21,elevation:.04,offset:.011,exposure:1.00},
  stone:    {start:57,settle:39,portrait:20,elevation:.060,offset:.010,exposure:1.01},
  river:    {start:53,settle:37,portrait:18,elevation:.095,offset:.017,exposure:1.01},
  marsh:    {start:58,settle:39,portrait:18,elevation:.008,offset:.020,exposure:1.03},
}

export function motionFor(id) {
  const old = originals[id]
  if (old) return {kind:old[0],label:old[1],duration:old[2],heroTime:old[3],stage:old[4],pace:1}
  const record = records[id]
  const genus = record?.taxonomy.genus || id.split('_')[0]
  const traits = record?.traits || {}
  const phenotype = production[id] || {}
  const land = phenotype.habitat || traits.habitat
  const riverside = phenotype.stance === 'waterside' || genus === 'Scotopelia' || fish.has(id) || land === 'Riverine'
  const ground = phenotype.stance ? phenotype.stance === 'ground' : terrestrial.has(id)
  const wet = land === 'Wetland' || id === 'Asio_capensis'
  const stone = bareRocks.has(id) || land === 'Rock' || land === 'Desert'
  let stage = 'forest'
  if (['Surnia_ulula','Strix_nebulosa','Aegolius_funereus','Glaucidium_passerinum'].includes(id)) stage='boreal'
  else if (riverside) stage = 'river'
  else if (wet) stage = 'marsh'
  else if (stone) stage = 'stone'
  else if (ground || land === 'Grassland') stage = 'meadow'
  else if (land === 'Woodland' || land === 'Shrubland' || land === 'Human Modified' || (!land && traits.habitatDensity === 2)) stage = 'woodland'
  let kind = 'gaze'
  if (riverside) kind = 'below'
  else if (ground) kind = 'ground'
  else if (genus === 'Tyto' || genus === 'Phodilus' || genus === 'Strix' || genus === 'Asio') kind = 'listen'
  else if (watch.has(genus) || stage === 'meadow' || stage === 'stone') kind = 'horizon'
  else if (small.has(genus) || genus === 'Pulsatrix') kind = 'peer'
  else if (leaf.has(genus)) kind = 'canopy'
  const [label,duration,heroTime] = motions[kind]
  // A small owl shifts its mass faster than a heavy one. Limit the range so that
  // listeners can still inspect the held pose on every exported animation.
  const mass = traits.massG || 500
  const pace = Math.min(1.08,Math.max(.94,1.016-Math.log10(mass/500)*.066))
  const shot = {...settings[stage]}
  if (kind === 'horizon') {shot.start+=12;shot.settle+=11}
  if (kind === 'peer' || kind === 'listen') shot.settle-=8
  if (kind === 'below') shot.elevation+=.04
  if (id==='Surnia_ulula') {shot.start=89;shot.settle=76;shot.elevation=.19;shot.offset=.024}
  if (id==='Phodilus_badius') {shot.start=52;shot.settle=35;shot.exposure=1.10}
  return {kind,label,duration:duration/pace,heroTime:heroTime/pace,stage,pace,shot,ground}
}
