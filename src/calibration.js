import production from '../data/production.json' with {type:'json'}
import records from '../data/records.json' with {type:'json'}
import pilots from '../data/calibration-pilots.json' with {type:'json'}
import plates from '../data/calibration-plates.json' with {type:'json'}
import visualSources from '../data/visual-sources.json' with {type:'json'}

const traitNames=['头身比例','面盘与耳羽','虹膜与喙','腿足与尾','收翼轮廓','羽色与纹样']
const sourceNames={photograph:'同种实拍参考',specimen:'标本参考',description:'物种描述'}
const discs={heart:'心形面盘',round:'圆面盘',brow:'眉线较清楚的面部',shallow:'面盘轮廓较浅'}
export const illustratedForm='花叔插画所示个体 · 性别与年龄未确认'

function colorFamily(hex) {
  const [r,g,b]=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16))
  const brightness=(r+g+b)/3
  if (brightness<65) return '深色'
  if (brightness>204&&r-b<30) return '近白色'
  if (r-b<20) return brightness>152?'浅灰色':'灰褐色'
  if (brightness>154) return r-b>66?'暖金褐色':'淡黄褐色'
  return r-g>28?'暖栗褐色':'棕褐色'
}

function modelledDetails(appearance, plate) {
  const f=new Set(appearance.features)
  const ratio=plate.projection.headToBodyWidth
  const head=ratio>.97?'画中头部轮廓较宽。':ratio<.79?'画中头部轮廓较窄。':'画中头与躯干的轮廓宽度接近。'
  const ear=appearance.ears>.52?'耳羽清楚可见。':appearance.ears>.09?'头顶有短小羽角。':'画中没有明显的耳羽。'
  const [r,g]=[1,3].map(i=>parseInt(appearance.colors[4].slice(i,i+2),16))
  const iris=r<115?'深色':g/r<.72?'橙褐色':'黄色或金褐色'
  const feet=f.has('long-legs')?'下腿相对长。':f.has('feathered-toes')?'趾部有覆羽，覆羽边缘待核。':'腿足只记录画中可辨的部分。'
  const tail=f.has('long-tail')?'尾部相对长。':'尾部与折翼相叠，完整轮廓待核。'
  const [wing,breast]=plate.palette.map(colorFamily)
  const feathers='翼面底色偏'+wing+'，胸腹底色偏'+breast+'。'+appearance.note
  return [head,discs[appearance.disk]+'。'+ear,'虹膜偏'+iris+'，可见喙近'+colorFamily(appearance.colors[5])+'。',feet+tail,'插画呈收翼姿势，翼羽沿体侧向下叠合。',feathers]
}

export function calibrationFor(id) {
  const appearance=production[id]
  if(!appearance)return null
  const pilot=pilots[id], plate=plates[id]
  const evidence=visualSources[id]
  const traits=pilot?.traits || modelledDetails(appearance,plate)
  return {
    id, form:illustratedForm, plateSource:appearance.plateSource,
    angles:pilot?.view || [67,3],
    cue:pilot?.cue || appearance.note,
    marks:traitNames.map((label,index)=>[label,traits[index]]),
    variation:pilot?.variation || '',
    photo:{url:evidence?.page,label:sourceNames[evidence?.kind] || '外观参考'},
    sourceDescription:records[id]?.guide,
    cautions: [evidence?.note,'插画遮住背面和翼下的部分按同种资料复原。资料未显示的羽区纹样待核。'].filter(Boolean).join(' '),
  }
}
