import records from '../data/records.json' with {type:'json'}
import visualSources from '../data/visual-sources.json' with {type:'json'}
import production from '../data/production.json' with {type:'json'}
import modelIndex from '../data/model-index.json' with {type:'json'}
import {samples} from './samples.js'
import {motionFor} from './behavior.js'
import {calibrationFor} from './calibration.js'

const approved = new Map(samples.map(sample => [sample.id,sample]))
export const availableIds = new Set([...Object.keys(modelIndex), ...approved.keys()])
export const catalogSequence = Object.values(records).filter(record=>availableIds.has(record.id)).sort((a,b)=>a.taxonomy.seq-b.taxonomy.seq).map(record=>record.id)

export function specimenFor(id, allowUnlisted = false) {
  const record = records[id]
  if (!record || (!allowUnlisted && !availableIds.has(id))) return null
  const calibration = calibrationFor(id)
  if (approved.has(id)) return {...approved.get(id), form:calibration.form, marks:calibration.marks, calibration}
  const design = production[id] || {}
  const {label,shot} = motionFor(id)
  const ref = record.sticker?.reference
  return {
    id, name: record.names['zh-Hans'] || record.names.en || record.scientificName,
    family: record.zh?.family || (record.taxonomy.family === 'Tytonidae' ? '草鸮科' : '鸱鸮科'),
    familyLatin:record.taxonomy.family, form:calibration.form, marks:calibration.marks, calibration,
    shot, observation:label, reference:visualSources[id]?.page || design.source || ref?.page || ref?.items?.[0]?.page,
  }
}

export function publishedModel(id) { return modelIndex[id] }

export function illustrationSource(id) { return calibrationFor(id)?.plateSource }
