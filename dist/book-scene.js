import * as THREE from './assets/three.module.js';

export async function createBookScene(canvas, reducedMotion) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-3.8,3.8,4.1,-4.1,.1,50);
  camera.position.set(0,0,12);camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xfff6d9,2.1));
  const key=new THREE.DirectionalLight(0xfff3ce,3.3);key.position.set(-4,5,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.025;key.shadow.bias=-.0002;key.shadow.radius=4;scene.add(key);
  const fill=new THREE.DirectionalLight(0xc8eadb,1.6);fill.position.set(4,-1,4);scene.add(fill);
  const root=new THREE.Group();root.position.set(.25,.25,0);scene.add(root);
  const book=new THREE.Group();book.rotation.set(-.21,-.32,-.12);root.add(book);
  const coverTexture=await new THREE.TextureLoader().loadAsync('/assets/cover.svg');coverTexture.colorSpace=THREE.SRGBColorSpace;coverTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const paperCanvas=document.createElement('canvas');paperCanvas.width=256;paperCanvas.height=512;const paperContext=paperCanvas.getContext('2d');paperContext.fillStyle='#e3d4ad';paperContext.fillRect(0,0,256,512);
  for(let i=0;i<512;i+=3){paperContext.fillStyle=i%2?'#d0bd94':'#f2e4bd';paperContext.fillRect(0,i,256,1);}
  const paperTexture=new THREE.CanvasTexture(paperCanvas);paperTexture.colorSpace=THREE.SRGBColorSpace;
  const green=new THREE.MeshStandardMaterial({color:0x123b2a,roughness:.66,metalness:.1});
  const gold=new THREE.MeshStandardMaterial({color:0xb9a26a,roughness:.6,metalness:.3});
  const paperEdge=new THREE.MeshStandardMaterial({map:paperTexture,roughness:.9});
  const paper=new THREE.MeshStandardMaterial({color:0xf1e6cf,roughness:1});
  const front=new THREE.MeshStandardMaterial({map:coverTexture,roughness:.59,metalness:.17});
  const body=new THREE.Mesh(new THREE.BoxGeometry(3.17,4.75,.3),[paperEdge,gold,paperEdge,paperEdge,paper,paper]);body.castShadow=true;body.receiveShadow=true;book.add(body);
  const backCover=new THREE.Mesh(new THREE.BoxGeometry(3.35,5.04,.085),green);backCover.position.z=-.22;backCover.castShadow=true;book.add(backCover);
  const spine=new THREE.Mesh(new THREE.BoxGeometry(.12,5.02,.42),green);spine.position.set(1.64,0,-.04);spine.castShadow=true;book.add(spine);
  for(const y of [-1.8,-1.65,1.65,1.8]){const band=new THREE.Mesh(new THREE.BoxGeometry(.126,.027,.43),gold);band.position.set(1.64,y,-.04);book.add(band);}
  const hinge=new THREE.Group();hinge.position.set(1.675,0,.205);book.add(hinge);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(3.35,5.04,.075),[green,green,gold,gold,front,green]);lid.position.x=-1.675;lid.castShadow=true;lid.receiveShadow=true;hinge.add(lid);
  const woodTexture=woodGrain();
  const wood=new THREE.MeshStandardMaterial({map:woodTexture,color:0x99734b,roughness:.76,metalness:0});
  // Keep the stand behind the entire tilted book, including its far top corner.
  // A small z offset is not enough once the cover rotates around both axes.
  const stand=new THREE.Group();stand.position.set(.08,-1.15,-2);stand.rotation.set(.06,.06,0);stand.scale.setScalar(.92);root.add(stand);
  const shape=new THREE.Shape();shape.moveTo(-1.95,-2.2);shape.bezierCurveTo(-1.6,-2.28,-1.5,-1.85,-1.1,-1.82);shape.lineTo(.1,-.8);shape.lineTo(1.88,1.55);shape.bezierCurveTo(2.32,2.02,2.37,2.5,2.0,2.62);shape.bezierCurveTo(1.67,2.7,1.9,2.3,1.5,2.36);shape.lineTo(-1.9,-1.75);shape.bezierCurveTo(-2.18,-2.03,-2.21,-2.2,-1.95,-2.2);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.045,bevelThickness:.025});
  for(const mirrored of [false,true]){const leg=new THREE.Mesh(geometry,wood);leg.scale.set(mirrored?-1:1,1,1);leg.castShadow=true;leg.receiveShadow=true;stand.add(leg);}
  const ribbonPath=new THREE.CatmullRomCurve3([new THREE.Vector3(1.2,-2.4,-.03),new THREE.Vector3(1.55,-2.6,-.1),new THREE.Vector3(1.86,-2.95,-.05),new THREE.Vector3(1.91,-3.32,.02)]);
  const ribbon=new THREE.Mesh(new THREE.TubeGeometry(ribbonPath,30,.022,5,false),gold);book.add(ribbon);
  const tassel=new THREE.Mesh(new THREE.ConeGeometry(.075,.3,10),gold);tassel.position.set(1.91,-3.45,.02);tassel.rotation.z=.08;book.add(tassel);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.ShadowMaterial({opacity:.16}));shadow.position.z=-2.4;shadow.receiveShadow=true;scene.add(shadow);

  let opening=0, targetOpening=0, last=0, raf=0, visible=true, resolveOpen;
  const pointer=new THREE.Vector2();const targetPointer=new THREE.Vector2();
  function resize(){const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;renderer.setSize(box.width,box.height,false);const aspect=box.width/box.height;camera.left=-4.1*aspect;camera.right=4.1*aspect;camera.top=4.1;camera.bottom=-4.1;camera.updateProjectionMatrix();render();}
  function render(){renderer.render(scene,camera);}
  function tick(time){raf=0;if(!visible||document.hidden)return;const dt=Math.min((time-last)/1000,.05);last=time;
    const smoothing=1-Math.exp(-dt*8);pointer.lerp(targetPointer,smoothing);opening+=(targetOpening-opening)*(1-Math.exp(-dt*5));
    hinge.rotation.y=opening*Math.PI*.89;root.position.x=.25-opening*.85;
    book.rotation.x=-.21+pointer.y*.045;book.rotation.y=-.32+pointer.x*.1;
    if(!reducedMotion){book.position.y=Math.sin(time*.00065)*.032;tassel.rotation.z=.08+Math.sin(time*.001)*.03;}
    render();
    if(targetOpening===1&&opening>.985&&resolveOpen){resolveOpen();resolveOpen=null;}
    if(!reducedMotion||Math.abs(targetOpening-opening)>.001)raf=requestAnimationFrame(tick);
  }
  function start(){if(!raf){last=performance.now();raf=requestAnimationFrame(tick);}}
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else if(raf){cancelAnimationFrame(raf);raf=0;}});observer.observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('pointermove',event=>{if(reducedMotion)return;const rect=canvas.getBoundingClientRect();targetPointer.set((event.clientX-rect.left)/rect.width-.5,(event.clientY-rect.top)/rect.height-.5);start();});
  canvas.addEventListener('pointerleave',()=>targetPointer.set(0,0));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible)start();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();canvas.classList.remove('ready');document.querySelector('#fallback-book').classList.remove('inactive');if(raf)cancelAnimationFrame(raf);if(resolveOpen){resolveOpen();resolveOpen=null;}});
  resize();canvas.classList.add('ready');document.querySelector('#fallback-book').classList.add('inactive');document.querySelector('#fallback-book').tabIndex=-1;start();
  return {
    open(){if(reducedMotion)return Promise.resolve();targetOpening=1;start();return new Promise(resolve=>{resolveOpen=resolve;setTimeout(()=>{if(resolveOpen){resolveOpen();resolveOpen=null;}},1100);});},
    close(){targetOpening=0;opening=0;hinge.rotation.y=0;root.position.x=.25;start();}
  };
}
function woodGrain(){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=1024;const context=canvas.getContext('2d');context.fillStyle='#d2a474';context.fillRect(0,0,256,1024);let seed=29;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  for(let x=0;x<256;x+=2){context.strokeStyle=`rgba(73,34,13,${.04+random()*.16})`;context.lineWidth=.5+random()*2;context.beginPath();for(let y=0;y<=1024;y+=8){const px=x+Math.sin(y*.008+x*.07)*8+Math.sin(y*.024+x)*2;y===0?context.moveTo(px,y):context.lineTo(px,y);}context.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(.3,.4);return texture;
}
