/* SIDQ / MIDA | interactive demonstration environment.
   Operational values are generated for the presentation layer. */
const el = id => document.getElementById(id);
const state = {
  power:false, running:false, emergency:false, scenario:'normal', challenge:false,
  challengeCompleted:false, challengeStart:0, elapsed:0, sampleTime:0, lastFrame:0,
  view:'isometric', wireView:'all', visualMode:'realistic', focus:'motor', chart:[],
  metrics:{reported:0,witness:0,current:0,vibration:0},
  drawScene:null, setCamera:null, showWireGroups:null, setFocus3D:null, setVisualMode:null,
  lastMessage:'ابدأ من مفتاح الطاقة، ثم اضغط تشغيل المحرك.'
};
const scenarioInfo = {
  normal:{name:'وضع طبيعي',subtitle:'المحرك والشواهد في حالة اتساق',tag:'متوافق',className:'good'},
  physical:{name:'عطل فيزيائي',subtitle:'تغيّر فعلي في أداء المحرك والحمل',tag:'تغيّر فيزيائي',className:'warn'},
  spoof:{name:'تلاعب بالقراءة',subtitle:'اختلاف بيانات Telemetry عن الشاهد المستقل',tag:'تعارض',className:'error'},
  replay:{name:'إعادة بث البيانات',subtitle:'فحص استجابة القراءة للتحدّي',tag:'يتطلب تحققًا',className:'neutral'}
};
const parts = {
  motor:{name:'محرك FIT0186 مع المشفّر',description:'محرك تروس 12V بسرعة اسمية 251RPM مع Hall Encoder وعمود 6mm D-shaft. القرص المركب على العمود يسمح بملاحظة الدوران بصورة مستقلة.',tags:['12V','251RPM','Hall Encoder']},
  disc:{name:'قرص الدوران وموضع الاستشعار',description:'قرص مشقوق مثبت على عمود المحرك، يمر أمام حساس السرعة البصري لتسجيل نبضات دوران مستقلة عن بيانات المشفّر المبلّغ عنها.',tags:['6mm Shaft','Slotted Disc','Optical RPM']},
  driver:{name:'وحدة قيادة المحرك',description:'مرحلة قيادة تيار المحرك والتحكم في السرعة عبر PWM، وتطبيق تغيّر التشغيل المطلوب في التحقق النشط.',tags:['12V','PWM','Motor Driver']},
  espA:{name:'ESP32-S3 / قناة Telemetry',description:'تقرأ قناة القياس الرئيسية نبضات المشفّر وتعرض السرعة المبلّغ عنها، مع دعم حالات تغيير القراءة أو إعادة بثها.',tags:['ESP32-S3','Hall Encoder','Telemetry']},
  espB:{name:'ESP32-S3 / الشاهد المستقل',description:'قناة مستقلة تجمع الشواهد الفيزيائية من قياسات السرعة البصرية والطاقة والاهتزاز ثم تتيح فحص الاتساق.',tags:['ESP32-S3','I²C','Trusted Witness']},
  optical:{name:'حساس قياس السرعة البصري',description:'يرصد مرور فتحات القرص الدوّار بوصفه مصدرًا مستقلًا لسرعة الدوران، بعيدًا عن القناة المبلّغ عنها.',tags:['Optical','Pulse','Witness']},
  watt:{name:'INA219 / شاهد الطاقة',description:'قياس التيار والجهد والقدرة الكهربائية على فرع المحرك للاستدلال على التغيرات الفيزيائية المصاحبة للتشغيل.',tags:['INA219','I²C','Power Witness']},
  accel:{name:'ADXL345 / شاهد الاهتزاز',description:'مقياس تسارع مثبت في محيط الأصل الفيزيائي لمتابعة تغير نمط الاهتزاز عبر التشغيل والحمل.',tags:['ADXL345','I²C','Vibration']},
  servo:{name:'سيرفو اختبار الحمل',description:'سيرفو يدفع ذراعًا مزودًا بوسادة احتكاك لتغيير الحمل الميكانيكي بشكل محدود أثناء سيناريو العطل الفيزيائي.',tags:['Servo Brake','PWM','Actuation']},
  buck:{name:'محول DC-DC / سكة 5V',description:'يحوّل جهد التغذية 12V إلى سكة 5V لتغذية الدوائر المساعدة وفق توزيع الطاقة في المنصة.',tags:['12V → 5V','DC-DC']},
  fuse:{name:'الحماية والمصهر',description:'فرع حماية لطاقة المحرك، مع فصل الطوارئ المستقل عن أوامر البرمجيات.',tags:['Fuse','12V Branch','Safety']},
  power:{name:'مدخل التغذية 12V',description:'نقطة تغذية المنصة من مصدر طاقة مناسب مع مسار محمي للمحرك ومسارات للدوائر المساعدة.',tags:['12V DC','Power Input']},
  estop:{name:'زر الإيقاف الطارئ',description:'زر فصل طوارئ ميكانيكي مثبت على الواجهة، يفصل فرع تشغيل المحرك ويتطلب تحريرًا يدويًا قبل استئناف العمل.',tags:['E-STOP','Motor Power','Manual Release']},
  controls:{name:'مجموعة أزرار السيناريوهات',description:'الأحمر للعطل الفيزيائي، الأصفر للتلاعب بالقراءة، الأزرق لإعادة بث البيانات، والأخضر لإعادة الضبط للوضع الطبيعي.',tags:['Red','Yellow','Blue','Green']}
};
const wireDescriptions = {
  all:'تظهر موصلات القدرة والإشارات والمستشعرات على قاعدة الأكريلك.',
  power:'مسار الطاقة من 12V إلى الحماية والسائق والمحول والدوائر المساعدة.',
  reported:'قراءة المشفّر وإشارات التحكم بين المحرك وقناة Telemetry.',
  witness:'قراءات السرعة البصرية والطاقة والاهتزاز إلى قناة الشاهد المستقل.',
  logic:'سكة 5V ومجموعة إشارات التحكم والأزرار.'
};
function notify(message,kind='normal'){
  state.lastMessage=message;
  const box=el('demoMsg');
  if(box){box.textContent=message;box.className='message'+(kind==='emergency'?' emergency':'');}
}
function updateControls(){
  const powered=state.power,em=state.emergency,running=state.running;
  const powerButton=el('powerToggle');
  powerButton.classList.toggle('on',powered);
  powerButton.setAttribute('aria-pressed',String(powered));
  el('powerStatus').textContent=powered?'POWER ON':'POWER OFF';
  el('startBtn').disabled=!powered||running||em;
  el('stopBtn').disabled=!powered||!running;
  el('challengeBtn').disabled=!powered||!running||em||state.challenge;
  el('emergencyBtn').disabled=!powered||em;
  el('releaseBtn').hidden=!em;
  const lamp=el('stateLamp');
  const mode=!powered?'off':em?'emergency':state.challenge?'challenge':running?'running':'ready';
  lamp.className='status-lamp '+(mode==='off'?'':mode);
  const names={off:'الجهاز متوقف',ready:'المنظومة جاهزة',running:'المحرك قيد التشغيل',challenge:'جارٍ تنفيذ التحقق',emergency:'تم تفعيل الإيقاف الطارئ'};
  const help={off:'اضغط زر الطاقة لتهيئة المنظومة',ready:'اضغط بدء التشغيل لتدوير المحرك',running:'القياسات تظهر أثناء دوران المحرك',challenge:'يُطبّق تغير محدود على التشغيل ويُقارن أثره',emergency:'فرع المحرك مفصول — حرر زر الطوارئ'};
  el('systemStateName').textContent=names[mode];
  el('systemStateHelp').textContent=help[mode];
  el('stateMeta').textContent=mode==='off'?'OFF':mode.toUpperCase();
  el('challengeBtn').textContent=state.challenge?'جارٍ التحقق النشط…':'◇  تنفيذ التحقق النشط';
  const info=scenarioInfo[state.scenario];
  let tag,title,description,kind;
  if(!powered){
    tag='إيقاف';title='المنظومة في وضع الإيقاف';description='شغّل الطاقة لبدء تجربة تشغيل النموذج.';kind='neutral';
  }else if(em){
    tag='إيقاف طارئ';title='تم فصل تشغيل المحرك';description='توقفت الحركة بعد تفعيل زر الإيقاف الطارئ. حرر الزر قبل بدء التشغيل مجددًا.';kind='error';
  }else if(!running){
    tag='جاهز';title='المنظومة جاهزة للتشغيل';description='اختر السيناريو ثم اضغط بدء التشغيل، أو ابدأ بالوضع الطبيعي.';kind='neutral';
  }else if(state.challenge){
    tag='فحص نشط';title='مقارنة استجابة القناتين';description='تنفيذ تغيّر محدود في سرعة المحرك ومتابعة أثره على القراءات.';kind='warn';
  }else if(state.scenario==='normal'){
    tag='متوافق';title=state.challengeCompleted?'اكتمل التحقق: استجابة متوافقة':'تشغيل مستقر ومتوافق';
    description='القناتان تعرضان سرعة متقاربة وتتابعان تغير التشغيل.';kind='good';
  }else if(state.scenario==='physical'){
    tag='تغيّر فيزيائي';title='تغيّر ملحوظ في سلوك المحرك';description='هبوط السرعة مترافق مع ارتفاع التيار والاهتزاز، وهو نمط يوجّه إلى حالة فيزيائية.';kind='warn';
  }else if(state.scenario==='spoof'){
    tag='تعارض';title='اختلاف بين القراءتين';description='السرعة المبلّغ عنها أعلى من الشاهد البصري المستقل، وتظهر الشواهد الفيزيائية تغير الحمل.';kind='error';
  }else{
    tag=state.challengeCompleted?'تعارض':'تحقق مطلوب';
    title=state.challengeCompleted?'غياب استجابة القراءة للتحدّي':'القراءة تبدو متوافقة';
    description=state.challengeCompleted?'استجابت الشواهد الفيزيائية لتغير التشغيل بينما بقيت القراءة المبلّغ عنها ثابتة.':'اختبر استجابة البيانات للتغير الفيزيائي عبر زر التحقق النشط.';kind=state.challengeCompleted?'error':'neutral';
  }
  el('resultPill').textContent=tag;
  el('resultPill').className='result-pill'+(kind==='warn'?' warn':kind==='error'?' error':kind==='neutral'?' neutral':'');
  el('statusTitle').textContent=title;
  el('statusDesc').textContent=description;
  document.querySelectorAll('[data-scenario]').forEach(btn=>{
    const selected=btn.dataset.scenario===state.scenario;
    btn.classList.toggle('active',selected);
    btn.setAttribute('aria-pressed',String(selected));
  });
  document.querySelectorAll('[data-step]').forEach(step=>{
    const n=Number(step.dataset.step);
    const active=powered&&(n===1||n===2&&running||n===3&&state.challenge||n===4&&state.challengeCompleted);
    step.classList.toggle('active',active);
  });
}
function powerToggle(){
  if(state.power){
    state.power=false;state.running=false;state.challenge=false;state.challengeCompleted=false;
    notify('تم إيقاف طاقة المنظومة.');
  }else{
    state.power=true;state.running=false;state.challenge=false;state.challengeCompleted=false;
    notify(state.emergency?'تم تشغيل لوحة التحكم، وزر الطوارئ ما زال مفعلًا.':'اكتملت تهيئة المنظومة. يمكنك بدء تشغيل المحرك.');
  }
  updateControls();
}
function startMotor(){
  if(!state.power||state.emergency)return;
  state.running=true;state.challenge=false;state.challengeCompleted=false;
  notify('بدأ المحرك الدوران. يمكنك اختيار سيناريو أو تنفيذ تحقق نشط.');
  updateControls();
}
function stopMotor(){
  if(!state.power)return;
  state.running=false;state.challenge=false;state.challengeCompleted=false;
  notify('توقف المحرك؛ تبقى منظومة التحكم في وضع الجاهزية.');
  updateControls();
}
function resetScenario(){
  state.scenario='normal';state.challenge=false;state.challengeCompleted=false;
  notify(state.emergency?'أعيد اختيار الوضع الطبيعي. يجب تحرير زر الطوارئ قبل التشغيل.':'أعيد اختيار الوضع الطبيعي وتصفير نتيجة التحقق.');
  updateControls();
}
function emergencyStop(){
  if(!state.power||state.emergency)return;
  state.emergency=true;state.running=false;state.challenge=false;state.challengeCompleted=false;
  notify('إيقاف طارئ: تم فصل فرع المحرك. حرّر زر الطوارئ لإعادة التمكين.','emergency');
  updateControls();
}
function releaseEmergency(){
  state.emergency=false;state.running=false;state.challenge=false;
  notify(state.power?'تم تحرير زر الطوارئ. المنظومة جاهزة لبدء التشغيل.':'تم تحرير زر الطوارئ.');
  updateControls();
}
function selectScenario(key){
  if(!scenarioInfo[key])return;
  if(key==='normal'){resetScenario();return;}
  state.scenario=key;state.challenge=false;state.challengeCompleted=false;
  notify('تم اختيار سيناريو '+scenarioInfo[key].name+'. '+(state.running?'تظهر الاستجابة على المجسم والقراءات.':'ابدأ المحرك لتطبيقه.'));
  updateControls();
}
function challenge(){
  if(!state.power||!state.running||state.emergency||state.challenge)return;
  state.challenge=true;state.challengeStart=state.elapsed;state.challengeCompleted=false;
  notify('بدأ التحقق النشط: تغيير سرعة المحرك ومقارنة استجابة المسارين.');
  updateControls();
}
el('powerToggle').addEventListener('click',powerToggle);
el('startBtn').addEventListener('click',startMotor);
el('stopBtn').addEventListener('click',stopMotor);
el('resetBtn').addEventListener('click',resetScenario);
el('emergencyBtn').addEventListener('click',emergencyStop);
el('releaseBtn').addEventListener('click',releaseEmergency);
el('challengeBtn').addEventListener('click',challenge);
document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>selectScenario(b.dataset.scenario)));
function choosePart(key){
  if(!parts[key])return;
  state.focus=key;
  const p=parts[key];
  el('viewTitle').textContent=p.name;
  el('viewDesc').textContent=p.description;
  el('partCardTitle').textContent=p.name;
  el('partCardDesc').textContent=p.description;
  el('partCardMeta').replaceChildren();
  for(const v of p.tags){const span=document.createElement('span');span.textContent=v;el('partCardMeta').append(span);}
  document.querySelectorAll('[data-part]').forEach(b=>b.classList.toggle('selected',b.dataset.part===key));
  state.setFocus3D?.(key);
}
document.querySelectorAll('[data-part]').forEach(b=>b.addEventListener('click',()=>choosePart(b.dataset.part)));
function chooseView(view){
  state.view=view;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  state.setCamera?.(view);
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>chooseView(b.dataset.view)));
function chooseVisualMode(mode){
  if(!['realistic','thermal','technical'].includes(mode))return;
  state.visualMode=mode;
  document.querySelectorAll('[data-visual]').forEach(b=>{
    b.classList.toggle('active',b.dataset.visual===mode);
    b.setAttribute('aria-pressed',String(b.dataset.visual===mode));
  });
  const legend=el('thermalLegend');if(legend)legend.hidden=mode!=='thermal';
  state.setVisualMode?.(mode);
}
document.querySelectorAll('[data-visual]').forEach(b=>b.addEventListener('click',()=>chooseVisualMode(b.dataset.visual)));
function chooseWires(view){
  state.wireView=view;
  document.querySelectorAll('[data-wire]').forEach(b=>b.classList.toggle('active',b.dataset.wire===view));
  el('wireHelp').textContent=wireDescriptions[view];
  state.showWireGroups?.(view);
}
document.querySelectorAll('[data-wire]').forEach(b=>b.addEventListener('click',()=>chooseWires(b.dataset.wire)));
function sampleAt(t){
  if(!state.power||state.emergency)return {reported:0,witness:0,current:0,vibration:0};
  if(!state.running)return {reported:0,witness:0,current:.05,vibration:.02};
  const noise=Math.sin(t*1.45)*2+Math.sin(t*2.5)*.7;
  const change=state.challenge?Math.min(1,(t-state.challengeStart)/1.1)*32:0;
  const s=state.scenario;
  if(s==='normal')return {reported:220+noise-change,witness:219+noise*.9-change,current:.84+.018*Math.sin(t)+change*.002,vibration:.18+.015*Math.sin(t*1.2)};
  if(s==='physical')return {reported:152+noise-change*.8,witness:149+noise*.9-change*.8,current:1.47+.04*Math.sin(t)+change*.002,vibration:.46+.028*Math.sin(t*1.3)};
  if(s==='spoof')return {reported:220+.5*Math.sin(t*.7),witness:146+noise-change*.8,current:1.41+.04*Math.sin(t*1.1),vibration:.42+.022*Math.sin(t*1.2)};
  return {reported:219,witness:219+noise*.8-change,current:.84+.02*Math.sin(t)+change*.002,vibration:.18+.015*Math.sin(t*.8)};
}
function updateMeters(){
  const m=state.metrics;
  el('reportRPM').textContent=Math.max(0,Math.round(m.reported));
  el('witnessRPM').textContent=Math.max(0,Math.round(m.witness));
  el('wattCurrent').textContent=m.current.toFixed(2);
  el('accelVib').textContent=m.vibration.toFixed(2);
  const sec=Math.floor(state.elapsed);
  el('clock').textContent='T+'+String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
}
const graph=el('telemetry-chart'),ctx=graph.getContext('2d');
function paintChart(){
  if(!ctx)return;
  const bounds=graph.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2),w=bounds.width,h=bounds.height;
  if(graph.width!==Math.round(w*dpr)||graph.height!==Math.round(h*dpr)){
    graph.width=Math.round(w*dpr);graph.height=Math.round(h*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const pad={t:10,r:10,b:27,l:42},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
  const y=v=>pad.t+(280-v)/280*ph,x=i=>pad.l+i/Math.max(1,state.chart.length-1)*pw;
  ctx.font='11px Space Grotesk, sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  for(let k=0;k<=4;k++){
    const v=k*70,yy=y(v);
    ctx.beginPath();ctx.strokeStyle='#55708038';ctx.lineWidth=1;ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();
    ctx.fillStyle='#7f9ead';ctx.fillText(String(v),pad.l-9,yy);
  }
  ctx.textAlign='center';ctx.textBaseline='top';
  const first=state.chart[0]?.t||0,last=state.chart[state.chart.length-1]?.t||0;
  for(let i=0;i<=4;i++){ctx.fillText(Math.round(first+(last-first)*i/4)+'s',pad.l+pw*i/4,h-pad.b+8);}
  for(const series of [{key:'witness',color:'#e9bd78'},{key:'reported',color:'#53e4d6'}]){
    if(state.chart.length<2)continue;
    ctx.beginPath();
    state.chart.forEach((pt,i)=>i===0?ctx.moveTo(x(i),y(pt[series.key])):ctx.lineTo(x(i),y(pt[series.key])));
    ctx.strokeStyle=series.color;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.stroke();
    const pos=state.chart.length-1,yy=y(state.chart[pos][series.key]);
    ctx.beginPath();ctx.arc(x(pos),yy,3,0,Math.PI*2);ctx.fillStyle=series.color;ctx.fill();
  }
}
window.addEventListener('resize',paintChart);
function animate(now){
  const dt=Math.min(Math.max((now-state.lastFrame)/1000,0)||0,.065);
  state.lastFrame=now;state.elapsed+=dt;
  if(now-state.sampleTime>175){
    state.sampleTime=now;state.metrics=sampleAt(state.elapsed);
    state.chart.push({t:state.elapsed,...state.metrics});
    if(state.chart.length>85)state.chart.shift();
    updateMeters();paintChart();
  }
  if(state.challenge&&state.elapsed-state.challengeStart>=5){
    state.challenge=false;state.challengeCompleted=true;
    notify('اكتمل التحقق النشط. راجع نتيجة الاتساق ومنحنى استجابة القناتين.');
    updateControls();
  }
  state.drawScene?.(dt,state);
  requestAnimationFrame(animate);
}
updateControls();choosePart('motor');chooseWires('all');
notify(state.lastMessage);
requestAnimationFrame(animate);

