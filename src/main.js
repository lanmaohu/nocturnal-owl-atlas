import * as T from '../vendor/three.module.js'
import { OrbitControls } from '../vendor/OrbitControls.js'
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js'
import { habitat } from './habitats.js'
import { makeOptics } from './optics.js'
import { samples } from './samples.js'
import { createCatalog } from './catalog.js'
import { availableIds, catalogSequence, specimenFor, publishedModel, illustrationSource } from './specimens.js'
import { motionFor } from './behavior.js'
import { createModelSource } from './model-source.js'
import { observationPoints, pointPose } from './observation-points.js'
import { downloadBlob, saveObservationCard } from './observation-card.js'

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
const stationButton = byId('station-open')
const galleryButton = byId('catalog-open')
const featured = byId('featured-species')
const modelPoints = byId('model-points')
const illustration = byId('species-illustration')
const illustrationFrame = byId('illustration-frame')
const originalIllustration = byId('illustration-original')
const pointButtons = byId('point-buttons')
const pointNote = byId('point-note')
const focusMarker = byId('focus-marker')
const saveCardButton = byId('save-card')
const presetButtons = [...document.querySelectorAll('[data-view]')]
const neutralButton = byId('neutral-light')
const modelControls = [...presetButtons, neutralButton, pauseButton, spreadButton, observeButton, byId('whole'), byId('portrait'), byId('reset'), saveCardButton]
const loader = new GLTFLoader()
const source = createModelSource(publishedModel)
const readyModels = new Map()
const params = new URLSearchParams(location.search)
const inspecting = params.get('inspection') === '1'
let parsing = Promise.resolve()
const snowOwl = 'Bubo_scandiacus'
const entrySpecies = specimenFor(params.get('species'))
const isFeatured = id => samples.some(sample => sample.id === id)
const galleryFeatures = [...samples.map(sample => sample.id), 'Strix_nebulosa', 'Athene_cunicularia', 'Surnia_ulula', 'Scotopelia_peli', 'Phodilus_badius']
const showFacts = createCatalog(availableIds, [...galleryFeatures, ...catalogSequence], id => versionedAsset(publishedModel(id)?.portrait,id), openSpecies)
let selected
let selectedPoint = null
let lastCard
let selectionToken = 0
let renderer, scene, camera, controls, optics, active, neutralScene
let neutral = false
let paused = false
let currentMotion = 'Perch', view = 'whole'
let intro = false, transition = null, spreadReturn = null
let previousTime = 0, sceneTime = 0, studioVisible = true
const eye = new T.Vector3(), otherEye = new T.Vector3()
const axis = new T.Vector3(), desiredTarget = new T.Vector3(), desiredPosition = new T.Vector3()
const compact = matchMedia('(max-width: 800px)')
function placeSpecimenPanels() {
  const layout = compact.matches ? 'mobile' : 'desktop'
  byId(layout + '-points').append(modelPoints)
  byId(layout + '-identity').append(byId('model-identity'))
}
compact.addEventListener('change',placeSpecimenPanels)
placeSpecimenPanels()
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
history.scrollRestoration = 'manual'

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
  stationButton.setAttribute('aria-current','page')
  galleryButton.removeAttribute('aria-current')
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
  if (active) {
    active.mixer.stopAllAction()
    active.environment.scene.add(active.root)
  }
  active = null
  scene = null
  selected = null
  viewer.hidden = true
  home.hidden = false
  stationButton.removeAttribute('aria-current')
  galleryButton.setAttribute('aria-current','page')
  if (!restore) return
  requestAnimationFrame(() => {
    if (home.hidden) return
    if (lastCard?.isConnected) {
      lastCard.focus({preventScroll:true})
      lastCard.scrollIntoView({block:'center'})
    } else showSection(gallery)
  })
}

function returnToGallery() {
  if (!home.hidden) {
    showSection(gallery)
    return
  }
  if (history.state?.fromGallery) {
    history.back()
    return
  }
  const url = new URL(location.href)
  url.searchParams.delete('species')
  url.hash = 'gallery'
  history.pushState(null, '', url)
  displayGallery()
}

