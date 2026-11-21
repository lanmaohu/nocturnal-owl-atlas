// file:// pages can only open a binary chosen by the user. Keep File handles,
// not their binary contents, so indexing an entire folder costs very little.
export function createModelSource(buildInfo) {
  const local = new Map()
  const isFile = location.protocol === 'file:'
  const embedded = new Map([...document.querySelectorAll('script[data-model]')].map(node => [node.dataset.model,node]))
  const pendingLocal = id => isFile && !embedded.has(id) && !local.has(id)

  function indexFiles(files) {
    let found=0
    for (const file of files) {
      const m = /^([A-Z][a-z]+_[a-z]+)\.glb$/i.exec(file.name)
      if (!m || !buildInfo(m[1])) continue
      local.set(m[1],file)
      found++
    }
    return found
  }

  async function read(id) {
    const inline = embedded.get(id)
    let buffer
    if (inline) {
      const encoded = inline.textContent.trim()
      if (Uint8Array.fromBase64) return Uint8Array.fromBase64(encoded).buffer
      const decoded = atob(encoded), data=new Uint8Array(decoded.length)
      for(let i=0;i<decoded.length;i++) data[i]=decoded.charCodeAt(i)
      return data.buffer
    }
    const file = local.get(id)
    if (file) {
      const info = buildInfo(id)
      if (info && file.size !== info.bytes) throw Error('文件大小与本版记录不符，请重新选择交付的 GLB。')
      buffer = await file.arrayBuffer()
      if (info?.sha256 && globalThis.crypto?.subtle) {
        const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)), n => n.toString(16).padStart(2,'0')).join('')
        if (actual !== info.sha256) throw Error('这个文件与本版模型不一致，请重新选择交付的 GLB。')
      }
    } else {
      if (isFile) throw Error('请选择交付的模型文件。')
      const response = await fetch('./models/' + encodeURIComponent(id) + '.glb')
      if (!response.ok) throw Error('未能读取模型，请检查 models 文件夹。')
      buffer = await response.arrayBuffer()
    }
    if (buffer.byteLength < 20 || new DataView(buffer).getUint32(0,true) !== 0x46546c67) throw Error('该文件不是可用的 GLB 模型。')
    return buffer
  }
  return { isFile, pendingLocal, indexFiles, read }
}
