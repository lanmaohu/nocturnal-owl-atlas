import * as T from '../vendor/three.module.js'
import { OrbitControls } from '../vendor/OrbitControls.js'
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js'
import { habitat } from './habitats.js'
import { makeOptics } from './optics.js'
import { samples } from './samples.js'
import { createCatalog } from './catalog.js'
import { availableIds, catalogSequence, specimenFor, publishedModel } from './specimens.js'
import { motionFor } from './behavior.js'
import { createModelSource } from './model-source.js'

const byId = id => document.getElementById(id)
const home = byId('atlas-home')
const viewer = byId('atlas-viewer')
const gallery = byId('gallery')
const viewport = byId('viewport')
const canvas = byId('view')
const pauseButton = byId('toggle-play')
const spreadButton = byId('spread')
const observeButton = byId('observe')
const stateMessage = byId('state-message')
const loader = new GLTFLoader()
const source = createModelSource(publishedModel)
const readyModels = new Map()
const params = new URLSearchParams(location.search)
const inspecting = params.get('inspection') === '1'
let parsing = Promise.resolve()
const entrySpecies = specimenFor(params.get('species'))
const galleryFeatures = [...samples.map(sample => sample.id), 'Strix_nebulosa', 'Athene_cunicularia', 'Surnia_ulula', 'Scotopelia_peli', 'Phodilus_badius']
const showFacts = createCatalog(availableIds, [...galleryFeatures, ...catalogSequence], id => publishedModel(id)?.portrait, openSpecies)
let selected
let lastCard
let selectionToken = 0
let renderer, scene, camera, controls, optics, active
let paused = false
let currentMotion = 'Perch', view = 'whole'
let intro = false, transition = null, spreadReturn = null
let previousTime = 0, sceneTime = 0, studioVisible = true
const eye = new T.Vector3(), otherEye = new T.Vector3()
const axis = new T.Vector3(), desiredTarget = new T.Vector3(), desiredPosition = new T.Vector3()
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

function status(text = '', retry = false) {
  stateMessage.textContent = text
  byId('model-state').hidden = !text
  byId('retry-model').hidden = !retry
}

function showSection(section) {
  section.focus({preventScroll:true})
  section.scrollIntoView({block:'start'})
}

function displaySpecies(id, show = true) {
  home.hidden = true
  viewer.hidden = false
  const sample = specimenFor(id)
  if (selected?.id !== id || !active) select(sample, id)
  if (show) showSection(sample ? viewer : byId('field-record'))
}

function openSpecies(id, card, atModel) {
  if (card) lastCard = card
  const url = new URL(location.href)
  url.searchParams.set('species', id)
  url.hash = ''
  if (viewer.hidden) history.pushState({fromGallery:true}, '', url)
  else history.replaceState(history.state, '', url)
  displaySpecies(id, atModel)
  if (!atModel) showSection(byId('field-record'))
}

function displayGallery(restore = true) {
  selectionToken++
  if (active) active.mixer.stopAllAction()
  active = null
  scene = null
  selected = null
  viewer.hidden = true
  home.hidden = false
  if (!restore) return
  if (lastCard?.isConnected) {
    lastCard.focus({preventScroll:true})
    lastCard.scrollIntoView({block:'center'})
  } else showSection(gallery)
}

function returnToGallery() {
  if (history.state?.fromGallery) {
    history.back()
    return
  }
  const url = new URL(location.href)
  url.searchParams.delete('species')
  url.hash = ''
  history.replaceState(null, '', url)
  displayGallery()
}

byId('catalog-open').addEventListener('click', returnToGallery)
byId('field-browse').addEventListener('click', returnToGallery)
document.querySelector('.explore-link').addEventListener('click', event => {
  event.preventDefault()
  showSection(gallery)
})
for (const link of viewer.querySelectorAll('a[href="#field-record"], a[href="#model-spread"]')) {
  link.addEventListener('click', event => {
    event.preventDefault()
    showSection(document.querySelector(link.hash))
  })
}
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('species')
  if (specimenFor(id)) displaySpecies(id)
  else displayGallery()
})

