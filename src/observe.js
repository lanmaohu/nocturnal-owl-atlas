// Model-space movements. +Y is up and +Z is the bill direction.
import { smooth } from './feathers.js'
import { motionFor } from './behavior.js'
export { motionFor }

const beat = (time, arrive, hold, release, end) =>
  smooth(arrive, hold, time) * (1 - smooth(release, end, time))

export function createPerformance(root, speciesId) {
  const joint = name => root.getObjectByName(name)
  const body = joint('Body'), head = joint('Head'), tail = joint('Tail')
  const wings = [joint('Wing_R'), joint('Wing_L')]
  const shoulders = [joint('Shoulder_R'), joint('Shoulder_L')]
  const ears = [joint('Tuft_R'), joint('Tuft_L')]
  const ruff = [joint('Ruff_R'), joint('Ruff_L')]
  const sides = [-1, 1]
  const {kind, duration, heroTime, pace} = motionFor(speciesId)
  const snow = speciesId === 'Bubo_scandiacus'
  const joints = [body, head, tail, ...wings, ...shoulders, ...ears, ...ruff].filter(Boolean)
  const rest = joints.map(node => ({
    node, position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone()
  }))

  function reset() {
    for (const {node, position, rotation, scale} of rest) {
      node.position.copy(position)
      node.quaternion.copy(rotation)
      node.scale.copy(scale)
    }
  }

  function openShoulder(index, lift, sweep) {
    const shoulder = shoulders[index]
    if (!shoulder) return
    const side = sides[index]
    shoulder.rotation.z += side * lift
    shoulder.rotation.x -= sweep
    shoulder.position.x += side * lift * .026
    shoulder.position.y += lift * .040
  }

  function listening(t) {
    const cue = beat(t, .34, .89, 1.49, 2.44)
    const turn = beat(t, .95, 2.21, 3.85, 5.69)
    const settle = beat(t, 1.54, 2.47, 3.81, 5.51)
    head.rotation.z += .32 * cue + .105 * turn
    head.rotation.x += .095 * cue - .051 * settle
    head.rotation.y += .18 * cue + .86 * turn
    head.position.x += .044 * cue + .028 * settle
    head.position.z += .034 * turn
    body.rotation.y += .085 * settle
    body.rotation.x += .060 * cue
    body.position.x += .018 * settle
    for (let i = 0; i < 2; i++) {
      if (ruff[i]) ruff[i].rotation.z += sides[i] * (.038 * cue + .043 * settle)
      openShoulder(i, (.032 + .016 * i) * turn, .045 * cue)
    }
    if (tail) tail.rotation.x -= .053 * cue
  }

  function wind(t) {
    const brace = beat(t, .25, 1.14, 2.81, 4.96)
    const gust = beat(t, .80, 1.73, 2.11, 3.27)
    const scan = beat(t, .91, 2.02, 3.17, 4.96)
    body.position.y -= .090 * brace
    body.position.z += .060 * brace
    body.rotation.x += .088 * brace
    body.rotation.z -= .039 * gust
    head.rotation.x -= .105 * brace
    head.rotation.y += .284 * scan
    head.rotation.z += .046 * gust
    head.position.y -= .038 * brace
    for (let i = 0; i < 2; i++) {
      const age = t - i * .19
      const crest = beat(age, .88, 1.69, 2.11, 3.40)
      const flutter = Math.sin((age - 1.36) * 13.4) * beat(age, 1.27, 1.80, 2.35, 3.48)
      openShoulder(i, .25 * crest + .046 * flutter, .16 * crest)
      wings[i].rotation.z += sides[i] * (.073 * crest + .012 * flutter)
    }
    if (tail) {
      tail.rotation.x += .10 * brace
      tail.rotation.y -= .06 * gust
    }
  }

  function fixGaze(t) {
    const intent = beat(t, .73, 1.26, 1.58, 2.40)
    const turn = beat(t, 1.30, 1.76, 3.75, 5.48)
    const rebound = beat(t, 1.58, 1.78, 1.79, 2.13)
    const lock = beat(t, 1.53, 2.05, 3.70, 5.30)
    head.rotation.y += 1.12 * turn + .069 * rebound
    head.rotation.x += .093 * intent + .045 * lock
    head.rotation.z -= .045 * rebound + .034 * lock
    head.position.z += .036 * lock
    body.position.y -= .029 * intent + .024 * lock
    body.rotation.y += .051 * lock
    for (let i = 0; i < 2; i++) {
      openShoulder(i, .068 * lock, .037 * intent)
      if (!ears[i]) continue
      const age = t - i * .045
      const trail = beat(age, 1.34, 1.71, 1.80, 2.17)
      const upright = beat(age, 1.79, 2.14, 3.83, 5.18)
      const tremor = beat(age, 1.79, 1.96, 2.04, 2.35) * Math.sin((age - 1.81) * 20)
      ears[i].rotation.x -= .22 * trail - .055 * upright
      ears[i].rotation.z += sides[i] * (-.14 * upright + .058 * tremor)
      ears[i].rotation.y -= .20 * trail
    }
    if (tail) tail.rotation.x -= .037 * intent
  }

  function horizon(t) {
    const rise = beat(t,.22,.92,3.85,5.5), turn = beat(t,.75,2.04,3.1,4.65)
    const sweep = beat(t,2.92,3.78,4.16,5.72)
    head.rotation.y += .84*turn-.44*sweep
    head.rotation.x -= .11*rise
    head.position.y += .032*rise
    body.rotation.y += .069*turn-.032*sweep
    if (tail) {tail.rotation.x -= .079*rise;tail.rotation.y -= .074*turn}
  }

  function below(t) {
    const lean = beat(t,.29,1.35,2.93,4.90), fix = beat(t,1.02,1.92,3.22,4.65)
    const glance = beat(t,1.55,2.19,2.68,3.53)
    body.rotation.x += .105*lean
    head.rotation.x += .30*lean+.063*glance
    head.rotation.y += .52*fix
    head.position.z += .074*lean
    if (tail) tail.rotation.x -= .099*lean
    for(let i=0;i<2;i++) openShoulder(i,.061*lean,.033*fix)
  }

  function groundWatch(t) {
    const bob=beat(t,.31,.72,.87,1.23), rise=beat(t,1.17,1.85,3.07,4.93)
    const turn=beat(t,1.52,2.15,2.83,4.57)
    body.position.y -= .046*bob
    head.position.y += .033*rise-.028*bob
    head.position.z += .051*bob+.035*turn
    head.rotation.x += .118*bob-.072*rise
    head.rotation.y += .74*turn
    head.rotation.z -= .081*turn
    if (tail) tail.rotation.x += .066*bob-.041*rise
  }

  function peer(t) {
    const lean=beat(t,.36,1.52,2.74,4.71), counter=beat(t,2.68,3.33,3.66,4.94)
    body.rotation.z += .052*lean
    head.position.x -= .067*lean
    head.position.z += .051*lean
    head.rotation.z += .188*lean-.075*counter
    head.rotation.y += .60*lean-.16*counter
    head.rotation.x += .07*counter
    if (tail) tail.rotation.y -= .057*lean
    for(let i=0;i<2;i++) if(ruff[i]) ruff[i].rotation.z += sides[i]*.040*lean
  }

  function lookUp(t) {
    const lift=beat(t,.32,1.60,3.08,4.98), scan=beat(t,.99,2.15,2.80,4.57)
    head.rotation.x -= .20*lift
    head.rotation.y += .62*scan
    head.rotation.z += .068*scan
    body.rotation.x -= .037*lift
    for(let i=0;i<2;i++) {
      if(ears[i]) {ears[i].rotation.x -= .094*lift; ears[i].rotation.z += sides[i]*.052*scan}
      openShoulder(i,.033*lift,.022*scan)
    }
  }

  const observation = {listen:listening,wind,gaze:fixGaze,horizon,below,ground:groundWatch,peer,canopy:lookUp}[kind]

  function apply(t, clip, spread) {
    if (clip === 'Observe') {
      observation(t*pace)
      return
    }
    if (clip === 'Spread') {
      const load = beat(t, .07, .43, .54, 1.08)
      const recover = beat(t, 3.18, 3.88, 4, 4.45)
      body.position.y -= (snow ? .072 : .053) * load + .036 * recover
      body.rotation.x += .089 * load + .038 * spread - .045 * recover
      head.rotation.x -= .10 * load + .046 * spread
      for (let i = 0; i < 2; i++) openShoulder(i, .14 * spread + .07 * load, .08 * spread)
    }
  }

  return { duration, heroTime, reset, apply }
}