/* Acrylic bench renderer */
async function initScene(){
  try{
    const THREE=await import('three');
    const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
    const canvas=el('sceneCanvas'),wrap=el('viewer');
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
    const scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(0x0b2533,.021);
    const camera=new THREE.PerspectiveCamera(39,1,.1,100);
    camera.position.set(10.5,10.5,13.6);
    const orbit=new OrbitControls(camera,canvas);
    orbit.enableDamping=true;orbit.dampingFactor=.065;orbit.enablePan=false;
    orbit.minDistance=8;orbit.maxDistance=27;orbit.minPolarAngle=.18;orbit.maxPolarAngle=1.48;
    orbit.target.set(0,.16,0);
    let cameraTransition=null;
    orbit.addEventListener('start',()=>{cameraTransition=null;});
    const lightA=new THREE.HemisphereLight(0xc6eff7,0x0d1929,2.1);scene.add(lightA);
    const sun=new THREE.DirectionalLight(0xe8ffff,2.25);sun.position.set(-2,11,7);scene.add(sun);
    const highlightLight=new THREE.PointLight(0x57ead7,32,15);highlightLight.position.set(-5,5,-3);scene.add(highlightLight);
    const warm=new THREE.PointLight(0xffcb83,25,11);warm.position.set(4,5,2);scene.add(warm);
    const root=new THREE.Group();scene.add(root);
    const m=(color,metal=.25,rough=.42,extra={})=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,...extra});
    const silver=m(0xa2b5c0,.88,.28),dark=m(0x182e3b,.65,.37),black=m(0x071924,.4,.48);
    const pcb=m(0x12564c,.42,.44),bluePcb=m(0x17475c,.4,.43),pin=m(0xcab782,.83,.27);
    const mint=m(0x53e4d6,.56,.27),gold=m(0xe9bd78,.55,.34);
    const glass=m(0x8cc6d4,.22,.17,{transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide});
    const cyl=(rt,rb,h,mat,parent,x=0,y=0,z=0,seg=32)=>{
      const a=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);a.position.set(x,y,z);parent.add(a);return a;
    };
    const box=(w,h,d,mat,parent,x=0,y=0,z=0)=>{
      const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);a.position.set(x,y,z);parent.add(a);return a;
    };
    const ball=(r,mat,parent,x=0,y=0,z=0)=>{
      const a=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),mat);a.position.set(x,y,z);parent.add(a);return a;
    };
    function badge(text,size=1.35,color='#d4f7ef'){
      const cnv=document.createElement('canvas');cnv.width=512;cnv.height=128;
      const g=cnv.getContext('2d');g.clearRect(0,0,512,128);g.fillStyle=color;
      g.font='700 40px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,66,490);
      const tex=new THREE.CanvasTexture(cnv);tex.colorSpace=THREE.SRGBColorSpace;
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
      sp.scale.set(size,.25*size,1);return sp;
    }
    function nametag(parent,name,x,y,z,w=1.6,color='#d3f7f2'){
      const sp=badge(name,w,color);sp.position.set(x,y,z);parent.add(sp);return sp;
    }
    const groups={};
    function group(key,x,z){
      const g=new THREE.Group();g.position.set(x,0,z);
      g.userData.part=key;groups[key]=g;root.add(g);return g;
    }
    const base=new THREE.Group();root.add(base);
    const acrylic=box(10,.18,6.65,glass,base,0,-.31,0);
    const edges=new THREE.EdgesGeometry(acrylic.geometry);
    const e=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0x70cad8,transparent:true,opacity:.56}));
    e.position.copy(acrylic.position);base.add(e);
    box(10.03,.025,6.69,m(0x2c5361,.75,.3),base,0,-.42,0);
    for(const x of [-4.66,4.66])for(const z of [-2.95,2.95]){
      cyl(.15,.15,.36,dark,base,x,-.61,z,24);
      cyl(.08,.08,.04,silver,base,x,-.21,z,16);
      cyl(.26,.26,.07,black,base,x,-.81,z,24);
    }
    // Engraved title plate, kept on top of the acrylic surface.
    box(2.55,.025,.45,m(0x073342,.65,.37),root,0,-.2,-2.91);
    nametag(root,'SIDQ / MIDA',0,.06,-2.91,2.25,'#8df7e5');
    const metalBase=m(0x516b7b,.8,.32);
    // 12V gear motor, mounted horizontally on central chassis.
    const mg=group('motor',-.15,-.05);
    box(3.2,.16,1.68,metalBase,mg,0,-.11,0);
    for(const x of [-1.25,1.25])for(const z of [-.54,.54]){
      cyl(.09,.09,.12,silver,mg,x,.05,z,16);
    }
    const barrel=cyl(.7,.7,2.13,m(0x7d9aa6,.87,.28),mg,-.12,.73,0,48);barrel.rotation.z=Math.PI/2;
    const cap=cyl(.73,.73,.19,m(0x9db3bc,.78,.3),mg,.99,.73,0,48);cap.rotation.z=Math.PI/2;
    const gearbox=cyl(.69,.69,.47,m(0x4d6a79,.83,.32),mg,-1.22,.73,0,48);gearbox.rotation.z=Math.PI/2;
    for(let i=0;i<13;i++){
      const a=i*Math.PI*2/13;
      const fin=box(1,.065,.095,m(0x304f60,.75,.35),mg,-.15,.73+Math.cos(a)*.7,Math.sin(a)*.7);
      fin.rotation.x=a;
    }
    const shaft=cyl(.075,.075,1.5,silver,mg,1.63,.73,0,18);shaft.rotation.z=Math.PI/2;
    const rotor=new THREE.Group();rotor.position.set(2.15,.73,0);mg.add(rotor);
    const disc=cyl(.56,.56,.07,m(0x526c76,.92,.24),rotor,0,0,0,48);disc.rotation.z=Math.PI/2;
    for(let i=0;i<16;i++){const a=i*Math.PI*2/16;const dot=cyl(.07,.07,.085,m(0x101e26,.8,.36),rotor,0,Math.sin(a)*.42,Math.cos(a)*.42,10);dot.rotation.z=Math.PI/2;}
    nametag(mg,'FIT0186 · 12V',-.2,1.78,0,2.25);
    // independent optical slot sensor adjacent to the motor disc
    const og=group('optical',2.17,-.71);
    box(.74,.12,.45,bluePcb,og,0,-.06,0);
    const slotA=box(.13,.65,.18,black,og,-.16,.28,.12);
    const slotB=box(.13,.65,.18,black,og,.16,.28,.12);
    nametag(og,'OPTICAL RPM',0,.83,0,1.55);
    // Servo and arm with rubber contact surface
    const sg=group('servo',2.32,1.33);
    box(1.02,.65,.63,m(0x203745,.35,.48),sg,0,.18,0);
    box(.43,.08,.34,silver,sg,-.1,.56,0);
    const arm=new THREE.Group();arm.position.set(-.1,.65,0);sg.add(arm);
    box(1.1,.08,.14,m(0xe0e5e8,.65,.3),arm,-.44,.02,-.1);
    box(.29,.17,.23,m(0x283039,.15,.76),arm,-.94,-.02,-.1);
    nametag(sg,'SERVO BRAKE',0,1.08,0,1.65);
    // Motor driver board
    function board(key,x,z,name,tint=pcb,w=1.8,d=1.3){
      const g=group(key,x,z);box(w,.09,d,tint,g,0,-.06,0);
      for(const side of [-1,1])for(let i=0;i<6;i++){
        box(.065,.13,.08,pin,g,-w*.37+i*w*.145,-.005,side*d*.44);
      }
      for(const xx of [-w*.43,w*.43])for(const zz of [-d*.39,d*.39]){
        cyl(.047,.047,.15,silver,g,xx,-.11,zz,10);
      }
      nametag(g,name,0,.58,0,Math.max(1.5,w*.94));
      return g;
    }
    const drv=board('driver',-3.07,.25,'MOTOR DRIVER',bluePcb,2.0,1.34);
    box(.63,.35,.44,m(0x171e27,.4,.48),drv,-.35,.14,0);
    box(.5,.27,.5,m(0x334954,.7,.38),drv,.47,.09,.03);
    for(let i=0;i<4;i++)box(.19,.24,.17,m(0x3d6f75,.5,.37),drv,-.75+i*.5,.08,-.43);
    const a=board('espA',-3.14,-1.78,'ESP32-A',pcb,2.12,1.17);
    const b=board('espB',3.05,-1.78,'ESP32-B',pcb,2.12,1.17);
    function espDetail(g){
      box(.75,.23,.61,m(0x233441,.35,.36),g,-.05,.12,-.04);
      box(.42,.19,.22,silver,g,-.84,.11,.02);
      for(let i=0;i<5;i++)box(.055,.06,.06,pin,g,.38+(i%2)*.24,.08,-.29+Math.floor(i/2)*.24);
    }
    espDetail(a);espDetail(b);
    const wg=board('watt',3.05,.12,'INA219',bluePcb,1.35,.87);
    box(.5,.21,.4,m(0x151b27,.35,.4),wg,-.08,.09,0);
    box(.27,.26,.2,m(0x3d7d7b,.5,.33),wg,.42,.08,.05);
    const ag=board('accel',-.36,1.62,'ADXL345',bluePcb,1.2,.86);
    box(.34,.13,.27,m(0x1a2834,.5,.45),ag,0,.08,0);
    const bg=board('buck',-3.13,1.63,'12V → 5V',bluePcb,1.65,1);
    box(.58,.37,.44,m(0x273b43,.65,.38),bg,.28,.17,0);
    cyl(.21,.21,.31,m(0x404e60,.55,.37),bg,-.43,.15,0,20);
    // power inlet, fuse and emergency stop: hardware controls mounted on acrylic
    const pg=group('power',-4.29,-1.38);
    box(.48,.33,.78,black,pg,0,.17,0);
    box(.14,.13,.38,silver,pg,-.15,.15,0);
    nametag(pg,'12V INPUT',0,.75,0,1.35);
    const fg=group('fuse',-4.18,.18);
    box(.55,.29,1.12,m(0x283d46,.4,.41),fg,0,.14,0);
    box(.24,.18,.69,m(0x964f45,.34,.45),fg,0,.35,0);
    nametag(fg,'FUSE',0,.75,0,.9);
    const eg=group('estop',-4.12,2.55);
    cyl(.45,.45,.12,m(0xefba5f,.58,.33),eg,0,.03,0,28);
    cyl(.32,.32,.28,m(0x702f31,.5,.35),eg,0,.22,0,28);
    const eHead=cyl(.42,.42,.18,m(0xd93d40,.3,.32),eg,0,.41,0,32);
    nametag(eg,'E-STOP',0,.91,0,1.2,'#ffb9b1');
    // Four front-panel scenario buttons, including realistic contact collar
    const buttons=new THREE.Group();buttons.userData.part='controls';root.add(buttons);
    const buttonColors=[0xd94947,0xf0bb4c,0x418fdb,0x38c488];
    const names=['FAULT','SPOOF','REPLAY','RESET'];
    const keys=['physical','spoof','replay','normal'];
    const buttonHeads=[];
    [-1.5,-.42,.67,1.74].forEach((x,i)=>{
      const g=new THREE.Group();g.position.set(x,0,2.73);g.userData.action=keys[i];g.userData.part='controls';buttons.add(g);
      cyl(.38,.38,.1,m(0x698591,.7,.3),g,0,-.02,0,28);
      const head=cyl(.28,.28,.19,m(buttonColors[i],.24,.35),g,0,.16,0,28);
      head.userData.buttonIndex=i;buttonHeads.push(head);
      nametag(g,names[i],0,.54,0,1.0,'#edf6f5');
    });
    // Status indicators
    const leds=[];
    for(let i=0;i<4;i++){
      const lamp=cyl(.095,.095,.045,m(0x6f8292,.2,.3,{emissive:0x091d25,emissiveIntensity:0}),root,2.93+i*.38,-.13,2.72,16);
      leds.push(lamp);
    }
    const physicalWire={
      power:[],reported:[],witness:[],logic:[]
    };
    function cable(kind,points,color,radius=.018){
      const route=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.2);
      const mat=new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.09});
      const tube=new THREE.Mesh(new THREE.TubeGeometry(route,46,radius,8,false),mat);
      tube.userData.wireKind=kind;root.add(tube);physicalWire[kind].push(tube);
      for(const v of [points[0],points[points.length-1]]){const node=ball(radius*1.65,mat,root,...v);physicalWire[kind].push(node);}
    }
    const cableY=.095;
    // Routes are representational pathways grouped by function rather than pin-to-pin wiring diagrams.
    cable('power',[[-4.2,.15,-1.1],[-4.45,cableY,-.68],[-4.43,cableY,.05],[-4.12,.38,.18]],0xed9266,.035);
    cable('power',[[-4.12,.38,.18],[-3.95,cableY,.76],[-3.62,cableY,.99],[-3.05,.3,.7]],0xeb9268,.034);
    cable('power',[[-4.05,.33,.18],[-3.9,cableY,.77],[-3.68,cableY,1.12],[-3.12,.28,1.55]],0xd97e59,.03);
    cable('power',[[-2.65,.23,.25],[-1.85,cableY,.4],[-1.34,cableY,.18],[-.7,.25,-.03]],0xe89a71,.03);
    cable('power',[[3.06,.13,.17],[3.55,cableY,.48],[3.6,cableY,1.09],[3.12,.14,1.31],[2.39,.23,1.33]],0xdf9b68,.023);
    cable('logic',[[-3.08,.25,1.65],[-3.6,cableY,1.18],[-3.9,cableY,-.58],[-3.11,.22,-1.6]],0x45d3c4,.021);
    cable('logic',[[-3.1,.25,1.64],[-1.76,cableY,2.08],[.3,cableY,2.17],[2.9,cableY,1.17],[3.08,.25,-1.6]],0x45c5b8,.022);
    cable('logic',[[-1.5,.18,2.68],[-2.06,cableY,2.19],[-2.4,cableY,1.1],[-3.04,.22,-1.72]],0x65d6b5,.015);
    cable('logic',[[-.42,.18,2.67],[-1.38,cableY,2.21],[-2.24,cableY,1.05],[-3.04,.23,-1.73]],0x65d6b5,.015);
    cable('logic',[[.68,.18,2.66],[.3,cableY,2.23],[-1.7,cableY,1.14],[-3.04,.23,-1.74]],0x65d6b5,.015);
    cable('logic',[[1.75,.18,2.69],[1.39,cableY,2.12],[-1.3,cableY,1.08],[-3.04,.23,-1.76]],0x65d6b5,.015);
    cable('reported',[[-1.18,.78,-.28],[-1.38,1.13,-1.2],[-2.15,.35,-1.6],[-3.1,.19,-1.77]],0xb89bf3,.025);
    cable('reported',[[-3.13,.26,-1.8],[-3.75,cableY,-.95],[-3.75,cableY,-.15],[-3.05,.28,.29]],0xa88cef,.016);
    cable('witness',[[2.17,.3,-.69],[2.35,.51,-1.22],[2.77,.28,-1.49],[3.06,.25,-1.79]],0xe9bd78,.023);
    cable('witness',[[3.07,.21,.13],[4.15,cableY,-.45],[4.11,cableY,-1.22],[3.06,.25,-1.77]],0xe9bd78,.02);
    cable('witness',[[-.35,.2,1.61],[.45,cableY,1.96],[2.11,cableY,.9],[3.46,cableY,-.95],[3.05,.24,-1.77]],0xe1b56b,.02);
    cable('witness',[[3.12,.21,-1.66],[3.92,cableY,-.37],[3.75,cableY,.98],[2.33,.23,1.3]],0xe6ba71,.018);
    // Highlight selected hardware on the acrylic plane
    const focusRing=new THREE.Mesh(new THREE.TorusGeometry(.76,.019,8,72),new THREE.MeshBasicMaterial({color:0x6df0dd,transparent:true,opacity:.78,depthWrite:false}));
    focusRing.rotation.x=Math.PI/2;focusRing.position.y=.06;root.add(focusRing);
    state.setFocus3D=(key)=>{
      if(key==='disc'){
        focusRing.position.set(2,.12,-.04);focusRing.scale.set(.67,.67,.67);
      }else if(key==='controls'){
        focusRing.position.set(.12,.11,2.7);focusRing.scale.set(2.05,.7,1);
      }else{
        const g=groups[key];
        if(g){focusRing.position.set(g.position.x,.09,g.position.z);focusRing.scale.set(key==='motor'?1.6:1,1,1);}
      }
    };
    state.setFocus3D(state.focus);
    state.showWireGroups=(key)=>{
      for(const [kind,items] of Object.entries(physicalWire)){
        const visible=key==='all'||kind===key;
        for(const obj of items)obj.visible=visible;
      }
    };
    state.showWireGroups(state.wireView);
    function setCameraPreset(v){
      const points={
        isometric:[10.5,10.5,13.6],
        top:[0,18.3,.05],
        front:[0,5.2,17.8],
        side:[17.7,5.4,0],
        exploded:[13,13,15]
      };
      const p=points[v]||points.isometric;
      cameraTransition={from:camera.position.clone(),to:new THREE.Vector3(...p),fromLook:orbit.target.clone(),toLook:new THREE.Vector3(0,.16,0),elapsed:0};
    }
    state.setCamera=setCameraPreset;
    function resize(){
      const w=wrap.clientWidth,h=wrap.clientHeight;
      if(!w||!h)return;
      renderer.setSize(w,h,false);
      camera.aspect=w/h;camera.updateProjectionMatrix();
    }
    window.addEventListener('resize',resize);resize();
    const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;ro?.observe(wrap);
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
    canvas.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
    canvas.addEventListener('pointerup',e=>{
      if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;
      const rect=canvas.getBoundingClientRect();
      pointer.x=(e.clientX-rect.left)/rect.width*2-1;
      pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
      ray.setFromCamera(pointer,camera);
      const hits=ray.intersectObjects(root.children,true);
      for(const hit of hits){
        let current=hit.object;
        while(current&&current!==root){
          if(current.userData.action){
            selectScenario(current.userData.action);
            choosePart('controls');
            return;
          }
          if(current.userData.part){
            if(current.userData.part==='estop')emergencyStop();
            choosePart(current.userData.part);
            return;
          }
          current=current.parent;
        }
      }
    });
    let realismLayer=null;
    try{
      const {createRealisticPresentation}=await import('./realism.js');
      realismLayer=await createRealisticPresentation({THREE,scene,root,groups,renderer,sun,rotor,focusRing,physicalWire});
      state.setVisualMode=mode=>realismLayer.setMode(mode);
      state.setVisualMode(state.visualMode);
    }catch(error){console.warn('Premium materials unavailable:',error);}
    let clock=0;
    state.drawScene=(dt,s)=>{
      clock+=dt;
      // UI-led rotation and scene presentation, independent of physical hardware.
      const speed=s.running&&!s.emergency&&s.power?Math.max(0,s.metrics.witness):0;
      rotor.rotation.x+=speed*.055*dt;
      arm.rotation.y=s.scenario==='physical'&&s.running?-.21:0;
      eHead.position.y=s.emergency?.34:.41;
      const lampColors=[0x3b6570,0x53e4d6,0x7ae6a4,0xe9bd78,0xfe857d];
      const mode=!s.power?0:s.emergency?4:s.challenge?3:s.running?2:1;
      leds.forEach((led,i)=>{
        const active=i===(mode===0?-1:Math.min(3,mode-1));
        led.material.emissive.setHex(active?lampColors[mode]:0x0a2329);
        led.material.emissiveIntensity=active?1.2:0.03;
      });
      buttonHeads.forEach((head,i)=>head.position.y=(s.scenario===keys[i]&&s.running)?.105:.16);
      focusRing.material.opacity=.57+Math.sin(clock*2.8)*.18;
      if(s.view==='exploded'){
        const animateOffset=dt*4;
        for(const [k,g] of Object.entries(groups)){
          const goal=['espA','espB','driver','watt','accel','buck','optical','servo','power','fuse'].includes(k)?.65:0;
          g.position.y+= (goal-g.position.y)*Math.min(1,animateOffset);
        }
      }else for(const g of Object.values(groups))g.position.y+=(0-g.position.y)*Math.min(1,dt*5);
      if(cameraTransition){
        cameraTransition.elapsed+=dt;
        const t=Math.min(1,cameraTransition.elapsed/.7),e=t*t*(3-2*t);
        camera.position.lerpVectors(cameraTransition.from,cameraTransition.to,e);
        orbit.target.lerpVectors(cameraTransition.fromLook,cameraTransition.toLook,e);
        if(t>=1)cameraTransition=null;
      }
      realismLayer?.update(dt,s);
      orbit.update();renderer.render(scene,camera);
    };
    state.drawScene(0,state);
  }catch(error){
    console.warn('3D renderer unavailable:',error);
    el('sceneCanvas').hidden=true;
    el('viewerFallback').hidden=false;
    el('viewerHint').hidden=true;
  }
}
initScene();
