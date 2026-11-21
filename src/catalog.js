import records from '../data/records.json' with {type:'json'}
import {renderRecord} from './record-view.js'
import {modelMeasurements, measurementProtocol} from './measurements.js'
import {calibrationFor} from './calibration.js'

const byId = id => document.getElementById(id)
const localName = record => record.names['zh-Hans'] || record.names.en || record.scientificName
const normalize = text => String(text).normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^\p{Letter}\p{Number}]/gu, '')
function showQuickFacts(record) {
  const measurements=modelMeasurements(record)
  byId('model-stats').replaceChildren(...measurements.map(({label,text})=>{
    const item=document.createElement('div')
    const name=document.createElement('dt')
    const fact=document.createElement('dd')
    name.textContent=label
    fact.textContent=text
    item.append(name,fact)
    return item
  }))
  const scope=byId('measure-scope')
  scope.replaceChildren('物种资料值。')
  if(record.traits){
    const protocol=document.createElement('a')
    protocol.href=measurementProtocol
    protocol.target='_blank'
    protocol.rel='noopener noreferrer'
    protocol.textContent='AVONET 测量口径'
    scope.append(' ',protocol,'。')
  }
  if(record.traits?.inferred)scope.append(' 部分分项由近缘种推算。')
  if(record.size?.bodyLengthCm&&record.size.bodyLengthCm[0]===record.size.bodyLengthCm.at(-1))scope.append(' 体长为单值记录。')
  byId('size-rulers').replaceChildren(...measurements.map(({label,bounds,text,max,unit})=>{
    const row=document.createElement('div')
    row.className='ruler'
    const name=document.createElement('dt')
    name.textContent=label+' · '+text
    const display=document.createElement('dd')
    display.setAttribute('aria-hidden','true')
    const track=document.createElement('span')
    track.className='ruler-track'
    const endpoint=document.createElement('span')
    endpoint.className='ruler-max'
    endpoint.textContent=max+' '+unit
    if(bounds){
      const [low,high]=bounds
      const fill=document.createElement('span')
      fill.className='ruler-fill'
      const left=low===high ? 0 : low
      fill.style.left=left/max*100+'%'
      fill.style.width=(high-left)/max*100+'%'
      track.append(fill)
    }
    display.append(track,endpoint)
    row.append(name,display)
    return row
  }))
}

export function createCatalog(models, order, portraitFor, choose) {
  const query = byId('catalog-query')
  const filter = byId('catalog-filter')
  const results = byId('catalog-results')
  const more = byId('gallery-more')
  const archive = byId('field-record')
  const pageSize = 24
  const orderedIds = [...new Set([...order, ...Object.keys(records)])]
  const entries = orderedIds.map(id => {
    const record = records[id]
    return {
      record,
      keys: [record.scientificName, ...Object.values(record.names), ...Object.values(record.ids || {}),
        record.zh?.pinyin, ...(record.zh?.aliases || []), calibrationFor(id)?.cue].filter(Boolean).map(normalize),
    }
  })
  let matches = []

  function makeCard({record}) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'gallery-card'
    button.dataset.id = record.id
    const picture = document.createElement('div')
    picture.className = 'gallery-picture'
    const portrait = portraitFor(record.id)
    if (portrait) {
      const image = new Image()
      image.alt = ''
      image.loading = 'lazy'
      image.decoding = 'async'
      image.addEventListener('error', () => image.remove(), {once:true})
      image.src = portrait
      picture.append(image)
    }
    const caption = document.createElement('span')
    caption.className = 'gallery-caption'
    const name = document.createElement('strong')
    name.textContent = localName(record)
    const latin = document.createElement('i')
    latin.textContent = record.scientificName
    latin.lang = 'la'
    const action = document.createElement('span')
    action.className = 'card-action'
    action.textContent = models.has(record.id) ? '查看 3D' : '查看资料'
    caption.append(name, latin, action)
    button.append(picture, caption)
    item.append(button)
    return item
  }

  function appendCards() {
    const start = results.childElementCount
    results.append(...matches.slice(start, start + pageSize).map(makeCard))
    more.hidden = results.childElementCount >= matches.length
    byId('catalog-count').textContent = matches.length
      ? `显示 ${results.childElementCount}／${matches.length} 种`
      : '没有找到匹配的物种。试试其他鸟名，或清除筛选。'
  }

  function drawResults() {
    const term = normalize(query.value.trim())
    matches = entries.filter(({record, keys}) => {
      if (filter.value === 'model' && !models.has(record.id)) return false
      if (filter.value === 'guide' && !record.guide) return false
      return !term || keys.some(key => key.includes(term))
    })
    results.replaceChildren()
    appendCards()
  }

  query.addEventListener('input', drawResults)
  query.addEventListener('keydown', event => {
    if (event.isComposing) return
    const first = results.querySelector('button')
    if (event.key === 'ArrowDown' && first) {
      event.preventDefault()
      first.focus()
    }
    if (event.key === 'Enter' && matches.length === 1) {
      event.preventDefault()
      first.click()
    }
  })
  filter.addEventListener('change', drawResults)
  more.addEventListener('click', () => {
    const firstNew = results.childElementCount
    appendCards()
    results.children[firstNew]?.querySelector('button').focus()
  })
  results.addEventListener('click', event => {
    const card = event.target.closest('button[data-id]')
    if (card) choose(card.dataset.id, card, models.has(card.dataset.id))
  })
  archive.addEventListener('click', event => {
    const related = event.target.closest('button[data-related-id]')
    if (related) choose(related.dataset.relatedId, null, false)
  })
  drawResults()

  return nextId => {
    const record = records[nextId]
    const hasModel = models.has(nextId)
    const name = localName(record)
    archive.dataset.species = nextId
    archive.classList.toggle('standalone-record', !hasModel)
    byId('field-context').textContent = hasModel ? '物种资料' : [record.zh?.order || '鸮形目', record.zh?.family || record.taxonomy.family].join(' · ')
    byId('field-model').hidden = !hasModel
    byId('field-title').textContent = name
    const english = record.names.en
    byId('field-subtitle').textContent = [record.scientificName, english !== name ? english : ''].filter(Boolean).join('  ·  ')
    if (hasModel) showQuickFacts(record)
    renderRecord(byId('field-content'), record)
  }
}
