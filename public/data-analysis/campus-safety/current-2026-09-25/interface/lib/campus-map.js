/** Keep a geographic view within an aspect ratio, with space for clickable markers. */
export function fitMapView(box, aspect, padding = .12) {
  const [x,y,w,h]=box, cx=x+w/2, cy=y+h/2;
  let width=Math.max(w,1)*(1+padding*2), height=Math.max(h,1)*(1+padding*2);
  if(width/height<aspect)width=height*aspect;else height=width/aspect;
  return [cx-width/2,cy-height/2,width,height];
}

export function schoolMapBounds(schools) {
  const xs=schools.map(s=>s.x),ys=schools.map(s=>s.y);
  const left=Math.min(...xs),top=Math.min(...ys);
  return [left-20,top-20,Math.max(...xs)-left+40,Math.max(...ys)-top+40];
}

/** Nearby points share a chooser, preserving every school even at phone widths. */
export function clusterMapSchools(schools, box, width, height, distance=44) {
  const points=schools.map(s=>({...s,px:(s.x-box[0])/box[2]*width,py:(s.y-box[1])/box[3]*height}));
  const groups=points.map(p=>({schools:[p],x:p.px,y:p.py}));
  // Merge the closest visible markers, then recalculate their center before merging again.
  // This avoids a long chain of neighboring cities collapsing into one region-wide marker.
  while(true){
    let pair=null,nearest=distance;
    for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const gap=Math.hypot(groups[i].x-groups[j].x,groups[i].y-groups[j].y);
      if(gap<nearest){nearest=gap;pair=[i,j];}
    }
    if(!pair)break;
    const [i,j]=pair,members=[...groups[i].schools,...groups[j].schools];
    groups[i]={schools:members,x:members.reduce((n,p)=>n+p.px,0)/members.length,y:members.reduce((n,p)=>n+p.py,0)/members.length};
    groups.splice(j,1);
  }
  return groups;
}

export function createCampusMap(root, {onRegion,onSchool}) {
  const data=JSON.parse(root.querySelector('[data-map-data]').textContent);
  const stage=root.querySelector('[data-map-stage]'), svg=root.querySelector('[data-map-svg]');
  const heading=root.querySelector('[data-map-heading]'), reset=root.querySelector('[data-map-reset]');
  const markers=root.querySelector('[data-map-markers]'), labels=root.querySelector('[data-map-labels]');
  const status=root.querySelector('[data-map-status]'), nearby=root.querySelector('[data-map-nearby]');
  let current={region:'all',selected:'',matchIds:[],filtered:false};
  const button=(name,action)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',action);return b;};
  function chooseRegion(id){onRegion(id);heading.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'auto'});}
  root.querySelectorAll('[data-map-region]').forEach(el=>el.addEventListener('click',()=>chooseRegion(el.dataset.mapRegion)));
  reset.addEventListener('click',()=>chooseRegion('all'));
  function draw(){
    const selected=data.schools.find(s=>s.id===current.selected);
    const matchingRegions=[...new Set(data.schools.filter(s=>current.matchIds.includes(s.id)).map(s=>s.region))];
    const regionId=current.filtered?(matchingRegions.length===1?matchingRegions[0]:'all'):current.region==='all'&&selected?selected.region:current.region;
    const region=data.regions.find(r=>r.id===regionId);
    const regionalSchools=data.schools.filter(s=>s.region===regionId);
    const width=stage.clientWidth, height=stage.clientHeight;if(!width||!height)return;
    const national=fitMapView(data.viewBox,width/height,0);
    const box=region?fitMapView(schoolMapBounds(regionalSchools),width/height):national;
    svg.setAttribute('viewBox',box.join(' '));
    root.dataset.focused=String(!!region);heading.textContent=region?`${region.name} · ${region.schoolCount} schools`:'Choose a region';
    reset.hidden=!region;labels.hidden=!!region;
    // National labels use the same fitted coordinates as the geography at every width.
    const compactLabels={West:[.23,.42],Midwest:[.55,.50],Northeast:[.82,.17],South:[.66,.80]};
    labels.querySelectorAll('[data-map-region]').forEach(b=>{
      const r=data.regions.find(r=>r.id===b.dataset.mapRegion),half=b.offsetWidth/2+4;
      const anchor=width<360?compactLabels[r.id]:[(r.label[0]-box[0])/box[2],(r.label[1]-box[1])/box[3]];
      b.style.left=`${Math.max(half,Math.min(width-half,anchor[0]*width))}px`;b.style.top=`${anchor[1]*100}%`;
    });
    root.querySelectorAll('svg [data-map-region]').forEach(g=>{g.classList.toggle('is-current',g.dataset.mapRegion===regionId);g.classList.toggle('is-muted',!!region&&g.dataset.mapRegion!==regionId);});
    const stateLabels=root.querySelector('[data-map-state-labels]');stateLabels.toggleAttribute('hidden',!region);
    stateLabels.style.fontSize=`${box[2]/width*11}px`;
    stateLabels.querySelectorAll('text').forEach(t=>t.style.display=t.dataset.mapStateRegion===regionId?'':'none');
    markers.replaceChildren();
    if(!region){status.textContent=current.filtered?(current.matchIds.length?`${current.matchIds.length} ${current.matchIds.length===1?'school matches':'schools match'}. Select a school from the results below, or choose a region to browse.`:'No schools match this search. Try another name or choose a region.'):'Select a region to see its schools.';return;}
    const schools=data.schools.filter(s=>s.region===regionId&&(!current.filtered||current.matchIds.includes(s.id)));
    const groups=clusterMapSchools(schools,box,width,height);
    status.textContent=schools.length?`${schools.length} ${schools.length===1?'school':'schools'} shown. Select a dot for a school; numbered markers open a choice of nearby schools.`:'No schools match this search in the selected region.';
    groups.forEach(group=>{
      const members=group.schools.sort((a,b)=>a.officialName.localeCompare(b.officialName));
      const multiple=members.length>1;
      const b=button(multiple?String(members.length):'',()=>{
        if(!multiple){onSchool(members[0].id);return;}
        nearby.replaceChildren();nearby.hidden=false;
        const title=document.createElement('p');title.textContent='Choose a nearby school';nearby.append(title);
        members.forEach(s=>nearby.append(button(s.officialName,()=>onSchool(s.id))));
        nearby.querySelector('button').focus({preventScroll:true});nearby.scrollIntoView({block:'nearest',behavior:'auto'});
      });
      const names=members.map(s=>s.officialName).join('; ');
      b.className='campus-map-marker';b.style.left=`${group.x/width*100}%`;b.style.top=`${group.y/height*100}%`;
      b.setAttribute('aria-label',multiple?`Choose among ${members.length} nearby schools: ${names}`:`Select ${names}`);
      b.title=names;b.dataset.schoolIds=members.map(s=>s.id).join(',');
      b.setAttribute('aria-pressed',String(members.some(s=>s.id===current.selected)));
      const tooltip=document.createElement('span');tooltip.className='campus-map-tooltip';tooltip.textContent=multiple?`${members.length} nearby schools`:members[0].officialName;b.append(tooltip);
      markers.append(b);
    });
  }
  const observer=new ResizeObserver(draw);observer.observe(stage);
  return {update(state){current=state;nearby.replaceChildren();nearby.hidden=true;draw();}};
}