function showPageLinks(sample) {
  const count=catalogSequence.length,index=catalogSequence.indexOf(sample.id)
  const pages=byId('model-pages')
  pages.hidden=index<0 || count<=samples.length
  if(pages.hidden)return
  byId('page-number').textContent=(index+1)+' / '+count
  for(const [buttonId,step,caption] of [['model-prev',-1,'上一种'],['model-next',1,'下一种']]){
    const button=byId(buttonId)
    const adjacent=specimenFor(catalogSequence[(index+step+count)%count])
    button.dataset.id=adjacent.id
    button.textContent=caption+' · '+adjacent.name
  }
}
byId('model-pages').addEventListener('click',event=>{
  const button=event.target.closest('button[data-id]')
  if (!button) return
  openSpecies(button.dataset.id, null, true)
})
function showRecord(sample) {
  showPageLinks(sample)
  byId('name').textContent = sample.name
  byId('family').textContent = sample.family + ' · ' + sample.familyLatin
  byId('latin').textContent = sample.id.replace('_', ' ')
  byId('form').textContent = sample.form
  byId('marks').replaceChildren(...sample.marks.map(([term, description]) => {
    const row = document.createElement('div')
    row.className = 'mark'
    const label = document.createElement('dt')
    label.textContent = term
    const content = document.createElement('dd')
    content.textContent = description
    row.append(label, content)
    return row
  }))
  observeButton.querySelector('span').textContent = sample.observation
  byId('reference').hidden = !sample.reference
  if (sample.reference) byId('reference').href = sample.reference
  byId('model-notes').hidden = !sample.marks.length
  const poster = publishedModel(sample.id)?.portrait
  const plate = byId('representative')
  plate.hidden = !poster
  if (poster) {plate.href=poster;plate.download=sample.id+'.jpg'}
  const image=byId('model-cover')
  image.hidden=true
  if(poster && !inspecting) {
    image.alt=sample.name+'代表画面'
    image.src=poster
  }else image.removeAttribute('src')
  byId('download').setAttribute('aria-label', '保存' + sample.name + ' GLB 模型')
}

function release(entry) {
  entry.mixer.stopAllAction()
  entry.mixer.uncacheRoot(entry.root)
  const materials=new Set(), geometries=new Set(), textures=new Set(), bitmaps=new Set()
  entry.environment.scene.traverse(node=>{
    if(node.geometry) geometries.add(node.geometry)
    if(node.material) for(const m of [node.material].flat()) materials.add(m)
    if(node.isInstancedMesh)node.dispose()
    if(node.skeleton)node.skeleton.dispose()
    if(node.isLight && node.shadow)node.shadow.dispose()
  })
  for(const material of materials) {
    for(const prop of Object.values(material)) if (prop?.isTexture) textures.add(prop)
    for(const uniform of Object.values(material.uniforms || {})) if(uniform.value?.isTexture) textures.add(uniform.value)
    material.dispose()
  }
  for(const tex of textures) {
    if(tex.source?.data?.close)bitmaps.add(tex.source.data)
    tex.dispose()
  }
  for(const bitmap of bitmaps)bitmap.close()
  for(const geometry of geometries)geometry.dispose()
  entry.environment.illumination.dispose()
  entry.environment.scene.clear()
  renderer.renderLists.dispose()
}

