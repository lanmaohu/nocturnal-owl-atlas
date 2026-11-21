import { credits, sourceLinks, dataLicense } from '../data/credits.js'
import visualSources from '../data/visual-sources.json' with {type:'json'}
import { taxonomyChange, crosswalkUrl } from '../data/owl-crosswalk.js'

const num = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 })
const iucn = { LC: '无危', NT: '近危', VU: '易危', EN: '濒危', CR: '极危', DD: '数据缺乏', EW: '野外灭绝', EX: '灭绝' }
const habitat = { Forest: '森林', Woodland: '疏林', Shrubland: '灌丛', Grassland: '草地', Rock: '岩地', 'Human Modified': '人类改造环境', Riverine: '河流沿岸', Wetland: '湿地', Desert: '荒漠' }
const migration = { sedentary: '留居', migratory: '迁徙', 'partially migratory': '部分种群迁徙' }
const diet = { Carnivore: '肉食性', Invertivore: '以无脊椎动物为主', Vertivore: '以脊椎动物为主', Omnivore: '杂食', 'Aquatic predator': '捕食水生动物' }
const lifestyle = { Insessorial: '以停栖为主', Generalist: '多种活动方式', Aerial: '以空中活动为主' }
const density = { 1: '密闭', 2: '半开阔', 3: '开阔' }
const regions = { AF: '非洲', AU: '澳大拉西亚', IO: '印度洋', MA: '中美洲', NA: '北美洲', OR: '东洋界', PAL: '古北界', PO: '太平洋', SA: '南美洲', Worldwide: '全球' }
const translatedBreeding = {
  'high Andes of Colombia to nw Peru': '哥伦比亚至秘鲁西北部的安第斯高地',
  'tropical lowland South America s to n Argentina': '南美洲热带低地，向南延伸至阿根廷北部',
}
const nonbreeding = { 'Sulawesi and Lesser Sundas': '苏拉威西岛和小巽他群岛', 'nw India': '印度西北部', AF: '非洲' }
const databaseIds = [
  ['ebird', 'eBird', 'https://ebird.org/species/'], ['wikidata', 'Wikidata', 'https://www.wikidata.org/wiki/'],
  ['gbif', 'GBIF', 'https://www.gbif.org/species/'], ['inaturalist', 'iNaturalist', 'https://www.inaturalist.org/taxa/'],
]
const variantNames = { 'zh-Hans': '简体中文', 'zh-Hant': '繁体中文', 'fr-x-gaudin': '法语（Gaudin）', 'pt-x-lusophone': '葡萄牙语（葡语区）', 'pt-PT': '葡萄牙语（葡萄牙）' }
const langNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames('zh-CN', { type: 'language' }) : null

function el(tag, className, value) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== undefined && value !== null) node.textContent = String(value)
  return node
}

