import * as T from '../vendor/three.module.js'

export function makeOptics(floatBuffer) {
  const target=new T.WebGLRenderTarget(1,1,{
    type:floatBuffer?T.HalfFloatType:T.UnsignedByteType,depthTexture:new T.DepthTexture(1,1,T.UnsignedIntType),
    depthBuffer:true, stencilBuffer:false,
  })
  const scene=new T.Scene()
  const camera=new T.Camera()
  const material=new T.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{
      colorImage:{value:target.texture},depthImage:{value:target.depthTexture},
      viewport:{value:new T.Vector2(1,1)},lens:{value:new T.Vector3(.1,55,4)},
      aperture:{value:1}, time:{value:0},
    },
    vertexShader:`
      varying vec2 U;
      void main(){U=uv; gl_Position=vec4(position.xy,0.,1.);}
    `,
    fragmentShader:`
      uniform sampler2D colorImage,depthImage;
      uniform vec2 viewport;
      uniform vec3 lens;
      uniform float aperture,time;
      varying vec2 U;
      float viewDepth(vec2 u){
        float d=texture2D(depthImage,u).r;
        return lens.x*lens.y/(lens.y-d*(lens.y-lens.x));
      }
      float coc(float z){
        float r=(z-lens.z)*lens.z/(max(z,.1)*4.3);
        return clamp(abs(r)*11.1*aperture,0.,17.) * (r<0. ? .47 : 1.);
      }
      void main(){
        float z=viewDepth(U);
        float blur=coc(z);
        vec3 color=texture2D(colorImage,U).rgb;
        vec3 light=color;
        float weight=1.;
        vec2 pixel=1./viewport;
        if(blur>.54){
          for(int i=0;i<15;i++){
            float k=float(i)+.5;
            float a=k*2.399963;
            vec2 ray=vec2(cos(a),sin(a))*sqrt(k/15.);
            vec2 uv=U+ray * pixel * blur;
            float sampleZ=viewDepth(uv);
            float participation=smoothstep(-.40,-.05,sampleZ-z)*smoothstep(.09,.75,coc(sampleZ));
            light+=texture2D(colorImage,uv).rgb*participation;
            weight+=participation;
          }
        }
        color=light/weight;
        vec2 corners=abs(U-.5)*vec2(1.10,.84);
        color *= 1.-.35*smoothstep(.24,.76,length(corners));
        color = mix(color,color*vec3(.98,1.035,.98),.36);
        float grain=fract(sin(dot(gl_FragCoord.xy+floor(time*4.),vec2(12.9898,78.233)))*43758.5453)-.5;
        color+=grain*.0019;
        gl_FragColor=vec4(max(vec3(0.),color),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh=new T.Mesh(new T.PlaneGeometry(2,2),material)
  mesh.frustumCulled=false
  scene.add(mesh)
  return {
    target,
    resize(w,h){
      target.setSize(w,h)
      material.uniforms.viewport.value.set(w,h)
    },
    render(renderer, world, view, depth, aperture, time) {
      const original=renderer.toneMapping
      renderer.toneMapping=T.NoToneMapping
      renderer.setRenderTarget(target)
      renderer.render(world,view)
      renderer.toneMapping=original
      renderer.setRenderTarget(null)
      material.uniforms.lens.value.set(view.near,view.far,depth)
      material.uniforms.aperture.value=aperture
      material.uniforms.time.value=time
      renderer.render(scene,camera)
    },
  }
}
