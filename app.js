/* SIDQ / MIDA — explanatory, synthetic-only demonstration.
   This file contains no production firmware, sensitive algorithms, or real experiment results. */
const $ = (id) => document.getElementById(id);
const state = {
  scenario: 'normal', elapsed: 0, started: performance.now(), lastTick: 0,
  challenging: false, challengeStart: 0, challengeDone: false,
  sample: {reported: 218, witness: 217, current: .84, vibration: .18},
  history: [], sceneAnimate: null
};
const componentInfo = {
  motor: {
    title: 'المحرك / الأصل الفيزيائي',
    description: 'محرك 12V مع مشفّر دوران؛ يوضّح المعدّة الخاضعة للقياس. الرسم تقريبي.'
  },
  nodeA: {
    title: 'ESP32-A / قناة Telemetry',
    description: 'تستقبل قراءة المشفّر وتُمثل البيانات المبلّغ عنها؛ ليست مرجع الثقة الوحيد.'
  },
  nodeB: {
    title: 'ESP32-B / Trusted Witness',
    description: 'مسار تحقق مستقل يجمع شواهد السرعة البصرية والطاقة والاهتزاز.'
  },
  sensors: {
    title: 'الشواهد الفيزيائية',
    description: 'قياس بصري مستقل للسرعة، INA219 للطاقة، وADXL345 للاهتزاز — تمثيل توضيحي.'
  }
};
const scenarios = {
  normal: {chart: 'القناتان تستجيبان لتغير التشغيل الافتراضي بصورة متقاربة.'},
  physical: {chart: 'هبوط السرعة مع ارتفاع مؤشري التيار والاهتزاز؛ الشواهد متسقة مع تغير فيزيائي.'},
  spoof: {chart: 'القناة المبلّغ عنها تعرض سرعة مرتفعة لا تطابق قياس الشاهد المستقل.'},
  replay: {chart: 'البيانات المُعادة تبدو مستقرة؛ الاختبار النشط يكشف غياب الاستجابة المتوقعة.'}
};
function selectComponent(key) {
  const item = componentInfo[key];
  if (!item) return;
  $('component-title').textContent = item.title;
  $('component-description').textContent = item.description;
  document.querySelectorAll('.chip').forEach(b => b.classList.toggle('selected', b.dataset.component === key));
}
document.querySelectorAll('[data-component]').forEach(el => {
  el.addEventListener('click', () => selectComponent(el.dataset.component));
  if (el.matches('[tabindex]')) el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); selectComponent(el.dataset.component); $('demo').scrollIntoView({behavior:'smooth'});}
  });
});
function selectScenario(key) {
  if (!scenarios[key]) return;
  state.scenario = key;
  state.elapsed = 0;
  state.started = performance.now();
  state.challenging = false;
  state.challengeDone = false;
  state.history = [];
  $('challenge-btn').disabled = false;
  $('challenge-btn').innerHTML = '<span class="bolt" aria-hidden="true">◇</span> تنفيذ تحقق نشط <span aria-hidden="true">←</span>';
  document.querySelectorAll('.scenario').forEach(b => {
    const selected = b.dataset.scenario === key;
    b.classList.toggle('active', selected);
    b.setAttribute('aria-pressed', String(selected));
  });
  $('chart-annotation').textContent = scenarios[key].chart;
  selectComponent(key === 'spoof' || key === 'replay' ? 'nodeA' : 'motor');
  renderStatus();
}
document.querySelectorAll('.scenario').forEach(b => b.addEventListener('click', () => selectScenario(b.dataset.scenario)));
$('reset-btn').addEventListener('click', () => selectScenario('normal'));
$('challenge-btn').addEventListener('click', () => {
  if (state.challenging) return;
  state.challenging = true;
  state.challengeDone = false;
  state.challengeStart = state.elapsed;
  $('challenge-btn').disabled = true;
  $('challenge-btn').textContent = 'جارٍ اختبار الاستجابة الافتراضية…';
  $('chart-annotation').textContent = 'تحدٍّ افتراضي محدود: نراقب استجابة القناتين خلال خمس ثوانٍ من زمن المحاكاة.';
  renderStatus();
});
function renderStatus() {
  const key = state.scenario;
  const verified = state.challengeDone;
  const running = state.challenging;
  const status = {
    normal: ['متسق','good',verified ? 'استجابة متسقة للتحدّي' : 'القراءات متوافقة مبدئيًا',verified ? 'القناتان تُظهران تغيرًا متقاربًا في السرعة خلال الاختبار الافتراضي.' : 'تتفق القياسات ضمن حدود البيانات الاصطناعية، دون إثبات دقة جهاز حقيقي.'],
    physical: ['تغير فيزيائي','warning',verified ? 'اتساق مع تغير فيزيائي' : 'عطل فيزيائي محتمل','هبوط السرعة وارتفاع مؤشري الطاقة والاهتزاز متسق مع تغير فيزيائي؛ لا يكفي وحده لتشخيص سبب العطل.'],
    spoof: ['تعارض','bad',verified ? 'تعارض مستمر بعد الاختبار' : 'تعارض بين القناتين','القراءة المبلّغ عنها لا تطابق الشاهد الفيزيائي. توجد حاجة إلى تحقيق؛ التعارض وحده لا يثبت نية التلاعب.'],
    replay: verified
      ? ['اشتباه','bad','القراءة لا تستجيب للتحدّي','يتغير الشاهد الفيزيائي أثناء التحدّي بينما تبقى القراءة المبلّغ عنها ثابتة؛ نمط متسق مع إعادة بث محتملة أو خلل في القناة.']
      : ['غير محسوم','neutral','مطلوب تحقق نشط','تطابق أولي للقراءات لا يكفي لاستبعاد إعادة بث البيانات. جرّب زر التحقق النشط لإظهار الفرق.']
  }[key];
  const title = running ? 'التحقق النشط جارٍ' : status[2];
  const description = running ? 'يجري تغيير السلوك الفيزيائي الافتراضي ومراقبة ما إذا كانت القناتان تعكسان التغير.' : status[3];
  $('state-pill').textContent = running ? 'قيد الفحص' : status[0];
  $('state-pill').className = 'status-pill ' + (running ? 'warning' : status[1]);
  $('state-title').textContent = title;
  $('state-description').textContent = description;
  $('state-confidence').textContent = 'استدلال افتراضي — غير معتمد';
}
function computeSample(t) {
  const s1 = Math.sin(t * 1.8) * 1.7;
  const s2 = Math.sin(t * 2.7 + .8) * 1.15;
  // Illustrative response only: not a controller, safety limit, or physical calibration.
  const active = state.challenging ? Math.min(1, (t - state.challengeStart) / 1.2) : 0;
  let a,b,current,vibration;
  if (state.scenario === 'normal') {
    a = 218 + s1 - active * 29; b = 217 + s1 + s2 * .65 - active * 29;
    current = .84 + Math.sin(t * 1.25) * .025 + active * .11;
    vibration = .18 + Math.sin(t * 1.5) * .012 + active * .02;
  } else if (state.scenario === 'physical') {
    a = 151 + s1 - active * 21; b = 149.5 + s1 + s2 * .7 - active * 21;
    current = 1.48 + Math.sin(t * 1.2) * .07 + active * .12;
    vibration = .44 + Math.sin(t * 1.6) * .035 + active * .035;
  } else if (state.scenario === 'spoof') {
    a = 218 + Math.sin(t*.9)*.5; b = 147 + s1 + s2 * .5 - active * 22;
    current = 1.42 + Math.sin(t*1.1)*.04 + active * .1;
    vibration = .43 + Math.sin(t*1.7)*.027 + active * .025;
  } else {
    a = 218; b = 217 + s1 + s2 * .6 - active * 32;
    current = .85 + Math.sin(t*1.5)*.02 + active * .11;
    vibration = .18 + Math.sin(t*1.2)*.015 + active * .025;
  }
  return {reported: Math.max(0,a), witness: Math.max(0,b), current: Math.max(0,current), vibration: Math.max(0,vibration)};
}
function updateMetrics() {
  $('reported-rpm').textContent = Math.round(state.sample.reported);
  $('witness-rpm').textContent = Math.round(state.sample.witness);
  $('current-reading').textContent = state.sample.current.toFixed(2);
  $('vibration-reading').textContent = state.sample.vibration.toFixed(2);
  const sec = Math.floor(state.elapsed);
  $('stage-clock').textContent = 'T+' + String(Math.floor(sec/60)).padStart(2,'0') + ':' + String(sec%60).padStart(2,'0');
}
const chart = $('trend-chart'), ctx = chart.getContext('2d');
function renderChart() {
  if (!ctx) return;
  const rect = chart.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1,2);
  const width = rect.width, height = rect.height;
  if (chart.width !== Math.round(width*dpr) || chart.height !== Math.round(height*dpr)) {
    chart.width = Math.round(width*dpr); chart.height = Math.round(height*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  const pad = {top:14,right:12,bottom:27,left:40};
  const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  const values = state.history.flatMap(p => [p.reported,p.witness]);
  const bottom = Math.min(100,Math.floor((Math.min(...values,140)-16)/20)*20);
  const top = Math.max(240,Math.ceil((Math.max(...values,220)+17)/20)*20);
  const yy = v => pad.top + (top-v)/(top-bottom)*plotH;
  const xx = i => pad.left + i/Math.max(1,state.history.length-1)*plotW;
  ctx.textAlign='right';ctx.textBaseline='middle';ctx.font='11px Space Grotesk, Arial, sans-serif';
  for(let i=0;i<=4;i++){
    const v=bottom+(top-bottom)*i/4, y=yy(v);
    ctx.strokeStyle='rgba(130,170,193,.13)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(width-pad.right,y);ctx.stroke();
    ctx.fillStyle='#718d9f';ctx.fillText(String(Math.round(v)),pad.left-9,y);
  }
  ctx.fillStyle='#718d9f';ctx.textAlign='center';ctx.textBaseline='top';
  for(let i=0;i<=4;i++){const x=pad.left+(plotW*i/4);ctx.fillText(String(Math.round(i*state.history.length/4))+'s',x,height-pad.bottom+7);}
  const series = [{field:'witness',color:'#e9bc70'},{field:'reported',color:'#40d9d5'}];
  for(const entry of series){
    if(state.history.length < 2) continue;
    ctx.beginPath();
    state.history.forEach((p,i) => i ? ctx.lineTo(xx(i),yy(p[entry.field])) : ctx.moveTo(xx(i),yy(p[entry.field])));
    ctx.lineWidth=2.3;ctx.strokeStyle=entry.color;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
    const last=state.history[state.history.length-1], endX=xx(state.history.length-1),endY=yy(last[entry.field]);
    ctx.beginPath();ctx.arc(endX,endY,3.4,0,Math.PI*2);ctx.fillStyle=entry.color;ctx.fill();
  }
}
function tick(now) {
  const dt = Math.min((now - state.lastTick)/1000 || 0,.08);
  state.lastTick = now;
  state.elapsed += dt;
  state.sceneAnimate?.(dt,state);
  if(!state.lastSampleAt || now-state.lastSampleAt >= 170){
    state.lastSampleAt=now;
    state.sample=computeSample(state.elapsed);
    state.history.push({...state.sample});
    if(state.history.length>68) state.history.shift();
    updateMetrics();renderChart();
  }
  if(state.challenging && state.elapsed-state.challengeStart>=5){
    state.challenging=false;state.challengeDone=true;
    $('challenge-btn').disabled=false;
    $('challenge-btn').innerHTML='<span class="bolt" aria-hidden="true">◇</span> إعادة التحقق النشط <span aria-hidden="true">←</span>';
    $('chart-annotation').textContent=scenarios[state.scenario].chart;
    renderStatus();
  }
  requestAnimationFrame(tick);
}
window.addEventListener('resize',renderChart);
selectScenario('normal');
requestAnimationFrame(tick);

/* The optional 3D visualization loads separately so scenario controls and
   evidence charts still work if CDN/WebGL is blocked. */
async function init3D() {
  const canvas=$('scene');
  const wrap=$('scene-wrap');
  try {
    const THREE=await import('three');
    const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.42;
    const scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(0x0c2535,.026);
    const camera=new THREE.PerspectiveCamera(36,1,.1,120);
    camera.position.set(10,8.2,12.3);
    const controls=new OrbitControls(camera,canvas);
    controls.enableDamping=true;controls.dampingFactor=.065;
    controls.enablePan=false;controls.minDistance=8;controls.maxDistance=24;
    controls.maxPolarAngle=Math.PI*.45;controls.minPolarAngle=.38;
    controls.target.set(0,.15,0);controls.update();
    scene.add(new THREE.AmbientLight(0xc9eaff,1.15));
    const key=new THREE.DirectionalLight(0xd4f7ff,2.7);key.position.set(-3,10,6);scene.add(key);
    const fill=new THREE.DirectionalLight(0x3ad7c7,1.4);fill.position.set(5,5,-3);scene.add(fill);
    const golden=new THREE.PointLight(0xe9bc70,22,14);golden.position.set(5,3,3);scene.add(golden);
    const root=new THREE.Group();scene.add(root);
    const mat=(color,metalness=.4,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
    const baseMat=mat(0x1e3a4b,.64,.36),black=mat(0x0a1623,.55,.42);
    const teal=mat(0x40d9d5,.55,.35),gold=mat(0xe9bc70,.55,.35);
    function mesh(geo,material,parent,x=0,y=0,z=0){
      const obj=new THREE.Mesh(geo,material);obj.position.set(x,y,z);parent.add(obj);return obj;
    }
    const box=(w,h,d,m,p,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
    const cyl=(rt,rb,len,m,p,x,y,z,seg=32)=>mesh(new THREE.CylinderGeometry(rt,rb,len,seg),m,p,x,y,z);
    function label(text,width=1.7,color='#e9f8f9'){
      const c=document.createElement('canvas');c.width=512;c.height=128;
      const g=c.getContext('2d');
      g.clearRect(0,0,512,128);
      g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font='700 43px Arial,sans-serif';
      g.fillText(text,256,66);
      const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
      const m=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),m);
      plane.rotation.x=-Math.PI/2;return plane;
    }
    box(9.5,.26,5.7,baseMat,root,0,-.7,0);
    box(9.28,.045,5.45,black,root,0,-.54,0);
    for(const x of [-4.3,4.3])for(const z of [-2.35,2.35]){
      const stud=cyl(.12,.12,.045,mat(0x648799,.8,.25),root,x,-.505,z,20);
      stud.userData.noPick=true;
    }
    const grid=new THREE.GridHelper(13,26,0x245169,0x16364b);grid.position.y=-.755;root.add(grid);
    const motor=new THREE.Group();motor.userData.component='motor';motor.position.set(-.2,-.11,.35);root.add(motor);
    const pedestal=box(2.7,.2,1.65,mat(0x345568,.7,.35),motor,0,-.26,0);
    const housing=cyl(.73,.73,2.05,mat(0x718b9a,.84,.28),motor,0,.48,0,48);housing.rotation.z=Math.PI/2;
    const back=cyl(.77,.77,.17,mat(0x1d3e50,.7,.34),motor,-1.05,.48,0,48);back.rotation.z=Math.PI/2;
    const front=cyl(.75,.75,.19,mat(0xb8cad0,.82,.25),motor,1.06,.48,0,48);front.rotation.z=Math.PI/2;
    const middle=cyl(.741,.741,.1,mat(0x263b49,.7,.35),motor,.45,.48,0,48);middle.rotation.z=Math.PI/2;
    for(let n=0;n<11;n++){
      const angle=n*Math.PI*2/11;
      const fin=box(.9,.075,.08,mat(0x263f4c,.65,.38),motor,-.26,.48+Math.sin(angle)*.748,Math.cos(angle)*.748);
      fin.rotation.x=angle;
    }
    const shaft=cyl(.085,.085,1.13,mat(0xc8dce1,.9,.22),motor,1.63,.48,0,24);shaft.rotation.z=Math.PI/2;
    const rotor=new THREE.Group();motor.add(rotor);rotor.position.set(2.11,.48,0);
    const disk=cyl(.52,.52,.085,mat(0x385969,.78,.33),rotor,0,0,0,36);disk.rotation.z=Math.PI/2;
    for(let n=0;n<8;n++){
      const a=n*Math.PI/4;
      const hole=cyl(.06,.06,.1,teal,rotor,0,Math.sin(a)*.36,Math.cos(a)*.36,12);hole.rotation.z=Math.PI/2;
    }
    const motorLabel=label('12V · ENCODER',1.9,'#c7d8de');motorLabel.position.set(-.1,1.42,.35);root.add(motorLabel);
    function makeBoard(id,x,z,accent,title){
      const parent=new THREE.Group();parent.userData.component=id;parent.position.set(x,-.22,z);root.add(parent);
      box(2.12,.13,1.42,mat(0x105547,.48,.45),parent,0,0,0);
      box(2.18,.035,1.48,mat(accent,.5,.35),parent,0,-.075,0);
      box(.7,.16,.6,mat(0x17252f,.4,.4),parent,-.05,.15,0);
      box(.54,.13,.29,mat(0x81949d,.72,.31),parent,-.73,.14,-.15);
      box(.27,.22,.22,mat(0x1b2a33,.35,.45),parent,.68,.14,.05);
      for(let i=0;i<7;i++){
        box(.065,.06,.11,mat(0xcbbd8b,.7,.3),parent,-.81+i*.27,.12,.6);
        box(.065,.06,.11,mat(0xcbbd8b,.7,.3),parent,-.81+i*.27,.12,-.6);
      }
      const led=cyl(.055,.055,.065,mat(accent,.3,.25),parent,.79,.13,-.42,16);
      const titleLabel=label(title,2.0,id==='nodeA'?'#65ece7':'#f1d69d');
      titleLabel.position.set(0,.47,0);parent.add(titleLabel);
      return {parent,led};
    }
    const a=makeBoard('nodeA',-3.25,-1.6,0x35aebe,'ESP32-A');
    const b=makeBoard('nodeB',3.15,-1.6,0xc39553,'ESP32-B');
    const sensors=new THREE.Group();sensors.userData.component='sensors';root.add(sensors);
    const sensorPositions=[[-2.8,1.98],[.0,2.12],[2.72,1.93]];
    const sensorTitles=['OPTICAL RPM','INA219','ADXL345'];
    for(let i=0;i<sensorPositions.length;i++){
      const [x,z]=sensorPositions[i];
      const block=box(1.37,.18,.77,mat(0x1b4f55,.5,.35),sensors,x,-.39,z);
      box(.35,.12,.32,mat(0x1e2c36,.5,.36),sensors,x,-.23,z);
      for(let k=0;k<4;k++)box(.055,.045,.11,mat(0xb2a370,.7,.35),sensors,x-.47+k*.31,-.27,z+.25);
      const t=label(sensorTitles[i],1.35,'#a5e6d9');t.position.set(x,-.02,z);sensors.add(t);
    }
    function cable(points,color,radius=.023){
      const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.68});
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,45,radius,7,false),m);
      root.add(tube);return tube;
    }
    cable([[-1.1,.23,.35],[-1.4,.33,-.55],[-2.6,.06,-.7],[-3.25,-.03,-1.35]],0x40d9d5,.034);
    cable([[1,.25,.35],[1.3,.35,.97],[2.3,.15,.2],[3.15,-.02,-1.3]],0xe9bc70,.032);
    for(const sx of [-2.8,0,2.72]){
      cable([[sx,-.2,1.75],[sx,-.05,1.17],[2.45,.13,.65],[3.25,.07,-1.12]],0x77bfae,.013);
    }
    const origin=cyl(.12,.12,.19,teal,root,-.2,-.41,.35,20);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let pointerStart=null;
    canvas.addEventListener('pointerdown',ev=>{pointerStart={x:ev.clientX,y:ev.clientY};});
    canvas.addEventListener('pointerup',ev=>{
      if(!pointerStart || Math.hypot(pointerStart.x-ev.clientX,pointerStart.y-ev.clientY)>7)return;
      const rect=canvas.getBoundingClientRect();
      pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;
      pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects(root.children,true);
      for(const hit of hits){
        let obj=hit.object;
        while(obj && obj!==root){
          if(obj.userData.component){selectComponent(obj.userData.component);return;}
          obj=obj.parent;
        }
      }
    });
    function resize(){
      const w=wrap.clientWidth,h=wrap.clientHeight;
      if(!w || !h)return;
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    }
    window.addEventListener('resize',resize);resize();
    const resizeObserver=typeof ResizeObserver==='function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(wrap);
    let clock=0;
    function render(dt,s){
      clock+=dt;
      // Speed affects illustrative shaft motion only.
      rotor.rotation.x+=Math.max(0,s.sample.witness)*dt*.035;
      a.led.material.emissive=new THREE.Color(0x157d83);
      b.led.material.emissive=new THREE.Color(s.scenario==='spoof'||(s.scenario==='replay'&&s.challengeDone) ? 0xd68837 : 0x277c65);
      a.led.material.emissiveIntensity=.35+Math.sin(clock*4)*.22;
      b.led.material.emissiveIntensity=.35+Math.sin(clock*3.6)*.2;
      controls.update();renderer.render(scene,camera);
    }
    state.sceneAnimate=render;
    render(0,state);
  }catch(error){
    console.warn('SIDQ 3D unavailable, 2D fallback active:',error);
    canvas.style.display='none';
    $('scene-fallback').hidden=false;
    const help=document.querySelector('.stage-help');
    if(help) help.hidden=true;
  }
}
init3D();