function openStation() {
  const url = new URL(location.href)
  url.searchParams.delete('species')
  url.hash = ''
  if (viewer.hidden) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  displaySpecies(snowOwl, false)
  window.scrollTo(0,0)
  stationButton.focus({preventScroll:true})
}

galleryButton.addEventListener('click', returnToGallery)
stationButton.addEventListener('click', openStation)
byId('field-browse').addEventListener('click', returnToGallery)
featured.addEventListener('click', event => {
  const button = event.target.closest('[data-featured]')
  if (button) openSpecies(button.dataset.featured, null, true)
})
byId('habitat-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-id]')
  if (button) openSpecies(button.dataset.id, button, true)
})
for (const link of viewer.querySelectorAll('a[href="#field-record"], a[href="#model-spread"]')) {
  link.addEventListener('click', event => {
    event.preventDefault()
    showSection(document.querySelector(link.hash))
  })
}
window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('species')
  if (location.hash === '#gallery' && !specimenFor(id)) displayGallery()
  else displaySpecies(specimenFor(id)?.id || snowOwl)
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
function showIllustration(sample) {
  const sourceUrl = illustrationSource(sample.id)
  illustration.hidden = !sourceUrl || inspecting
  if (illustration.hidden) return
  originalIllustration.href = sourceUrl
  const image = new Image()
  image.alt = sample.name + '的花叔插画'
  image.loading = 'lazy'
  image.decoding = 'async'
  image.addEventListener('error', () => {
    if (image.parentElement === illustrationFrame) {
      const message = document.createElement('p')
      message.textContent = '本地插画未能打开，可查看原图。'
      image.replaceWith(message)
    }
  }, {once:true})
  illustrationFrame.replaceChildren(image)
  image.src = './花叔插画/' + sample.id + '.webp'
}

function showRecord(sample) {
  showPageLinks(sample)
  showIllustration(sample)
  for (const button of featured.children) {
    button.setAttribute('aria-pressed', String(button.dataset.featured === sample.id))
  }
  const points = observationPoints(sample.id)
  modelPoints.hidden = !points.length
  pointButtons.replaceChildren(...points.map(point => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.point = point.id
    button.textContent = point.label
    button.disabled = true
    button.setAttribute('aria-pressed','false')
    return button
  }))
  showPoint(null)
  byId('name').textContent = sample.name
  byId('family').textContent = sample.family + ' · ' + sample.familyLatin
  byId('latin').textContent = sample.id.replace('_', ' ')
  byId('form').textContent = sample.form
  const calibration = sample.calibration
  byId('identification-cue').textContent = calibration.cue
  byId('form-variation').textContent = calibration.variation
  byId('form-variation').hidden = !calibration.variation
  const topics = ['全身轮廓','脸和眼睛','羽毛形状','羽色与花纹','整只与动作']
  byId('round-review').hidden = !calibration.rounds.length
  byId('round-notes').replaceChildren(...calibration.rounds.map((note,index) => {
    const item=document.createElement('li')
    const label=document.createElement('strong')
    label.textContent=topics[index]+'　'
    item.append(label,note)
    return item
  }))
  byId('alignment-evidence').textContent = calibration.cautions
  byId('alignment-contact').href = versionedAsset('./校准证据/'+sample.id+'.jpg',sample.id)
  const actionsLink=byId('alignment-actions')
  actionsLink.hidden=!calibration.rounds.length
  if (!actionsLink.hidden) actionsLink.href=versionedAsset('./校准证据/动作/'+sample.id+'.jpg',sample.id)
  const reference = byId('alignment-reference')
  reference.hidden = !calibration.photo.url
  if (calibration.photo.url) {
    reference.href = calibration.photo.url
    reference.textContent = calibration.photo.label
  }
  byId('model-notes').open = false
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
  const poster = versionedAsset(publishedModel(sample.id)?.portrait,sample.id)
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
    const environment = habitat(sample.id,renderer,!inspecting && isFeatured(sample.id))
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
        if (wasSpread && spreadReturn) {
          view = spreadReturn.mode
          showPoint(spreadReturn.point)
          moveCamera(spreadReturn, .55)
          updateLabels()
        }
        spreadReturn = null
      })
    })
    readyModels.set(sample.id,entry)
    return entry
}