async function modelFor(sample) {
    if(readyModels.has(sample.id)){
      const found=readyModels.get(sample.id)
      readyModels.delete(sample.id);readyModels.set(sample.id,found)
      return found
    }
    if(readyModels.size>=2){
      const oldest=readyModels.keys().next().value
      release(readyModels.get(oldest));readyModels.delete(oldest)
    }
    const glb = await loader.parseAsync(await source.read(sample.id), '')
    const mixer = new T.AnimationMixer(glb.scene)
    const actions = Object.fromEntries(glb.animations.map(clip => [clip.name, mixer.clipAction(clip)]))
    if (!actions.Perch || !actions.Spread) throw Error('Missing owl animations')
    glb.scene.traverse(node => {
      if (node.isMesh) node.receiveShadow = node.castShadow = true
    })
    glb.scene.updateMatrixWorld(true)
    const resting = new T.Box3().setFromObject(glb.scene)
    const spread = resting.clone()
    const spreadAction = actions.Spread
    spreadAction.setLoop(T.LoopOnce, 1)
    spreadAction.clampWhenFinished = true
    spreadAction.play()
    // Fit the laid-out wings as well as the resting silhouette across viewport shapes.
    for (const progress of [.23, .44, .60, .78]) {
      mixer.setTime(spreadAction.getClip().duration * progress)
      glb.scene.updateMatrixWorld(true)
      spread.union(new T.Box3().setFromObject(glb.scene))
    }
    mixer.stopAllAction()
    glb.scene.updateMatrixWorld(true)
    const environment = habitat(sample.id,renderer)
    environment.scene.add(glb.scene)
    const head = glb.scene.getObjectByName('Head') || glb.scene
    const eyes = ['Iris_L','Iris_R'].map(name => glb.scene.getObjectByName(name) || head)
    const entry = {root:glb.scene, mixer, actions, resting, spread, sample, environment, eyes, head}
    if (actions.Observe) {
      actions.Observe.setLoop(T.LoopOnce, 1)
      actions.Observe.clampWhenFinished = true
    }
    mixer.addEventListener('finished', event => {
      if (entry !== active || event.action !== active.actions[currentMotion]) return
      const wasSpread = currentMotion === 'Spread'
      intro = false
      // Defer the state change until AnimationMixer finishes its update.
      queueMicrotask(() => {
        if (entry !== active || event.action !== active.actions[currentMotion]) return
        startMotion('Perch')
        if (wasSpread && spreadReturn) moveCamera(spreadReturn, .55)
        spreadReturn = null
      })
    })
    readyModels.set(sample.id,entry)
    return entry
}

function manualView() {
  intro = false; transition = null; spreadReturn = null
  view = 'manual'
  updateLabels()
}

function ensureRenderer() {
  if (!renderer) initializeScene()
}

function initializeScene() {
  renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6))
  renderer.setClearColor(0x363e35)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.localClippingEnabled = true
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap
  if (renderer.extensions.has('EXT_color_buffer_float')) {
    optics = makeOptics(true)
    optics.target.samples = Math.min(2, renderer.capabilities.maxSamples)
  }
  camera = new T.PerspectiveCamera(33, 1, .045, 76)
  controls = new OrbitControls(camera, canvas)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = .13
  controls.minPolarAngle = .015
  controls.maxPolarAngle = Math.PI - .015
  controls.addEventListener('start', manualView)
  new ResizeObserver(resize).observe(viewport)
  if (!inspecting && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries=>{studioVisible=entries[0].isIntersecting}).observe(viewport)
  }
  resize()
  if(!inspecting) renderer.setAnimationLoop(frame)
}

function fitDistance(box) {
  const size = box.getSize(new T.Vector3())
  const tan = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))
  return Math.max(size.y/tan, (size.x+size.z*.25)/(tan*camera.aspect))*1.12 + size.z*.4
}

function nearestEye() {
  active.eyes[0].getWorldPosition(eye)
  active.eyes[1].getWorldPosition(otherEye)
  if (camera.position.distanceToSquared(otherEye) < camera.position.distanceToSquared(eye)) eye.copy(otherEye)
  return eye
}

