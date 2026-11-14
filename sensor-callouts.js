/**
 * SIDQ — camera-accurate in-scene instrumentation.
 *
 * Sensor anchors are actual local points on the mounted components.
 * The same 3D-to-2D projection drives both the physical indicator dot
 * and the SVG connector. It runs AFTER camera/scene movement every frame.
 */
export function createSensorCallouts({THREE, camera, scene, groups, container, onSelect, getState}) {
  const layer=document.getElementById('sceneCallouts');
  if(!layer) return {update(){},refresh(){}};

  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.classList.add('sensor-lines');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  layer.append(svg);

  // Offsets are defined in the component's own local space, so anchors
  // also follow the board when that component is lifted in Exploded View.
  const sensors=[
    {key:'reported',title:'Reported RPM',source:'ESP32-A · HALL',unit:'RPM',part:'espA',at:[-.05,.337,-.04],side:'left',lane:0,tint:'#70ded3'},
    {key:'witness',title:'Witness RPM',source:'OPTICAL SENSOR',unit:'RPM',part:'optical',at:[0,.46,.12],side:'right',lane:0,tint:'#e2bf81'},
    {key:'current',title:'Current',source:'INA219',unit:'A',part:'watt',at:[-.08,.210,0],side:'right',lane:1,tint:'#7bd8b0'},
    {key:'vibration',title:'Vibration',source:'ADXL345',unit:'a.u.',part:'accel',at:[0,.159,0],side:'left',lane:1,tint:'#b9a4f3'}
  ];
  const projection=new THREE.Vector3();
  const world=new THREE.Vector3();
  const forward=new THREE.Vector3();
  const toward=new THREE.Vector3();
  const anchorObjects={};

  // Anchors are attached to the actual 3D assemblies, not kept as static
  // screen positions or unrelated world coordinates.
  for(const data of sensors){
    const parent=groups[data.part];
    if(!parent) continue;
    const node=new THREE.Object3D();
    node.name='SIDQ_SENSOR_ANCHOR_'+data.key;
    node.position.set(...data.at);
    parent.add(node);
    anchorObjects[data.key]=node;
  }

  function svgNode(tag,classes){
    const o=document.createElementNS(svgNS,tag);
    o.setAttribute('class',classes);
    o.setAttribute('aria-hidden','true');
    svg.append(o);
    return o;
  }
  const entries=sensors.map(data=>{
    const background=svgNode('path','sensor-connector-back');
    const line=svgNode('path','sensor-connector');
    line.setAttribute('stroke',data.tint);
    line.setAttribute('fill','none');
    const halo=svgNode('circle','sensor-anchor-halo');
    halo.setAttribute('stroke',data.tint);
    halo.setAttribute('fill','none');
    halo.setAttribute('r','7');
    const dot=svgNode('circle','sensor-anchor-pin');
    dot.setAttribute('fill',data.tint);
    dot.setAttribute('r','3.2');

    const button=document.createElement('button');
    button.type='button';
    button.className='sensor-readout';
    button.dataset.metric=data.key;
    button.style.setProperty('--metric-color',data.tint);
    button.setAttribute('aria-label','عرض '+data.title+' عند '+data.source);
    button.setAttribute('title','إظهار '+data.source+' داخل المجسم');
    button.innerHTML='<span class="sensor-readout-top"><span class="sensor-readout-led"></span><span class="sensor-readout-heading"></span></span>'+
      '<strong class="sensor-readout-number"><span class="sensor-readout-value">0</span><small class="sensor-readout-unit"></small></strong>'+
      '<span class="sensor-readout-source"></span>';
    button.querySelector('.sensor-readout-heading').textContent=data.title;
    button.querySelector('.sensor-readout-unit').textContent=data.unit;
    button.querySelector('.sensor-readout-source').textContent=data.source;
    button.addEventListener('click',()=>onSelect(data.part));
    layer.append(button);
    return {...data,button,background,line,halo,dot,value:button.querySelector('.sensor-readout-value'),lastY:null,visible:false};
  });

  const metricByFocus={
    espA:['reported'], espB:['witness','current','vibration'],
    optical:['witness'],disc:['witness'],watt:['current'],
    accel:['vibration'],driver:['current'],servo:['current','vibration']
  };
  const mobileToggle=document.getElementById('readoutToggle');
  let expanded=false;
  let forceReflow=true;
  if(mobileToggle){
    mobileToggle.addEventListener('click',()=>{
      expanded=!expanded;
      mobileToggle.setAttribute('aria-pressed',String(expanded));
      mobileToggle.textContent=expanded?'قراءات أساسية':'جميع القراءات';
      forceReflow=true;
    });
  }

  function importance(item,s){
    let weight=(item.key==='reported'||item.key==='witness')?3:1;
    if((metricByFocus[s.focus]||[]).includes(item.key))weight+=8;
    if(s.scenario==='physical' && (item.key==='current'||item.key==='vibration'))weight+=5;
    if((s.scenario==='spoof'||s.scenario==='replay') && (item.key==='reported'||item.key==='witness'))weight+=5;
    if(s.visualMode==='thermal' && (item.key==='current'||item.key==='vibration'))weight+=4;
    return weight;
  }
  function fmt(item,value){
    if(!Number.isFinite(value))return '—';
    return item.key==='reported'||item.key==='witness'?String(Math.round(value)):value.toFixed(2);
  }
  function visibleSet(s,width){
    if(width>=590||expanded)return new Set(entries.map(e=>e.key));
    // Stable sorting by value, with a deterministic tie-break.
    return new Set(entries.slice().sort((a,b)=>importance(b,s)-importance(a,s)||a.lane-b.lane).slice(0,2).map(e=>e.key));
  }

  function projectAnchor(item,width,height){
    const obj=anchorObjects[item.key];
    if(!obj)return null;
    obj.getWorldPosition(world);
    toward.copy(world).sub(camera.position);
    const distance=toward.dot(forward);
    if(!(distance>camera.near+.015))return null;
    projection.copy(world).project(camera);
    if(!Number.isFinite(projection.x)||!Number.isFinite(projection.y)||!Number.isFinite(projection.z))return null;
    if(projection.z<-.995||projection.z>.995)return null;
    const px=(projection.x*.5+.5)*width;
    const py=(1-(projection.y*.5+.5))*height;
    // Do not draw a line to a fictitious point when the sensor is offscreen.
    if(px < 2 || px > width-2 || py < 2 || py > height-2)return null;
    return {x:px,y:py};
  }

  function clamp(v,lo,hi){return Math.min(hi,Math.max(lo,v));}
  function hide(item){
    item.button.hidden=true;
    item.background.style.display='none';
    item.line.style.display='none';
    item.halo.style.display='none';
    item.dot.style.display='none';
    item.visible=false;
  }
  function show(item){
    item.button.hidden=false;
    item.background.style.display='';
    item.line.style.display='';
    item.halo.style.display='';
    item.dot.style.display='';
    item.visible=true;
  }

  let previousWidth=0,previousHeight=0,lastStateSignature='';
  function refresh(){forceReflow=true;}

  // Resolve non-overlapping positions for a fixed rail, preserving the
  // identity/order of the cards when the camera swings around the object.
  function solveRail(items,top,bottom,height,gap){
    items.sort((a,b)=>a.lane-b.lane);
    const available=Math.max(0,bottom-top-height);
    const minSpacing=height+gap;
    const positions=items.map(item=>clamp(item.anchor.y-height*.5,top,bottom-height));
    if(items.length===2){
      if(positions[1]<positions[0]+minSpacing){
        const mid=(positions[0]+positions[1]+height)/2;
        positions[0]=mid-height-gap/2-height/2;
        positions[1]=positions[0]+minSpacing;
      }
      if(positions[0]<top){
        const delta=top-positions[0];positions[0]+=delta;positions[1]+=delta;
      }
      if(positions[1]>bottom-height){
        const delta=positions[1]-(bottom-height);
        positions[0]-=delta;positions[1]-=delta;
      }
      // Very short landscape viewports retain a valid gap by splitting
      // available space rather than allowing the labels to overlap.
      if(available<minSpacing){positions[0]=top;positions[1]=top+available;}
    }else if(items.length===1){
      positions[0]=clamp(positions[0],top,bottom-height);
    }
    for(let i=0;i<items.length;i++)items[i].targetY=positions[i];
  }

  function update(dt=0,providedState){
    const s=providedState||getState();
    const width=container.clientWidth,height=container.clientHeight;
    if(!width||!height)return;
    const changedSize=width!==previousWidth||height!==previousHeight;
    if(changedSize){
      previousWidth=width;previousHeight=height;
      svg.setAttribute('viewBox','0 0 '+width+' '+height);
      svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
      forceReflow=true;
    }
    // Force world/camera matrices to reflect the exact rendered frame.
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);

    const active=visibleSet(s,width);
    const cardW=width<390?112:width<590?123:width<850?133:155;
    const cardH=width<390?57:width<590?61:69;
    const margin=width<390?8:width<590?10:16;
    const upper=width<590?91:105;
    const lower=height-(width<590?123:137);
    const gap=width<590?8:11;
    const minRoom=cardH*2+gap;
    const top=clamp(upper,5,Math.max(5,height-cardH-minRoom));
    const bottom=Math.max(top+cardH,lower);
    const visible=[];
    for(const item of entries){
      if(!active.has(item.key)){hide(item);continue;}
      const point=projectAnchor(item,width,height);
      if(!point){hide(item);continue;}
      show(item);
      item.anchor=point;
      const value=fmt(item,s.metrics[item.key]);
      if(item.value.textContent!==value)item.value.textContent=value;
      visible.push(item);
    }

    const left=visible.filter(item=>item.side==='left');
    const right=visible.filter(item=>item.side==='right');
    // When the selected pair occupies the same side on mobile, use both
    // rails; each sensor keeps its own anchor and original identity.
    const mobile=width<590;
    if(mobile&&visible.length===2&&(left.length===2||right.length===2)){
      left.length=0;right.length=0;
      const prioritized=visible.slice().sort((a,b)=>importance(b,s)-importance(a,s));
      left.push(prioritized[0]);right.push(prioritized[1]);
    }
    solveRail(left,top,bottom,cardH,gap);
    solveRail(right,top,bottom,cardH,gap);

    const focus=(metricByFocus[s.focus]||[]);
    const highlight=focus.length?focus:
      s.scenario==='physical'?['current','vibration']:
      s.scenario==='spoof'||s.scenario==='replay'?['reported','witness']:[];
    const signature=[s.focus,s.scenario,s.visualMode,active.size,width,height].join('|');
    if(signature!==lastStateSignature){lastStateSignature=signature;forceReflow=true;}
    const alpha=forceReflow?1:1-Math.exp(-Math.min(Math.max(dt,0),.1)*16);
    for(const [side,rail] of [['left',left],['right',right]]){
      for(const item of rail){
        const activeCard=highlight.includes(item.key);
        const muted=highlight.length>0&&!activeCard;
        item.lastY=item.lastY===null||forceReflow?item.targetY:item.lastY+(item.targetY-item.lastY)*alpha;
        const x=side==='left'?margin:width-cardW-margin;
        const y=item.lastY;
        const jointX=side==='left'?x+cardW:x;
        const jointY=y+cardH*.5;
        // Bent line terminates at the actual 3D sensor's projected position.
        // The card endpoint uses the same Y as the card, never a stale value.
        const direction=side==='left'?1:-1;
        const kneeX=jointX+direction*clamp(Math.abs(item.anchor.x-jointX)*.32,12,35);
        const path='M '+jointX.toFixed(2)+' '+jointY.toFixed(2)+
          ' L '+kneeX.toFixed(2)+' '+jointY.toFixed(2)+
          ' L '+item.anchor.x.toFixed(2)+' '+item.anchor.y.toFixed(2);
        item.button.style.width=cardW+'px';
        item.button.style.height=cardH+'px';
        item.button.style.transform='translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0)';
        item.button.classList.toggle('sensor-readout--active',activeCard);
        item.button.classList.toggle('sensor-readout--dim',muted);
        item.button.classList.toggle('sensor-readout--idle',!s.power||!s.running);
        item.background.setAttribute('d',path);
        item.background.setAttribute('opacity',muted?'.42':'.8');
        item.line.setAttribute('d',path);
        item.line.setAttribute('stroke-width',activeCard||s.visualMode==='technical'?'2':'1.45');
        item.line.setAttribute('opacity',muted?'.5':activeCard?'1':'.88');
        item.halo.setAttribute('cx',item.anchor.x.toFixed(2));
        item.halo.setAttribute('cy',item.anchor.y.toFixed(2));
        item.halo.setAttribute('opacity',activeCard?'.82':'.5');
        item.dot.setAttribute('cx',item.anchor.x.toFixed(2));
        item.dot.setAttribute('cy',item.anchor.y.toFixed(2));
      }
    }
    forceReflow=false;
  }
  update(0,getState());
  return {update,refresh};
}
