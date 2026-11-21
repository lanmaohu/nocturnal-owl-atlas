import {speciesMorphology} from './morphology.js'

const brown = ['#523e30','#b89972','#c0a17d','#3b2925','#daa445','#4a423c']
const grey = ['#625851','#ada293','#aa9e8d','#483d37','#d59d43','#58534c']
const gold = ['#694b32','#c3a278','#d1b78e','#4d3228','#dfa843','#534640']
const barn = ['#9e733f','#ece1cd','#e6d5bb','#69422e','#3b2b20','#ab8a65']
const snowy = ['#e6e4db','#f3f2ed','#f7f5ec','#4a403c','#dfb139','#373637']
const umber = ['#48372d','#9c7958','#ad9175','#332723','#d68b3c','#514139']

const plans = {
  Phodilus:   [.89,.96,.92,.88,.21,.12,.07,'heart','streaks',umber],
  Tyto:       [.88,1.09,.95,.90,.05,.23,.20,'heart','spot',barn],
  Uroglaux:   [.90,1.05,.91,.89,.00,.54,.18,'round','bars',grey],
  Margarobyas:[.86,.88,1.00,.94,.00,.28,.13,'round','streaks',brown],
  Ninox:      [.90,.99,.94,.88,.00,.69,.16,'shallow','streaks',umber],
  Taenioptynx:[.83,.82,.88,.91,.00,.54,.13,'shallow','bars',gold],
  Xenoglaux:  [.79,.75,1.02,1.04,.00,.24,.05,'round','spot',umber],
  Micrathene: [.76,.74,.94,.92,.00,.23,.09,'shallow','spot',grey],
  Aegolius:   [.89,.77,1.04,1.01,.00,.27,.05,'round','streaks',gold],
  Athene:     [.87,.86,.91,.85,.00,.34,.29,'brow','spot',brown],
  Surnia:     [.89,1.02,.92,.91,.00,.97,.13,'brow','bars',grey],
  Glaucidium: [.84,.77,.90,.86,.00,.51,.08,'brow','streaks',brown],
  Otus:       [.83,.96,.96,.94,.45,.28,.05,'shallow','streaks',grey],
  Ptilopsis:  [.91,.88,1.00,.96,.52,.35,.09,'brow','streaks',grey],
  Asio:       [.86,1.05,.90,.91,.62,.34,.08,'round','streaks',gold],
  Jubula:     [.89,.96,.97,1.06,.52,.40,.06,'round','streaks',gold],
  Bubo:       [1.06,1.13,1.04,1.03,.72,.36,.08,'brow','bars',gold],
  Scotopelia: [1.02,1.06,1.02,.93,.00,.42,.29,'shallow','bars',gold],
  Ketupa:     [1.04,1.16,1.03,.98,.65,.39,.24,'brow','streaks',brown],
  Psiloscops: [.83,.88,.96,.95,.52,.29,.06,'shallow','streaks',grey],
  Gymnasio:   [.89,.89,1.04,.96,.00,.29,.13,'shallow','streaks',umber],
  Megascops:  [.89,.93,.99,.98,.48,.32,.06,'shallow','streaks',grey],
  Lophostrix: [1.00,.99,1.04,.96,.57,.36,.07,'brow','streaks',umber],
  Pulsatrix:  [1.01,1.04,1.00,.95,.00,.42,.09,'brow','streaks',umber],
  Strix:      [.98,1.00,1.04,1.03,.00,.43,.07,'round','streaks',grey],
}