function shot(viewName, fraction=0) {
  const { shot } = active.sample
  const box = active.resting, size = box.getSize(new T.Vector3()), target = box.getCenter(new T.Vector3())
  const portrait = viewName === 'portrait'
  const yaw = T.MathUtils.degToRad(portrait ? shot.portrait : T.MathUtils.lerp(shot.start, shot.settle, fraction))
  const pitch = portrait ? .07 : T.MathUtils.lerp(shot.elevation, shot.elevation+.015, fraction)
  axis.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch))
  let distance = fitDistance(currentMotion === 'Spread' ? active.spread : box)
  if (portrait) {
    active.head.getWorldPosition(target)
    target.lerp(nearestEye(), .27)
    distance = size.y * Math.max(1.03,1.17/camera.aspect)
  } else {
    distance *= T.MathUtils.lerp(1.12,1.02,fraction)
    target.y += size.y*T.MathUtils.lerp(.015,.025,fraction)
    const side = size.y*shot.offset*Math.min(camera.aspect,1.5)
    target.x += Math.cos(yaw)*side
    target.z -= Math.sin(yaw)*side
  }
  return { target, position:target.clone().addScaledVector(axis,distance) }
}

function applyPose(to) {
  controls.target.copy(to.target)
  camera.position.copy(to.position)
  controls.update()
}

function moveCamera(to, seconds=.65) {
  if (reducedMotion || !seconds) { transition=null; applyPose(to); return }
  transition = {from:camera.position.clone(), target:controls.target.clone(), to, time:0, seconds}
}

function setView(mode, immediate=false) {
  if (!active) return
  intro=false; spreadReturn=null; view=mode
  moveCamera(shot(mode,1),immediate ? 0 : .65)
  updateLabels()
}

function resetView() {
  if (!active) return
  controls.enableDamping=false; controls.update()
  setView('whole',true)
  controls.enableDamping=true
}

function resize() {
  const w = Math.max(1, viewport.clientWidth), h = Math.max(1, viewport.clientHeight)
  renderer.setSize(w,h,false)
  if (optics) {
    const size=renderer.getDrawingBufferSize(new T.Vector2())
    optics.resize(size.x,size.y)
  }
  camera.aspect=w/h; camera.updateProjectionMatrix()
  if (active && view!=='manual' && !intro) setView(view,true)
}

function updateLabels() {
  pauseButton.querySelector('span').textContent = paused ? '继续' : '暂停'
  pauseButton.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause')
  pauseButton.setAttribute('aria-label', paused ? '继续播放动画' : '暂停当前动画')
  spreadButton.setAttribute('aria-pressed', String(currentMotion === 'Spread'))
  observeButton.setAttribute('aria-pressed', String(currentMotion === 'Observe'))
  byId('whole').setAttribute('aria-pressed',String(view==='whole'))
  byId('portrait').setAttribute('aria-pressed',String(view==='portrait'))
  viewport.dataset.motion=currentMotion
  viewport.dataset.view=view
}

function startMotion(name) {
  active.mixer.stopAllAction()
  currentMotion=name
  active.actions[name].reset().play()
  active.mixer.update(0)
  active.root.updateMatrixWorld(true)
  updateLabels()
}

function observation() {
  if (!active) return
  paused = false
  transition = null; spreadReturn = null; view = 'whole'
  const name = active.actions.Observe ? 'Observe' : 'Perch'
  startMotion(name)
  intro = name === 'Observe' && !reducedMotion
  applyPose(shot('whole',intro?0:1))
}

function localPrompt(message) {
  status(message || '')
  byId('file-actions').hidden=false
  byId('folder-open').hidden=!('webkitdirectory' in byId('folder-input'))
  byId('file-name').textContent=selected.id+'.glb'
  const poster=byId('model-cover')
  poster.hidden=!poster.getAttribute('src') || (poster.complete && !poster.naturalWidth)
  byId('view').style.visibility='hidden'
  byId('download').disabled=true
}

let folderConnected = false

