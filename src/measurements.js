const number = new Intl.NumberFormat('zh-CN', {maximumFractionDigits:2})
export const measurementProtocol='https://zenodo.org/records/6308984'

// Every species uses the same axis for a given body part. A range occupies an
// interval on its axis, whereas a single value ends at one position.
export function modelMeasurements(record) {
  const {size={},traits={}}=record
  return [
    {label:'体长',range:size.bodyLengthCm,unit:'cm',max:90},
    {label:'单翼翼长',value:traits.wingMm,unit:'mm',max:550},
    {label:'尾长',value:traits.tailMm,unit:'mm',max:300},
    {label:'跗跖长',value:traits.tarsusMm,unit:'mm',max:100},
    {label:'嘴峰长',value:traits.beakCulmenMm,unit:'mm',max:60},
  ].map(measurement=>{
    const {range,value,unit}=measurement
    const bounds=range ?? (value==null ? null : [value,value])
    const text=bounds ? [...new Set(bounds)].map(v=>number.format(v)).join('–')+' '+unit : '未收录'
    return {...measurement,bounds,text}
  })
}