const docs = 'https://www.allaboutbirds.org/guide/'
export const studies = {
  Bubo_bubo:{
    width:1.24, body:1.16, head:1.02, tall:.97, ears:.98, tail:.62, legs:.09, disk:'brow', design:'streaks',
    colors:['#654a35','#ceaa79','#bb9167','#281f1c','#e77c21','#483e36'],
    note:'羽角向外上方伸展，橙红色虹膜，黄褐色胸羽带粗纵纹。',source:'https://www.wildlifetrusts.org/wildlife/how-identify/how-identify-owls',
  },
  Tyto_alba:{
    width:.85,body:1.10,head:.84,tall:1.01,ears:0,tail:.29,legs:.20,disk:'heart',design:'spot',
    colors:['#b28452','#f6efe5','#f4ecdc','#644630','#483124','#b59983'],
    note:'心形浅面盘、深眼、金褐背羽和浅色腹部。',source:'https://www.nhm.ac.uk/discover/barn-owl-tyto-alba.html',
  },
  Bubo_scandiacus:{
    width:1.23,body:.97,head:.99,tall:.87,ears:0,tail:.45,legs:.02,disk:'shallow',design:'bars',
    colors:snowy, note:'成年雌鸟。白羽带褐黑横斑，后颈、翼背和尾部尤为明显，趾部覆羽。',source:'https://www.birds.cornell.edu/crows/snowy.htm',
  },
  Strix_nebulosa:{
    width:1.02,body:1.16,head:1.23,tall:1.10,ears:0,tail:.72,legs:.04,disk:'round',design:'streaks',
    colors:['#514c48','#9e958e','#9b9180','#39332e','#dfb130','#b18a4d'],
    note:'宽大的同心纹面盘、小黄眼和喙下白纹。',source:docs+'Great_Gray_Owl/id',
  },
  Athene_cunicularia:{
    width:.82,body:.88,head:.87,tall:.81,ears:0,tail:.30,legs:.46,disk:'brow',design:'spot',
    colors:['#765c46','#d2bd9e','#c4ab88','#4d382e','#ddbb44','#88795b'],
    note:'长腿、黄眼、白眉和浅色上体斑点。',source:docs+'Burrowing_Owl/id',
  },
  Strix_varia:{
    width:1.02,body:1.00,head:1.04,tall:.96,ears:0,tail:.43,legs:.06,disk:'round',design:'streaks',
    colors:['#554235','#d3c0a2','#c1af97','#49372f','#403026','#bba357'],
    note:'圆面盘、深色眼睛、上胸横纹和腹部纵纹。',source:docs+'Barred_Owl/id',
  },
  Surnia_ulula:{
    width:.83,body:1.02,head:.95,tall:.89,ears:0,tail:1.04,legs:.10,disk:'brow',design:'bars',
    colors:['#544944','#c9beb2','#d8cbba','#312d29','#dbb331','#ae9153'],
    note:'狭长尾、浅脸与深色侧缘、腹部密横斑。',source:docs+'Northern_Hawk_Owl/id',
  },
  Aegolius_acadicus:{
    width:.86,body:.77,head:1.03,tall:.97,ears:0,tail:.23,legs:.05,disk:'round',design:'streaks',
    colors:['#6a4b38','#decbb6','#d3ba9f','#553831','#edb64b','#555049'],
    note:'小型圆头、黄眼、浅色脸和栗褐纵纹。',source:docs+'Northern_Saw-whet_Owl/id',
  },
}

export function hash(s) {
  let a = 2166136261
  for (let i=0;i<s.length;i++) a=Math.imul(a^s.charCodeAt(i),16777619)
  return a>>>0
}

export function profileFor(item) {
  const [width,body,head,tall,ears,tail,legs,disk,design,colors]=plans[item.genus]
  const seed=hash(item.id)
  const rhythm=(seed/4294967296)-.5
  const palette=colors.slice()
  if(item.hints?.eye==='dark') palette[4]='#3d2c22'
  if(item.hints?.eye==='gold') palette[4]='#d6ad45'
  if(item.hints?.eye==='orange') palette[4]='#d57931'
  const base={
    width:width*(1+rhythm*.10),body:body*(1+rhythm*.084),head,tall,ears,tail,legs,
    disk:item.hints?.face==='heart'?'heart':disk,design:item.hints?.body||design,colors:palette,
    ...studies[item.id],
    seed,
  }
  if (['Bubo_bubo','Tyto_alba','Bubo_scandiacus'].includes(item.id)) return base
  // Individual variation is taken from the species record. The seed only
  // controls fine placement of separate feathers and their microtexture.
  base.width=studies[item.id]?.width ?? width
  base.body=studies[item.id]?.body ?? body
  return speciesMorphology(item,base)
}