async function select(sample, id = sample.id) {
  const version=++selectionToken
  selected=sample
  if (active) active.mixer.stopAllAction()
  active=null; scene=null; transition=null; intro=false; spreadReturn=null
  delete viewport.dataset.ready
  byId('model-spread').hidden = !sample
  byId('file-actions').hidden=!source.isFile || folderConnected
  byId('view').style.visibility=''
  byId('model-pages').hidden = !sample
  showFacts(id)
  if (!sample) return
  showRecord(sample)
  // A newly selected record must never show the previously drawn owl while
  // its model is loading. Its own delivered picture can stand in meanwhile.
  canvas.style.visibility='hidden'
  const poster=byId('model-cover')
  if(!inspecting && poster.complete && poster.naturalWidth && poster.getAttribute('src')) poster.hidden=false
  for (const button of [pauseButton,spreadButton,observeButton,byId('whole'),byId('portrait'),byId('reset')]) button.disabled=true
  byId('download').disabled=false
  if(source.pendingLocal(id)) {localPrompt(); return}
  try {
    ensureRenderer()
  } catch (error) {
    renderer = null
    status('此浏览器无法启动三维显示。你仍可查看代表画面或保存 GLB。')
    console.error(error)
    if (inspecting) throw error
    return
  }
  resize()
  status('正在打开模型…')
  try {
    const task=parsing.then(()=>version===selectionToken ? modelFor(sample) : null)
    parsing=task.catch(()=>{})
    const model=await task
    if (version!==selectionToken || !model) return
    active=model; scene=model.environment.scene
    renderer.toneMappingExposure=sample.shot.exposure
    const h=model.resting.getSize(new T.Vector3()).y
    controls.minDistance=h*.33;controls.maxDistance=h*5.8
    for(const button of [pauseButton,spreadButton,observeButton,byId('whole'),byId('portrait'),byId('reset')]) button.disabled=false
    if (reducedMotion) {paused=true;startMotion('Perch');setView('whole',true)} else observation()
    canvas.style.visibility=''
    byId('model-cover').hidden=true
    status()
    viewport.dataset.ready=sample.id
    return model
  } catch(error) {
    if (version!==selectionToken) return
    if(source.isFile && !samples.some(s=>s.id===id)) localPrompt(error.message)
    else status('模型加载失败，请重试或查看代表画面。', true)
    if (inspecting) throw error
  }
}

const folderInput=byId('folder-input'),singleInput=byId('model-input')
byId('folder-open').addEventListener('click',()=>folderInput.click())
byId('single-open').addEventListener('click',()=>singleInput.click())
folderInput.addEventListener('change',()=>{
  if(!folderInput.files.length)return
  folderConnected = source.indexFiles(folderInput.files) > 0
  folderInput.value=''
  if(!selected)return
  if(source.pendingLocal(selected.id)) localPrompt('这个文件夹中没有当前物种的 GLB。')
  else select(selected)
})
singleInput.addEventListener('change',()=>{
  const file=singleInput.files[0];singleInput.value=''
  if(!file || !selected)return
  if(file.name!==selected.id+'.glb'){localPrompt('请选择与当前物种同名的模型文件。');return}
  source.indexFiles([file]);select(selected)
})
byId('model-cover').addEventListener('load',()=>{
  if(!inspecting && selected && viewport.dataset.ready!==selected.id) byId('model-cover').hidden=false
})
byId('model-cover').addEventListener('error',()=>{byId('model-cover').hidden=true})


