import {Vector3, MathUtils} from '../vendor/three.module.js'

// Each point is calibrated in the original model's coordinates. +Z faces forward.
const points = {
  Bubo_scandiacus: [
    {id:'face', label:'面盘', center:[0,1.75,.77], yaw:8, pitch:.07, size:[1.22,.88],
      note:'圆形面盘拢住亮黄色虹膜，黑喙大半藏在白色面羽中。'},
    {id:'wing', label:'翼斑', center:[.55,1.00,-.35], yaw:111, pitch:.24, size:[1.38,1.23],
      note:'画中个体的折翼近白，只散着少量深色小斑。'},
    {id:'feet', label:'足爪', center:[.34,.095,.42], yaw:12, pitch:.23, size:[1.24,.59],
      note:'腿和脚趾都有厚羽，黑色弯爪从羽尖之间露出来。'},
  ],
  Tyto_alba: [
    {id:'face', label:'心形面盘', center:[0,2.10,.57], yaw:6, pitch:.07, size:[1.15,1.10],
      note:'浅色面盘呈心形，深色双眼从细窄的喙两侧望出来。'},
    {id:'wing', label:'翼背', center:[.42,1.15,-.46], yaw:122, pitch:.26, size:[1.45,1.60],
      note:'金褐与灰色交杂，浅色斑点散在折翼的覆羽上。'},
    {id:'belly', label:'腹面', center:[0,1.11,.54], yaw:9, pitch:.05, size:[1.1,1.08],
      note:'浅白胸腹延伸到体侧，与金褐色翼背形成分界。'},
  ],
  Bubo_bubo: [
    {id:'tufts', label:'耳羽', center:[0,2.33,.31], yaw:10, pitch:.16, size:[1.79,.75],
      note:'左右两束耳羽向斜上方伸展，可以沿外缘看清它们的轮廓。'},
    {id:'iris', label:'虹膜', center:[0,2.08,.78], yaw:10, pitch:.03, size:[.90,.61],
      note:'橙色虹膜位于浓密的眉羽下，近看能看到瞳孔周围的颜色。'},
    {id:'breast', label:'胸纹', center:[0,1.32,.78], yaw:13, pitch:.06, size:[1.2,1.06],
      note:'胸部的深褐纵纹向下延伸，腹部逐渐带上细密横纹。'},
  ],
}

export const observationPoints = id => points[id] || []

export function pointPose(point, camera) {
  const target = new Vector3(...point.center)
  const yaw = MathUtils.degToRad(point.yaw)
  const direction = new Vector3(Math.sin(yaw),point.pitch,Math.cos(yaw)).normalize()
  const tangent = Math.tan(MathUtils.degToRad(camera.fov/2))
  const [width,height] = point.size
  const distance = Math.max(height,width/camera.aspect) / (2*tangent) * 1.15
  return {target,position:target.clone().addScaledVector(direction,distance)}
}
