import { v } from './feathers.js'
export function perchAt(x) {return v(x,-.043+x*.089+.010*x*x,x*.16+.013*x*x)}
export function perchRadius(x) {return .103+x*.007+.007*Math.sin(x*2.1)}