function frame(now) {
  const dt = previousTime ? Math.min((now-previousTime)/1000,.10) : 0
  previousTime=now
  if (document.hidden || !studioVisible || !active || !scene) return
  if (!paused) {active.mixer.update(dt);sceneTime+=dt}
  active.root.updateMatrixWorld(true)
  if (intro && !paused) {
    const t=active.actions.Observe.time / active.actions.Observe.getClip().duration
    applyPose(shot('whole',T.MathUtils.smoothstep(t,0,.60)))
  } else if(transition) {
    transition.time+=dt
    const t=T.MathUtils.smoothstep(transition.time,0,transition.seconds)
    desiredPosition.lerpVectors(transition.from,transition.to.position,t)
    desiredTarget.lerpVectors(transition.target,transition.to.target,t)
    applyPose({position:desiredPosition,target:desiredTarget})
    if(t===1)transition=null
  } else {
    controls.update()
  }
  camera.updateMatrixWorld()
  if (active.environment.plantPlane) {
    camera.getWorldDirection(axis)
    active.environment.plantPlane.setFromNormalAndCoplanarPoint(axis,desiredTarget.copy(controls.target).addScaledVector(axis,.35))
  }
  if (active.environment.glints) active.environment.glints.value=canvas.height*.8
  if (optics) {
    const distance=-nearestEye().applyMatrix4(camera.matrixWorldInverse).z
    optics.render(renderer,scene,camera,Math.max(.1,distance),view==='portrait'?.98:.63,sceneTime)
  } else renderer.render(scene,camera)
}

const cameraKeys = {
  ArrowLeft: () => controls.rotateLeft(.16),
  ArrowRight: () => controls.rotateLeft(-.16),
  ArrowUp: () => controls.rotateUp(.12),
  ArrowDown: () => controls.rotateUp(-.12),
  '+': () => controls.dollyIn(.86),
  '=': () => controls.dollyIn(.86),
  '-': () => controls.dollyOut(.86),
}
canvas.addEventListener('keydown', event => {
  if (!active || !Object.hasOwn(cameraKeys, event.key)) return
  event.preventDefault()
  manualView()
  cameraKeys[event.key]()
})
byId('retry-model').addEventListener('click', () => {
  if (selected) select(selected)
})
byId('reset').addEventListener('click', resetView)
canvas.addEventListener('dblclick', resetView)
pauseButton.addEventListener('click', () => {
  if (!active) return
  paused = !paused
  updateLabels()
})
observeButton.addEventListener('click',observation)
byId('whole').addEventListener('click',()=>setView('whole'))
byId('portrait').addEventListener('click',()=>setView('portrait'))
spreadButton.addEventListener('click', () => {
  if (!active) return
  intro=false; transition=null; paused=false
  if (currentMotion!=='Spread') spreadReturn={position:camera.position.clone(),target:controls.target.clone()}
  startMotion('Spread')
  const center=active.resting.getCenter(new T.Vector3())
  const direction=camera.position.clone().sub(controls.target).normalize()
  moveCamera({target:center, position:center.clone().addScaledVector(direction,fitDistance(active.spread))},.33)
})
byId('download').addEventListener('click', async () => {
  const sample = selected
  try {
    const url = URL.createObjectURL(new Blob([await source.read(sample.id)], { type: 'model/gltf-binary' }))
    const link = document.createElement('a')
    link.href = url
    link.download = sample.id + '.glb'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch (error) {
    status('无法读取模型文件。请重新打开离线预览页。')
    console.error(error)
  }
})

if (inspecting) {
  home.hidden = true
  viewer.hidden = false
  document.querySelector('.view-tools').hidden=true
  window.__owlInspection = {
    async pose(id, options={}) {
      const sample=specimenFor(id,true)
      if(!sample)throw Error('Unknown species '+id)
      if(active?.sample.id!==id) await select(sample)
      if(!active || active.sample.id!==id) throw Error('Model failed to load '+id)
      const clip=options.clip || 'Observe'
      startMotion(clip)
      const action=active.actions[clip]
      action.time=Math.min(action.getClip().duration, options.time ?? (clip==='Observe' ? motionFor(id).heroTime : 0))
      active.mixer.update(0);active.root.updateMatrixWorld(true)
      paused=true;intro=false;transition=null;view=options.view || 'whole'
      resize();applyPose(shot(view,1));updateLabels()
      sceneTime=0;frame(performance.now())
      return {id,clip,time:action.time,cache:readyModels.size,resources:{...renderer.info.memory}}
    },
  }
}
if (!inspecting && entrySpecies) displaySpecies(entrySpecies.id)
