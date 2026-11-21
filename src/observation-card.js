export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function saveObservationCard(canvas, sample) {
  const card = document.createElement('canvas')
  card.width = 1080
  card.height = 1440
  const ctx = card.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.fillStyle = '#0b1223'
  ctx.fillRect(0, 0, card.width, card.height)

  ctx.fillStyle = '#acc6f5'
  ctx.font = '600 35px system-ui, sans-serif'
  ctx.fillText('夜行图鉴', 60, 105)
  ctx.strokeStyle = '#506791'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(60, 142)
  ctx.lineTo(1020, 142)
  ctx.stroke()

  const scale = Math.min(960 / canvas.width, 1000 / canvas.height)
  const width = canvas.width * scale
  const height = canvas.height * scale
  ctx.drawImage(canvas, (1080 - width) / 2, 168 + (1000 - height) / 2, width, height)

  ctx.fillStyle = '#f1f6ff'
  ctx.font = '600 80px system-ui, sans-serif'
  ctx.fillText(sample.name, 60, 1269, 960)
  ctx.fillStyle = '#acc6f5'
  ctx.font = 'italic 45px Georgia, serif'
  ctx.fillText(sample.id.replace('_', ' '), 62, 1344, 956)

  const blob = await new Promise(resolve => card.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG unavailable')
  downloadBlob(blob, sample.id + '-观察卡.png')
}