function showPoint(point) {
  selectedPoint = point
  for (const button of pointButtons.children) {
    button.setAttribute('aria-pressed', String(button.dataset.point === point?.id))
  }
  pointNote.textContent = point?.note || '选择一个部位查看细节。'
  focusMarker.hidden = true
}

function focusPoint(point) {
  if (!active || !point) return
  intro = false
  spreadReturn = null
  startMotion('Perch')
  view = 'point'
  showPoint(point)
  moveCamera(pointPose(point,camera))
  updateLabels()
  if (compact.matches && viewport.getBoundingClientRect().top < document.querySelector('.masthead').offsetHeight) {
    viewport.scrollIntoView({block:'start'})
  }
}

pointButtons.addEventListener('click', event => {
  const button = event.target.closest('[data-point]')
  if (button && active) focusPoint(observationPoints(active.sample.id).find(point => point.id === button.dataset.point))
})

function manualView() {
  intro = false; transition = null; spreadReturn = null
  showPoint(null)
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
  neutralScene = new T.Scene()
  neutralScene.background = new T.Color(0x364153)
  const key = new T.DirectionalLight(0xffffff,2.10)
  const rim = new T.DirectionalLight(0xffffff,1.03)
  key.position.set(2,5,4)
  rim.position.set(-2,2,-4)
  neutralScene.add(new T.HemisphereLight(0xffffff,0xe5e5e5,1.52),key,rim)
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

const viewAngles = {front:[0,3],side:[90,3],back:[180,3]}

function versionedAsset(path,id) {
  const entry=publishedModel(id)
  if (!path || !entry || location.protocol==='file:') return path
  return path+'?rev='+entry.sha256.slice(0,12)
}

function shot(viewName, fraction=0) {
  const { shot } = active.sample
  const box = active.resting, size = box.getSize(new T.Vector3()), target = box.getCenter(new T.Vector3())
  const portrait = viewName === 'portrait'
  const preset = viewName==='matched' ? active.sample.calibration.angles : viewAngles[viewName]
  const yaw = T.MathUtils.degToRad(preset?.[0] ?? (portrait ? shot.portrait : T.MathUtils.lerp(shot.start, shot.settle, fraction)))
  const pitch = preset ? T.MathUtils.degToRad(preset[1]) : portrait ? .07 : T.MathUtils.lerp(shot.elevation, shot.elevation+.015, fraction)
  axis.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch))
  let distance = fitDistance(currentMotion === 'Spread' ? active.spread : box)
  if (portrait) {
    active.head.getWorldPosition(target)
    target.lerp(nearestEye(), .27)
    distance = size.y * Math.max(1.03,1.17/camera.aspect)
  } else {
    distance *= T.MathUtils.lerp(1.12,1.02,fraction)
    target.y += size.y*T.MathUtils.lerp(.015,.025,fraction)
    const side = preset ? 0 : size.y*shot.offset*Math.min(camera.aspect,1.5)
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

function lighting(value) {
  neutral=value
  scene=neutral?neutralScene:active.environment.scene
  scene.add(active.root)
  renderer.toneMappingExposure=neutral?1:active.sample.shot.exposure
  neutralButton.setAttribute('aria-pressed',String(neutral))
  byId('paired-views').classList.toggle('neutral-light',neutral)
}

function setView(mode, immediate=false) {
  if (!active) return
  intro=false; spreadReturn=null; view=mode
  showPoint(null)
  if(mode==='matched') {
    if(currentMotion!=='Perch')startMotion('Perch')
    lighting(true)
  }
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
  if (!active || intro) return
  if (currentMotion === 'Spread' && spreadReturn) moveCamera(spreadPose(),0)
  else if (selectedPoint) moveCamera(pointPose(selectedPoint,camera),0)
  else if (view !== 'manual') moveCamera(shot(view,1),0)
}

function updateLabels() {
  pauseButton.querySelector('span').textContent = paused ? '继续' : '暂停'
  pauseButton.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause')
  pauseButton.setAttribute('aria-label', paused ? '继续播放动画' : '暂停当前动画')
  spreadButton.setAttribute('aria-pressed', String(currentMotion === 'Spread'))
  spreadButton.querySelector('span').textContent = currentMotion === 'Spread' ? '正在展翅' : '展翅'
  observeButton.setAttribute('aria-pressed', String(currentMotion === 'Observe'))
  byId('whole').setAttribute('aria-pressed',String(view==='whole'))
  byId('portrait').setAttribute('aria-pressed',String(view==='portrait'))
  for (const button of presetButtons) button.setAttribute('aria-pressed',String(view===button.dataset.view))
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
  showPoint(null)
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
  if (active) {
    active.mixer.stopAllAction()
    active.environment.scene.add(active.root)
  }
  active=null; scene=null; transition=null; intro=false; spreadReturn=null
  delete viewport.dataset.ready
  byId('model-spread').hidden = !sample
  byId('file-actions').hidden=!source.isFile || folderConnected || isFeatured(id)
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
  for (const button of modelControls) button.disabled=true
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
  status('正在加载'+sample.name+'…')
  try {
    const task=parsing.then(()=>version===selectionToken ? modelFor(sample) : null)
    parsing=task.catch(()=>{})
    const model=await task
    if (version!==selectionToken || !model) return
    active=model; scene=model.environment.scene
    lighting(false)
    const h=model.resting.getSize(new T.Vector3()).y
    controls.minDistance=h*.33;controls.maxDistance=h*5.8
    for (const button of [...modelControls, ...pointButtons.children]) button.disabled=false
    paused = reducedMotion
    startMotion('Perch')
    setView(inspecting?'whole':'matched',true)
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
  renderModel()
  if (selectedPoint && !transition) {
    const position = new T.Vector3(...selectedPoint.center).project(camera)
    focusMarker.style.left = (position.x+1)*50+'%'
    focusMarker.style.top = (1-position.y)*50+'%'
    focusMarker.hidden = false
  } else focusMarker.hidden = true
}

function renderModel() {
  camera.updateMatrixWorld()
  if (!neutral && active.environment.plantPlane) {
    camera.getWorldDirection(axis)
    active.environment.plantPlane.setFromNormalAndCoplanarPoint(axis,desiredTarget.copy(controls.target).addScaledVector(axis,.35))
  }
  if (active.environment.glints) active.environment.glints.value=canvas.height*.8
  if (optics && !neutral) {
    const focalPoint = selectedPoint ? new T.Vector3(...selectedPoint.center) : nearestEye()
    const distance = -focalPoint.applyMatrix4(camera.matrixWorldInverse).z
    const aperture = selectedPoint ? .22 : view === 'portrait' ? .98 : .63
    optics.render(renderer,scene,camera,Math.max(.1,distance),aperture,sceneTime)
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
for (const button of presetButtons) button.addEventListener('click',()=>setView(button.dataset.view))
neutralButton.addEventListener('click',()=>{if(active)lighting(!neutral)})
function spreadPose() {
  const target = active.spread.getCenter(new T.Vector3())
  const direction = (spreadReturn?.position || camera.position).clone().sub(spreadReturn?.target || controls.target).normalize()
  const distance = fitDistance(active.spread)
  return {target,position:target.clone().addScaledVector(direction,distance)}
}

spreadButton.addEventListener('click', () => {
  if (!active || currentMotion === 'Spread') return
  spreadReturn = {
    position:(transition?.to.position || camera.position).clone(),
    target:(transition?.to.target || controls.target).clone(),
    mode:view, point:selectedPoint,
  }
  intro=false; transition=null; paused=false
  showPoint(null)
  view = 'spread'
  startMotion('Spread')
  moveCamera(spreadPose(),.33)
})

saveCardButton.addEventListener('click', async () => {
  if (!active) return
  const sample = active.sample
  try {
    renderModel()
    await saveObservationCard(canvas,sample)
  } catch (error) {
    if (selected === sample) status('无法保存观察卡，请重试。')
    console.error(error)
  }
})

byId('download').addEventListener('click', async () => {
  const sample = selected
  if (!sample) return
  try {
    downloadBlob(new Blob([await source.read(sample.id)], {type:'model/gltf-binary'}),sample.id+'.glb')
  } catch (error) {
    if (selected === sample) status('无法读取模型文件。请重新打开离线预览页。')
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
if (!inspecting) {
  if (location.hash === '#gallery' && !entrySpecies) displayGallery(false)
  else displaySpecies(entrySpecies?.id || snowOwl,false)
}