function link(label, url) {
  if (!/^https?:\/\//i.test(url || '')) return el('span', '', label)
  const a = el('a', '', label)
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  return a
}

function fieldSection(title, className = '') {
  const section = el('section', 'field-block ' + className)
  section.append(el('h3', '', title))
  return section
}

function fold(title) {
  const node = el('details', 'field-fold')
  node.append(el('summary', '', title))
  return node
}

function facts(rows) {
  const dl = el('dl', 'field-list')
  for (const [label, value] of rows) {
    if (value == null || value === '') continue
    const dd = el('dd')
    dd.append(value)
    dl.append(el('dt', '', label), dd)
  }
  return dl
}

function measureRange(values) {
  if (!values?.length) return null
  return values[0] === values.at(-1) ? num.format(values[0]) : values.map(v => num.format(v)).join('–')
}

function metric(label, value, unit, single = false) {
  const cell = el('div', 'field-metric')
  cell.append(el('dt', '', label))
  const dd = el('dd')
  if (value == null) dd.append(el('span', 'field-missing', '未收录'))
  else {
    dd.append(el('span', 'field-figure', value), el('span', 'field-unit', unit))
    if (single) dd.append(el('small', 'field-single', '单值记录'))
  }
  cell.append(dd)
  return cell
}

function measures(record) {
  const section = fieldSection('体尺', 'field-measures')
  const t = record.traits || {}, s = record.size || {}
  if (!record.traits && !record.size) {
    section.append(el('p', 'field-muted', '首版未收录这个物种的体尺。'))
    return section
  }
  const single = a => a?.length > 0 && a.every(n => n === a[0])
  const row = el('dl', 'field-metrics')
  row.append(metric('体长', measureRange(s.bodyLengthCm), '厘米', single(s.bodyLengthCm)),
    metric('翼展', measureRange(s.wingspanCm), '厘米', single(s.wingspanCm)),
    metric('体重', t.massG != null ? num.format(t.massG) : null, '克'),
    metric('单翼翼长', t.wingMm != null ? num.format(t.wingMm) : null, '毫米'))
  section.append(row)
  if (t.inferred) section.append(el('p', 'field-caution', 'AVONET 标明，部分指标由近缘物种推算。'))
  if (record.traits) {
    const detail = fold('尾、足与喙的测量值')
    const mm = v => v == null ? null : num.format(v) + ' 毫米'
    detail.append(facts([['尾长',mm(t.tailMm)],['跗跖长',mm(t.tarsusMm)],['嘴峰长',mm(t.beakCulmenMm)],
      ['喙宽',mm(t.beakWidthMm)],['喙深',mm(t.beakDepthMm)],['手翼指数',t.handWingIndex == null ? null : num.format(t.handWingIndex)]]))
    section.append(detail)
  }
  const sources = []
  if (record.traits) sources.push('体重、单翼翼长等分项测量取自 AVONET。')
  if (s.bodyLengthSource) {
    const label = s.bodyLengthSource.startsWith('zhwiki') ? '中文维基百科' : s.bodyLengthSource.startsWith('enwiki') ? '英文维基百科' : s.bodyLengthSource
    sources.push('体长取自' + label + '。')
  }
  if (s.wingspanCm) sources.push('翼展按首版记录。')
  if (sources.length) section.append(el('p', 'field-footnote', sources.join('')))
  return section
}

function fieldGuide(guide) {
  const section = fieldSection('野外辨识', 'field-guide')
  if (guide.impression) section.append(el('p','field-impression', guide.impression))
  if (guide.marks?.length) {
    const list = el('ul','field-marks')
    for (const mark of guide.marks) list.append(el('li','',mark))
    section.append(list)
  }
  const observations = facts([['雌雄与幼鸟',guide.sexAge],['叫声描述',guide.call],['观察笔记',guide.funFact]])
  if (observations.children.length) section.append(observations)
  if (guide.similar?.length) {
    const similar = fold('相似物种辨别')
    const comparisons = el('ul','field-comparisons')
    for (const {zh, sci, diff} of guide.similar) {
      const item = el('li')
      const button = el('button', 'field-related', zh || sci)
      button.type = 'button'
      button.dataset.relatedId = sci.replaceAll(' ', '_')
      button.title = '查看' + (zh || sci) + '的物种资料'
      item.append(button)
      if (diff) item.append(el('p','',diff))
      comparisons.append(item)
    }
    similar.append(comparisons)
    section.append(similar)
  }
  const byline = el('p','field-footnote')
  byline.append('花叔中文图鉴 · ',link('CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'))
  if (guide.basedOn) byline.append(' · ',link('条目所据资料',guide.basedOn))
  section.append(byline)
  return section
}

function ecologicalRecord(record) {
  const section = fieldSection('分布与习性', 'field-distribution')
  const range = record.range || {}, traits = record.traits || {}
  const region = (range.breedingRegion || '').split(',').map(v => regions[v.trim()] || v.trim()).filter(Boolean).join('、')
  const suppliedTranslation = translatedBreeding[range.breeding]
  section.append(facts([['繁殖分布',range['zh-Hans'] || [region,suppliedTranslation || range.breeding].filter(Boolean).join(' · ')],
    ['繁殖分布原文',suppliedTranslation ? range.breeding : null],
    ['非繁殖分布',nonbreeding[range.nonbreeding] || range.nonbreeding],
    ['栖息环境',habitat[traits.habitat] || traits.habitat],
    ['植被疏密',density[traits.habitatDensity]],['迁徙习性',migration[traits.migration] || traits.migration],
    ['摄食类群',diet[traits.trophicLevel] || traits.trophicLevel],['食物类型',diet[traits.trophicNiche] || traits.trophicNiche],
    ['活动方式',lifestyle[traits.primaryLifestyle] || traits.primaryLifestyle]]))
  if (record.subspecies?.length) {
    const detail = fold('亚种分布（' + record.subspecies.length + '）')
    const list = el('ul','field-subspecies')
    for (const sub of record.subspecies) {
      const item = el('li')
      item.append(el('i','','' + record.scientificName + ' ' + sub.name))
      if (sub.authority) item.append(el('small','',sub.authority))
      if (sub.range) item.append(el('p','',sub.range))
      list.append(item)
    }
    detail.append(list)
    section.append(detail)
  }
  return section
}

function protection(record) {
  const section = fieldSection('保护状况')
  const c = record.conservation || {}
  section.append(facts([
    ['IUCN 红色名录',c.iucn ? (iucn[c.iucn] || c.iucn) + '（' + c.iucn + '）' : '未收录'],
    ['CITES 附录',c.cites ? '附录 ' + c.cites : '未收录'],
    ['中国国家保护级别',c.chinaProtection ? ({ 'Class I':'国家一级','Class II':'国家二级' }[c.chinaProtection] || c.chinaProtection) : '未收录'],
  ]))
  const p = el('p','field-footnote')
  const provenance = [c.sources?.iucn, c.sources?.cites, c.sources?.chinaProtection].filter(Boolean)
  if (provenance.length) p.append('首版采用 ', provenance.join('、'), '。')
  else p.append('首版未提供该种的保护记录。')
  section.append(p)
  return section
}

function otherNames(names) {
  const detail = fold('多语种名称（' + Object.keys(names).length + '）')
  const grid = el('dl','field-languages')
  const first = ['zh-Hans','zh-Hant','en']
  const pairs = first.filter(code => names[code]).concat(Object.keys(names).filter(code => !first.includes(code)).sort())
  for (const code of pairs) {
    const row = el('div')
    const value = el('dd','',names[code])
    value.lang = code
    value.dir = 'auto'
    row.append(el('dt','',variantNames[code] || langNames?.of(code) || code),value)
    grid.append(row)
  }
  detail.append(grid)
  return detail
}

function taxonomy(record) {
  const section = fieldSection('名称与分类')
  const z = record.zh || {}, tax = record.taxonomy, names = record.names
  const full = (cn, latin) => [cn, latin].filter(Boolean).join(' · ')
  section.append(facts([['英文名',names.en],['拼音',z.pinyin],['其他中文名',z.aliases?.join('、')],
    ['学名',record.scientificName],['命名人',record.authority],['目',full(z.order,tax.order)],
    ['科',full(z.family,tax.family)],['属',tax.genus]]))
  const change = taxonomyChange(record.id)
  if (change) {
    const note = el('p', 'field-crosswalk')
    note.append(change, ' ', link('名录对照表', crosswalkUrl))
    section.append(note)
  }
  section.append(otherNames(names))
  const ids = databaseIds.filter(([key]) => record.ids?.[key] != null)
  if (ids.length) {
    const detail = fold('外部数据库编号')
    detail.append(facts(ids.map(([key, label, base]) => [label,link(record.ids[key],base + encodeURIComponent(record.ids[key]))])))
    section.append(detail)
  }
  return section
}

function photoSource(record) {
  const ref = record.sticker?.reference
  if (!ref) return null
  const sources = ref.type === 'reference-board' ? ref.items || [] : [ref]
  if (!sources.length) return null
  const detail = fold('插画参考照片（' + sources.length + '）')
  const list = el('ul','field-photos')
  for (const photo of sources) {
    const row = el('li')
    if (photo.page) {
      const host = new URL(photo.page).hostname.replace(/^www\./,'')
      row.append(link('查看照片 · ' + host,photo.page))
    }
    row.append(el('p','', [photo.author ? '摄影 ' + photo.author : '作者未收录', photo.license || '许可未收录'].join(' · ')))
    list.append(row)
  }
  detail.append(list)
  return detail
}

function sourceRecord(record) {
  const section = fieldSection('参考与署名','field-sources')
  const evidence = visualSources[record.id]
  const labels = {photograph:'个体实拍', specimen:'馆藏标本', description:'物种描述'}
  const modelRefs = fold('三维模型的形态依据 · ' + labels[evidence.kind])
  const references = el('ul','field-photos')
  for (const source of [evidence, ...(evidence.additional || [])]) {
    const item = el('li')
    item.append(link([labels[source.kind], source.credit || new URL(source.page).hostname].join(' · '),source.page))
    if (source.note) item.append(el('p','',source.note))
    references.append(item)
  }
  modelRefs.append(references)
  section.append(modelRefs)
  const ref = photoSource(record)
  if (ref) section.append(ref)
  const detail = fold('数据版本、来源与许可')
  const row = el('p','field-source-line')
  row.append('花叔鸟类贴纸库首版 v0.1.0 · IOC 15.2。',link('物种数据',sourceLinks.species),' · ',link('字段说明',sourceLinks.dictionary))
  if (record.guide) row.append(' · ',link('中文图鉴',sourceLinks.guide))
  detail.append(row)
  const list = el('ul','field-credits')
  for (const credit of credits) {
    const item = el('li')
    item.append(el('strong','',credit.label), ' · ', link(credit.source, credit.url))
    if (credit.license) item.append(' · ',link(credit.license,credit.licenseUrl))
    list.append(item)
  }
  const license = fold('数据汇编的 MIT 许可原文')
  license.append(el('pre','field-license',dataLicense))
  detail.append(list, license)
  section.append(detail)
  return section
}

// The atlas owns the selected species. Rendering a record does not fetch resources
// or alter model playback, camera position, or focus.
export function renderRecord(container, record) {
  if (!record) {
    container.replaceChildren(el('p','field-muted','首版未收录该物种的资料。'))
    return
  }
  const grid = el('div','field-dossier')
  grid.dataset.species = record.id
  grid.append(measures(record))
  if (record.guide) grid.append(fieldGuide(record.guide))
  grid.append(ecologicalRecord(record), protection(record), taxonomy(record), sourceRecord(record))
  container.replaceChildren(grid)
}
