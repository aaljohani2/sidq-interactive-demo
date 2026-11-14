/**
 * SIDQ | Studio realism layer
 * Physically based surfaces, manufactured details and contextual thermal effects.
 */
export async function createRealisticPresentation({THREE,scene,root,groups,renderer,sun,rotor,focusRing,physicalWire}){
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.48;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<780?1.4:1.85));
  scene.background=new THREE.Color(0x0b1d28);
  scene.fog=new THREE.FogExp2(0x0b1d28,.017);
  sun.castShadow=true;
  const sh=window.innerWidth<780?1024:2048;
  sun.shadow.mapSize.set(sh,sh);
  sun.shadow.camera.left=-11;sun.shadow.camera.right=11;
  sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;
  sun.shadow.camera.near=1;sun.shadow.camera.far=29;
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.014;
  sun.position.set(-5,13,8);
  try{
    const {RoomEnvironment}=await import('three/addons/environments/RoomEnvironment.js');
    const pmrem=new THREE.PMREMGenerator(renderer);
    const env=pmrem.fromScene(new RoomEnvironment(),.04);
    scene.environment=env.texture;
    scene.environmentIntensity=.82;
  }catch(e){console.warn('Studio reflections unavailable:',e);}
  const metal=(color,metalness=.7,roughness=.3,rest={})=>
    new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:.25,clearcoatRoughness:.16,...rest});
  const silver=metal(0xc2cbd0,.94,.24);
  const charcoal=metal(0x283c48,.74,.3);
  const black=metal(0x1c2429,.12,.83);
  const gold=metal(0xb99857,.82,.27);
  const clearAcrylic=new THREE.MeshPhysicalMaterial({
    color:0xaadce8,metalness:0,roughness:.075,transmission:.68,
    thickness:.35,ior:1.49,clearcoat:1,clearcoatRoughness:.03,
    transparent:true,opacity:.86,side:THREE.DoubleSide,depthWrite:false
  });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),
    new THREE.MeshStandardMaterial({color:0x11232c,metalness:.18,roughness:.7}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.87;floor.receiveShadow=true;scene.add(floor);
  const acrylic= root.children.flatMap(o=>o.children||[]).find(o=>o.isMesh&&o.geometry?.type==='BoxGeometry'&&o.geometry?.parameters?.width===10);
  if(acrylic){acrylic.material=clearAcrylic;acrylic.castShadow=false;acrylic.receiveShadow=false;}
  root.traverse(o=>{if(o.isMesh&&!o.material?.transparent){o.castShadow=true;o.receiveShadow=true;}});
  const add=(geo,mat,parent,x=0,y=0,z=0)=>{
    const obj=new THREE.Mesh(geo,mat);obj.position.set(x,y,z);
    obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
  };
  const cyl=(r1,r2,h,mat,parent,x,y,z,seg=28)=>add(new THREE.CylinderGeometry(r1,r2,h,seg),mat,parent,x,y,z);
  const box=(w,h,d,mat,parent,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);
  function screw(parent,x,y,z,r=.055){
    cyl(r,r,.034,silver,parent,x,y,z,18);
    box(r*.95,.006,.012,charcoal,parent,x,y+.019,z);
    box(.012,.006,r*.95,charcoal,parent,x,y+.019,z);
  }
  // Machined feet, washers, screw heads and raised PCB mounting posts.
  for(const x of [-4.68,4.68])for(const z of [-2.95,2.95]){
    cyl(.19,.19,.085,silver,root,x,-.43,z,24);
    screw(root,x,-.17,z,.09);
  }
  for(const g of [groups.espA,groups.espB,groups.driver,groups.watt,groups.accel,groups.buck,groups.optical]){
    if(!g)continue;
    for(const x of [-.45,.45])for(const z of [-.30,.30]){
      cyl(.053,.053,.14,metal(0x8899a4,.8,.34),g,x,-.15,z,16);
      cyl(.079,.079,.02,black,g,x,-.07,z,16);
      screw(g,x,.012,z,.035);
    }
  }
  function makeTexture(w,h,draw){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');draw(ctx,w,h);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return tex;
  }
  function labelTexture(title,detail){
    return makeTexture(768,240,(ctx,W,H)=>{
      ctx.fillStyle='#13262d';ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='#637d84';ctx.lineWidth=5;ctx.strokeRect(8,8,W-16,H-16);
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='#e0e9e6';ctx.font='700 89px Arial';ctx.fillText(title,W/2,93,W*.91);
      ctx.fillStyle='#8da9ac';ctx.font='600 47px Arial';ctx.fillText(detail,W/2,179,W*.91);
    });
  }
  function flatLabel(parent,title,detail,x,y,z,w,h){
    const plane=add(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({map:labelTexture(title,detail),side:THREE.DoubleSide}),
      parent,x,y,z);
    plane.rotation.x=-Math.PI/2;plane.castShadow=false;return plane;
  }
  const labels=[
    [groups.espA,'TELEMETRY','ESP32-A',.48,-.008,.28,.78,.19],
    [groups.espB,'WITNESS','ESP32-B',.48,-.008,.28,.78,.19],
    [groups.driver,'DRIVER','PWM / MOTOR',-.48,-.005,-.48,.74,.18],
    [groups.watt,'INA219','CURRENT',-.12,-.008,-.29,.52,.14],
    [groups.accel,'ADXL345','VIBRATION',0,-.008,-.25,.57,.15],
    [groups.buck,'DC-DC','5V RAIL',.12,-.008,-.34,.7,.14],
    [groups.optical,'RPM','OPTICAL',0,.067,-.12,.43,.12],
    [groups.servo,'SERVO','LOAD',0,.55,.06,.78,.24]
  ];
  for(const a of labels){if(a[0])flatLabel(...a);}
  flatLabel(root,'SIDQ / MIDA','INDEPENDENT WITNESS',0,-.13,-2.91,1.75,.31);
  function traces(seed){
    let k=seed;const rnd=()=>((k=(k*1664525+1013904223)>>>0)/4294967296);
    return makeTexture(1024,660,(c,w,h)=>{
      c.clearRect(0,0,w,h);
      for(let i=0;i<78;i++){
        const x=rnd()*w,y=rnd()*h,l=26+rnd()*170;
        c.strokeStyle=i%6===0?'rgba(221,191,125,.22)':'rgba(82,186,148,.27)';
        c.lineWidth=1+rnd()*2;
        c.beginPath();c.moveTo(x,y);c.lineTo(x+l*.65,y);
        c.lineTo(x+l*.8,y+(rnd()-.5)*l*.2);c.lineTo(x+l,y+(rnd()-.5)*l*.32);c.stroke();
        c.beginPath();c.arc(x,y,2.6,0,Math.PI*2);c.fillStyle='rgba(167,197,176,.35)';c.fill();
      }
      c.strokeStyle='rgba(217,230,228,.2)';c.strokeRect(12,12,w-24,h-24);
    });
  }
  for(const [g,w,d,seed] of [
    [groups.espA,2.12,1.17,31],[groups.espB,2.12,1.17,52],
    [groups.driver,2,1.34,8],[groups.watt,1.35,.87,82],
    [groups.accel,1.2,.86,112],[groups.buck,1.65,1,70],[groups.optical,.74,.45,144]
  ]){
    if(!g)continue;
    const pcb=add(new THREE.PlaneGeometry(w*.93,d*.93),
      new THREE.MeshStandardMaterial({map:traces(seed),transparent:true,opacity:.83,roughness:.7,metalness:.08,side:THREE.DoubleSide,depthWrite:false}),
      g,0,g===groups.optical?.055:-.009,0);
    pcb.rotation.x=-Math.PI/2;pcb.castShadow=false;
  }
  // Photographic component accents: metal shields, terminals and capacitor tops.
  for(const g of [groups.espA,groups.espB]){
    box(.58,.12,.52,metal(0xb5c2c8,.83,.35),g,-.05,.26,-.04);
    box(.29,.14,.24,metal(0xc2c9cc,.85,.27),g,-.94,.17,.02);
    for(let i=0;i<5;i++)box(.024,.005,.16,charcoal,g,-.23+i*.08,.33,-.06);
  }
  if(groups.driver){
    for(let i=0;i<4;i++){box(.27,.24,.36,metal(0x236869,.14,.57),groups.driver,-.7+i*.42,.20,.53);screw(groups.driver,-.7+i*.42,.336,.53,.042);}
    for(let i=0;i<8;i++)box(.05,.11,.13,charcoal,groups.driver,-.62+i*.17,.26,-.35);
  }
  if(groups.buck){
    for(let i=0;i<2;i++){
      const x=-.62+i*.33;
      cyl(.14,.14,.36,metal(0x343e50,.65,.35),groups.buck,x,.22,.32,20);
      cyl(.127,.127,.015,silver,groups.buck,x,.407,.32,20);
    }
  }
  if(groups.motor){
    for(const x of [-1.1,-.93,1.06])for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
      const nut=cyl(.046,.046,.04,silver,groups.motor,x,.73+Math.cos(a)*.68,Math.sin(a)*.68,14);
      nut.rotation.z=Math.PI/2;
    }
    for(const x of [-.78,-.52,-.28]){
      const band=cyl(.708,.708,.04,metal(0x6d7e88,.93,.24),groups.motor,x,.73,0,48);
      band.rotation.z=Math.PI/2;
    }
    const motorSticker=add(new THREE.PlaneGeometry(1.24,.29),
      new THREE.MeshBasicMaterial({map:labelTexture('12V DC','ENCODER / FIT0186'),side:THREE.DoubleSide}),
      groups.motor,-.1,1.44,.12);
    motorSticker.castShadow=false;
  }
  if(rotor){
    const hub=cyl(.20,.20,.1,metal(0x8898a5,.94,.2),rotor,.07,0,0,24);hub.rotation.z=Math.PI/2;
    const ring=cyl(.28,.28,.045,metal(0xb4bdc4,.92,.23),rotor,-.09,0,0,28);ring.rotation.z=Math.PI/2;
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      const n=cyl(.035,.035,.05,silver,rotor,.12,Math.cos(a)*.32,Math.sin(a)*.32,12);
      n.rotation.z=Math.PI/2;
    }
  }
  // Muted industrial-grade cable jackets instead of neon paths.
  const coats={
    power:metal(0xb77e55,.03,.6),logic:metal(0x3e9695,.03,.62),
    reported:metal(0x77729c,.02,.63),witness:metal(0xb08d58,.03,.61)
  };
  for(const [name,wires] of Object.entries(physicalWire))
    for(const item of wires){item.material=coats[name];item.castShadow=false;}
  // Pressed switch heads get polished edges and a gently convex cap.
  root.traverse(o=>{
    if(o.isMesh&&Number.isInteger(o.userData.buttonIndex)){
      const colors=[0xd94c47,0xe8bc57,0x448fcd,0x3dbb8c];
      const c=colors[o.userData.buttonIndex];
      o.material=metal(c,.18,.25,{clearcoat:1,clearcoatRoughness:.085});
      cyl(.27,.27,.035,silver,o,0,-.07,0,30);
      add(new THREE.SphereGeometry(.245,30,14,0,Math.PI*2,0,Math.PI/2),
        metal(c,.16,.22,{clearcoat:1,clearcoatRoughness:.07}),o,0,.10,0);
    }
  });
  // Restrained visual diagnostic: physically plausible shimmer only, never decorative smoke.
  const heatTexture=makeTexture(256,256,(ctx,w,h)=>{
    const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.5);
    g.addColorStop(0,'rgba(255,232,129,.9)');
    g.addColorStop(.23,'rgba(251,124,59,.62)');
    g.addColorStop(.68,'rgba(220,60,40,.18)');
    g.addColorStop(1,'rgba(221,46,36,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  });
  function spot(parent,x,y,z,w,h){
    const mat=new THREE.SpriteMaterial({map:heatTexture,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending});
    const s=new THREE.Sprite(mat);s.position.set(x,y,z);s.scale.set(w,h,1);parent.add(s);return s;
  }
  const hotspots=[
    spot(groups.motor,0,1.25,0,2.12,1.48),
    spot(groups.driver,0,.5,0,1.5,.95),
    spot(groups.servo,0,.8,0,.88,.72)
  ];
  const shimmerMaterial=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},strength:{value:0}},
    vertexShader:'varying vec2 uv2;uniform float time;uniform float strength;void main(){uv2=uv;vec3 p=position;p.x+=sin(uv.y*16.0+time*3.0)*strength*.05;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
    fragmentShader:'varying vec2 uv2;uniform float time;uniform float strength;void main(){float wave=.5+.5*sin(uv2.y*26.0-time*3.0+sin(uv2.x*13.0));float edge=sin(uv2.x*3.14159)*sin(uv2.y*3.14159);gl_FragColor=vec4(.77,.89,.91,edge*wave*strength*.16);}',
    transparent:true,depthWrite:false,side:THREE.DoubleSide
  });
  const shimmer=add(new THREE.PlaneGeometry(1.4,1.4,10,16),shimmerMaterial,groups.motor,0,2.15,.26);
  shimmer.castShadow=false;shimmer.receiveShadow=false;
  const sceneLabels=[];
  root.traverse(o=>{if(o.isSprite&&o!==hotspots[0]&&o!==hotspots[1]&&o!==hotspots[2])sceneLabels.push(o);});
  let mode='realistic',heat=0,clock=0;
  function setMode(next){
    mode=['realistic','thermal','technical'].includes(next)?next:'realistic';
    for(const item of sceneLabels)item.visible=mode==='technical';
    focusRing.visible=mode==='technical';
  }
  function update(dt,s){
    clock+=dt;
    const fault=s.power&&s.running&&s.scenario==='physical';
    const tension=s.power&&s.running&&s.scenario==='spoof';
    const goal=fault?1:tension?.54:s.power&&s.running?.18:0;
    heat+=(goal-heat)*Math.min(1,dt*1.1);
    const thermal=mode==='thermal';
    hotspots[0].material.opacity=thermal?.08+heat*.71:0;
    hotspots[1].material.opacity=thermal?.04+heat*.5:0;
    hotspots[2].material.opacity=thermal?.02+heat*.17:0;
    shimmerMaterial.uniforms.time.value=clock;
    shimmerMaterial.uniforms.strength.value=thermal?0:heat;
    shimmer.visible=!thermal&&heat>.08;
    // Sub-millimeter chassis vibration at increased mechanical load.
    const v=s.power&&s.running&&s.scenario==='physical'?.006:.0008;
    groups.motor.rotation.z=Math.sin(clock*31)*v;
    groups.driver.rotation.z=Math.sin(clock*29)*v*.16;
  }
  setMode(mode);
  return {setMode,update};
}
