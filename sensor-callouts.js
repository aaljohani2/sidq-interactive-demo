/**
 * SIDQ in-scene sensor annotations.
 * Each annotation follows a physical anchor through camera orbit, zoom,
 * perspective presets and exploded views. Cards are arranged to avoid overlap.
 */
export function createSensorCallouts({THREE, camera, scene, groups, container, onSelect, getState}) {
  const layer = document.getElementById('sceneCallouts');
  if (!layer) return {update() {}, refresh() {}};

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'sensor-lines');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  layer.append(svg);

  const metrics = [
    {key:'reported', title:'Reported RPM', source:'ESP32-A · HALL', unit:'RPM', part:'espA', tint:'#70ded3', y:.25, color:'teal'},
    {key:'witness', title:'Witness RPM', source:'OPTICAL SENSOR', unit:'RPM', part:'optical', tint:'#e2bf81', y:.35, color:'amber'},
    {key:'current', title:'Current', source:'INA219', unit:'A', part:'watt', tint:'#7bd8b0', y:.25, color:'green'},
    {key:'vibration', title:'Vibration', source:'ADXL345', unit:'a.u.', part:'accel', tint:'#b9a4f3', y:.19, color:'violet'}
  ];

  const entries = metrics.map(metric => {
    const pathBack = document.createElementNS(ns, 'path');
    pathBack.setAttribute('class', 'sensor-connector-back');
    pathBack.setAttribute('fill', 'none');
    svg.append(pathBack);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'sensor-connector');
    path.setAttribute('stroke', metric.tint);
    path.setAttribute('fill', 'none');
    svg.append(path);

    const halo = document.createElementNS(ns, 'circle');
    halo.setAttribute('class','sensor-anchor-halo');
    halo.setAttribute('stroke',metric.tint);
    halo.setAttribute('fill','none');
    halo.setAttribute('r','7');
    svg.append(halo);

    const pin = document.createElementNS(ns,'circle');
    pin.setAttribute('class','sensor-anchor-pin');
    pin.setAttribute('fill',metric.tint);
    pin.setAttribute('r','3.2');
    svg.append(pin);

    const button = document.createElement('button');
    button.type='button';
    button.className='sensor-readout';
    button.setAttribute('data-metric',metric.key);
    button.setAttribute('title','إظهار ' + metric.source + ' داخل المجسم');
    button.setAttribute('aria-label', 'عرض ' + metric.title + ' عند ' + metric.source);
    button.style.setProperty('--metric-color',metric.tint);
    button.innerHTML = '<span class="sensor-readout-top"><span class="sensor-readout-led"></span><span class="sensor-readout-heading"></span></span>' +
      '<strong class="sensor-readout-number"><span class="sensor-readout-value">0</span><small class="sensor-readout-unit"></small></strong>' +
      '<span class="sensor-readout-source"></span>';
    button.querySelector('.sensor-readout-heading').textContent = metric.title;
    button.querySelector('.sensor-readout-unit').textContent = metric.unit;
    button.querySelector('.sensor-readout-source').textContent = metric.source;
    button.addEventListener('click', () => onSelect(metric.part));
    layer.append(button);
    return {...metric,button,pathBack,path,halo,pin,value:button.querySelector('.sensor-readout-value')};
  });

  // The mode toggle is available on narrower screens, where a compact,
  // context-sensitive subset preserves space around the actual prototype.
  const toggle = document.getElementById('readoutToggle');
  let expanded = false;
  if (toggle) {
    toggle.addEventListener('click',()=>{
      expanded=!expanded;
      toggle.setAttribute('aria-pressed',String(expanded));
      toggle.textContent=expanded?'قراءات أساسية':'جميع القراءات';
      refresh();
    });
  }

  const projection = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();
  let previousWidth=0;
  let previousHeight=0;
  let accumulated=0;

  const focusMetrics = {
    espA:['reported'], espB:['witness','current','vibration'],
    optical:['witness'], disc:['witness'], watt:['current'], accel:['vibration'],
    driver:['current'], servo:['current','vibration']
  };

  function importance(entry, state) {
    let score=0;
    if (entry.key==='reported'||entry.key==='witness') score+=3;
    else score+=1;
    if ((focusMetrics[state.focus]||[]).includes(entry.key)) score+=7;
    if (state.scenario==='physical' && (entry.key==='current'||entry.key==='vibration')) score+=5;
    if ((state.scenario==='spoof'||state.scenario==='replay') && (entry.key==='reported'||entry.key==='witness')) score+=5;
    if (state.visualMode==='thermal' && (entry.key==='current'||entry.key==='vibration')) score+=4;
    return score;
  }

  function formatMetric(metric, value) {
    if (!Number.isFinite(value)) return '—';
    if (metric.key==='reported'||metric.key==='witness') return String(Math.round(value));
    return value.toFixed(2);
  }

  function positionOnScreen(item, width, height) {
    const object = groups[item.part];
    if (!object) return null;
    // Use local-to-world so vertical exploded offsets are always respected.
    object.updateWorldMatrix(true, false);
    worldPoint.set(0,item.y,0);
    object.localToWorld(worldPoint);
    projection.copy(worldPoint).project(camera);
    if (!Number.isFinite(projection.x)||!Number.isFinite(projection.y)) return null;
    const x = (projection.x*.5+.5)*width;
    const y = (1-(projection.y*.5+.5))*height;
    return {x,y, inView: projection.z>=-1 && projection.z<=1 &&
       x>=-16 && x<=width+16 && y>=-16 && y<=height+16};
  }

  function solveY(items,top,bottom,cardH,gap) {
    const sorted=items.slice().sort((a,b)=>a.anchor.y-b.anchor.y);
    const maxY=Math.max(top,bottom-cardH);
    const positions=[];
    for(let i=0;i<sorted.length;i++){
      const remaining=sorted.length-i-1;
      const maxForThis=Math.max(top,maxY-remaining*(cardH+gap));
      let y=Math.max(top,Math.min(sorted[i].anchor.y-cardH*.5,maxForThis));
      if(i) y=Math.max(y,positions[i-1]+cardH+gap);
      positions.push(Math.min(maxY,y));
    }
    return sorted.map((item,i)=>({...item,cardY:positions[i]}));
  }

  function refresh() { accumulated=999; }
  function update(dt=0, stateOverride=null) {
    accumulated+=dt;
    if(accumulated<.035) return;
    accumulated=0;
    const state=stateOverride||getState();
    const width=container.clientWidth,height=container.clientHeight;
    if(!width||!height)return;
    if(width!==previousWidth||height!==previousHeight){
      previousWidth=width;previousHeight=height;
      svg.setAttribute('viewBox','0 0 '+width+' '+height);
      svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
    }
    const mobile=width<590;
    const compact=width<390;
    const showAll=!mobile || expanded;
    const prioritized=entries.slice().sort((a,b)=>importance(b,state)-importance(a,state));
    const selected=showAll?entries:prioritized.slice(0,2);
    const visible=new Set(selected.map(item=>item.key));
    // Reserve space for the canvas HUD and the component-details plate.
    const cardW=compact?112:mobile?123:width<850?133:155;
    const cardH=compact?57:mobile?61:69;
    const margin=compact?8:mobile?10:16;
    const top=mobile?92:104;
    const bottom=height-(mobile?127:143);
    const gap=mobile?8:12;
    const results=[];
    camera.updateMatrixWorld();
    for(const entry of entries) {
      const isVisible=visible.has(entry.key);
      entry.button.hidden=!isVisible;
      entry.pathBack.style.display=isVisible?'':'none';
      entry.path.style.display=isVisible?'':'none';
      entry.halo.style.display=isVisible?'':'none';
      entry.pin.style.display=isVisible?'':'none';
      if(!isVisible)continue;
      const anchor=positionOnScreen(entry,width,height);
      if(!anchor||!anchor.inView){
        entry.button.hidden=true;
        entry.pathBack.style.display='none';entry.path.style.display='none';entry.halo.style.display='none';entry.pin.style.display='none';
        continue;
      }
      results.push({...entry,anchor});
      const value=state.metrics[entry.key];
      const display=formatMetric(entry,value);
      if(entry.value.textContent!==display)entry.value.textContent=display;
    }
    // Two cards per side for balanced composition, regardless of camera angle.
    const sorted=results.slice().sort((a,b)=>a.anchor.x-b.anchor.x);
    const left=sorted.slice(0,Math.ceil(sorted.length/2));
    const right=sorted.slice(Math.ceil(sorted.length/2));
    const final=[
      ...solveY(left,top,bottom,cardH,gap).map(a=>({...a,side:'left'})),
      ...solveY(right,top,bottom,cardH,gap).map(a=>({...a,side:'right'}))
    ];
    const activeKeys=focusMetrics[state.focus]||[];
    const highlights=activeKeys.length?activeKeys:
      state.scenario==='physical'?['current','vibration']:
      state.scenario==='spoof'||state.scenario==='replay'?['reported','witness']:[];
    for(const item of final){
      const focus=highlights.includes(item.key);
      const dimmed=highlights.length>0&&!focus;
      const x=item.side==='left'?margin:width-cardW-margin;
      const y=item.cardY;
      const sx=item.side==='left'?x+cardW:x;
      const sy=y+cardH*.5;
      const bend= item.side==='left' ? Math.min(sx+28,(sx+item.anchor.x)/2) : Math.max(sx-28,(sx+item.anchor.x)/2);
      const pathD='M '+sx.toFixed(1)+' '+sy.toFixed(1)+' L '+bend.toFixed(1)+' '+sy.toFixed(1)+
        ' L '+item.anchor.x.toFixed(1)+' '+item.anchor.y.toFixed(1);
      item.button.style.width=cardW+'px';
      item.button.style.height=cardH+'px';
      item.button.style.transform='translate3d('+Math.round(x)+'px,'+Math.round(y)+'px,0)';
      item.button.classList.toggle('sensor-readout--active',focus);
      item.button.classList.toggle('sensor-readout--dim',dimmed);
      item.button.classList.toggle('sensor-readout--idle',!state.power||!state.running);
      item.pathBack.setAttribute('d',pathD);
      item.pathBack.setAttribute('opacity',dimmed?'.36':'.78');
      item.path.setAttribute('d',pathD);
      item.path.setAttribute('stroke-width',focus||state.visualMode==='technical'?'2':'1.35');
      item.path.setAttribute('opacity',dimmed?'.42':focus?'1':'.78');
      item.halo.setAttribute('cx',String(item.anchor.x));item.halo.setAttribute('cy',String(item.anchor.y));
      item.halo.setAttribute('opacity',focus?'.75':'.38');
      item.pin.setAttribute('cx',String(item.anchor.x));item.pin.setAttribute('cy',String(item.anchor.y));
    }
  }

  refresh();
  return {update,refresh};
}
