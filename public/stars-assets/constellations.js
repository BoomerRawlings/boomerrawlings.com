/* Temporary display poses over the unchanged ambient simulation. No inferred stars/edges. */
(function(root){
 'use strict';
 var font='300 12px "Segoe UI", sans-serif',tracking=1.6,padding=24,exitTime=1,lockTime=.56,maxActive=5;
 var rare='Ant Cae Cir For Hor Men Mic Nor Oct Pic Pyx Ret Scl Sct Sex Tel'.split(' ');
 var ordinary='Aps Cha Dor Gru Hyi Ind Lac LMi Lyn Mus Pav Tuc Vol Vul'.split(' ');
 function weight(pattern){var p=typeof pattern==='string'?(root.ScrippsConstellationData||[]).find(function(p){return p.id===pattern;}):pattern,id=p?p.id:pattern,n=p?p.stars.length:4;
  return (rare.indexOf(id)>=0?0.25:ordinary.indexOf(id)>=0?2:8)*(n<=2?.015:n===3?.08:n>=5?1.2:1);}
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function smooth(t){t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);}
 function overlap(a,b,gap){gap=gap||0;return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
 function union(a,b){var x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x:x,y:y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};}
 function expand(r,n){return {x:r.x-n,y:r.y-n,w:r.w+2*n,h:r.h+2*n};}
 function cross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
 function hull(points){
  var p=points.slice().sort(function(a,b){return a.x-b.x||a.y-b.y;}),lo=[],hi=[];
  p.forEach(function(q){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);});
  p.slice().reverse().forEach(function(q){while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],q)<=0)hi.pop();hi.push(q);});
  return lo.slice(0,-1).concat(hi.slice(0,-1));
 }
 function pointSegment(p,a,b){var dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/d,0,1):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
 function pointRegion(p,poly){
  var inside=poly.length>2,d=Infinity;for(var i=0;i<poly.length;i++){var a=poly[i],b=poly[(i+1)%poly.length];if(cross(a,b,p)<-1e-7)inside=false;d=Math.min(d,pointSegment(p,a,b));}return inside?0:d;
 }
 function segmentDistance(a,b,c,d){
  if(Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.min(a.x,b.x)<=Math.max(c.x,d.x)&&Math.max(a.y,b.y)>=Math.min(c.y,d.y)&&Math.min(a.y,b.y)<=Math.max(c.y,d.y)&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return 0;
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
 }
 function segmentRegion(a,b,poly){var d=Math.min(pointRegion(a,poly),pointRegion(b,poly));for(var i=0;d>0&&i<poly.length;i++)d=Math.min(d,segmentDistance(a,b,poly[i],poly[(i+1)%poly.length]));return d;}
 function rectangle(r){return [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];}
 function scanBand(g,frame){
  var age=(frame.motion-g.snapMotion)*1000,transition=g.phase==='exit'||g.phase==='hold'&&age<lockTime*1000;
  if(g.phase==='exit')age=g.exitAge;else if(g.phase!=='hold')return null;
  if(!transition){age=(age-lockTime*1000)%(3000+(g.id%4)*260);if(age>=420)return null;}
  if(transition&&age>=lockTime*1000)return null;
  var direction=g.phase==='exit'?g.exitDirection:g.entryDirection,axis=direction%2?'y':'x',sign=direction<2?1:-1,b=g.clearance.box;
  var extent=axis==='x'?b.w:b.h,start=b[axis]+(sign>0?-14:extent+14),span=extent+28;
  return {axis:axis,sign:sign,age:age,start:start,span:span,position:start+sign*span*Math.min(1,age/420),half:transition?10:3,offset:Math.sin(age*.13)*(transition?1.4:.28),transition:transition};
 }
 function strip(a,b,top,bottom,axis){
  var delta=b[axis]-a[axis];if(Math.abs(delta)<1e-8)return a[axis]>=top&&a[axis]<=bottom?[a,b]:null;
  var t0=(top-a[axis])/delta,t1=(bottom-a[axis])/delta,lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(1,Math.max(t0,t1));
  return lo<=hi?[{x:a.x+(b.x-a.x)*lo,y:a.y+(b.y-a.y)*lo},{x:a.x+(b.x-a.x)*hi,y:a.y+(b.y-a.y)*hi}]:null;
 }
 function arrival(g,x,y,direction){var axis=direction%2?'y':'x',sign=direction<2?1:-1,b=g.clearance.box,extent=axis==='x'?b.w:b.h,start=b[axis]+(sign>0?-14:extent+14);return clamp(sign*((axis==='x'?x:y)-start)/(extent+28),0,1)*420;}
 function pieces(g,a,b){
  if(g.phase!=='exit')return [[a,b]];
  var began=arrival(g,(a.x+b.x)/2,(a.y+b.y)/2,g.exitDirection),t=smooth((g.exitAge-began)/400);if(t>=1)return [];
  var f=(1-t)*.5;return [[a,{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f}],[b,{x:b.x+(a.x-b.x)*f,y:b.y+(a.y-b.y)*f}]];
 }
 function fold(v,span){v=((v%(span*2))+span*2)%(span*2);return v<=span?v:2*span-v;}
 function labelInfo(pattern,ctx){
  var old=ctx.font;ctx.font=font;var value=pattern.name.toUpperCase(),width=value.split('').reduce(function(sum,ch){return sum+ctx.measureText(ch).width;},0)+Math.max(0,value.length-1)*tracking;ctx.font=old;
  return {text:value,width:width};
 }
 function bounds(points,label,radius){
  var xs=points.map(function(p){return p.x;}),ys=points.map(function(p){return p.y;});
  var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys),cx=(x0+x1)/2;
  var text={x:cx-label.width/2-4,y:y1+radius+14,w:label.width+8,h:27};
  return {box:union(expand({x:x0,y:y0,w:x1-x0,h:y1-y0},radius+4),text),label:text,baseline:y1+radius+29};
 }
 function obstacles(){
  var list=[];
  if(root.clockBounds){var c=root.clockBounds,s=c.h/90;list.push(expand({x:c.x,y:c.y,w:Math.max(c.w,320*s),h:Math.max(c.h,164*s)},28));}
  if(root.scrippsBounds)list.push(expand(root.scrippsBounds,28));
  if(root.reminderBounds)list.push(expand(root.reminderBounds,28));
  return list;
 }
 function safe(r,w,h,ui,others){
  return r.x>=padding&&r.y>=padding&&r.x+r.w<=w-padding&&r.y+r.h<=h-padding&&
   !ui.some(function(o){return overlap(r,o);})&&!others.some(function(o){return overlap(r,o,30);});
 }
 // Rectangular minimum-cost assignment, one existing dot per catalog star.
 function assign(targets,pool){
  var n=targets.length,m=pool.length;if(n>m)return null;
  var u=new Float64Array(n+1),v=new Float64Array(m+1),p=new Int32Array(m+1),way=new Int32Array(m+1);
  for(var i=1;i<=n;i++){
   p[0]=i;var j0=0,min=new Float64Array(m+1),used=new Uint8Array(m+1);min.fill(Infinity);
   do{used[j0]=1;var i0=p[j0],delta=Infinity,j1=0;
    for(var j=1;j<=m;j++)if(!used[j]){var dx=targets[i0-1].x-pool[j-1].x,dy=targets[i0-1].y-pool[j-1].y,cur=dx*dx+dy*dy-u[i0]-v[j];
     if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}
    for(var k=0;k<=m;k++)if(used[k]){u[p[k]]+=delta;v[k]-=delta;}else min[k]-=delta;
    j0=j1;
   }while(p[j0]);
   do{var prev=way[j0];p[j0]=p[prev];j0=prev;}while(j0);
  }
  var result=new Array(n);for(var col=1;col<=m;col++)if(p[col])result[p[col]-1]=col-1;return result;
 }
 function transform(pattern,size,angle,cx,cy){var c=Math.cos(angle),s=Math.sin(angle);return pattern.stars.map(function(p){return {x:cx+size*(p.x*c-p.y*s),y:cy+size*(p.x*s+p.y*c)};});}
 function refine(pattern,pool,indices,lo,hi){
  var px=0,py=0,qx=0,qy=0,n=indices.length;
  pattern.stars.forEach(function(s,i){px+=s.x/n;py+=s.y/n;qx+=pool[indices[i]].x/n;qy+=pool[indices[i]].y/n;});
  var a=0,b=0,den=0;pattern.stars.forEach(function(s,i){var x=s.x-px,y=s.y-py,q=pool[indices[i]],xx=q.x-qx,yy=q.y-qy;a+=x*xx+y*yy;b+=x*yy-y*xx;den+=x*x+y*y;});
  var angle=Math.atan2(b,a),size=clamp(Math.hypot(a,b)/den,lo,hi),c=Math.cos(angle),s=Math.sin(angle);
  return transform(pattern,size,angle,qx-size*(px*c-py*s),qy-size*(px*s+py*c));
 }
 function create(options){
  options=options||{};var data=options.data||root.ScrippsConstellationData||[],random=options.random||Math.random;
  var active=[],tails=[],recent=[],next=null,job=null,lastMotion=null,lastNow=null,viewport='',enabled=true,serial=0;
  var stats={attempts:0,accepted:0,completed:0,safetyDismissals:0,maxActive:0},range=options.interval||[60,180];
  var cadence=Number.isFinite(options.cadence)?clamp(options.cadence,10,60):null,lastLock=null;
  function between(a,b){return a+(b-a)*random();}
  function pick(){var allowed=data.filter(function(p){return recent.indexOf(p.id)<0&&!active.some(function(g){return g.pattern.id===p.id;});});
   if(!allowed.length)return null;var total=allowed.reduce(function(s,p){return s+weight(p);},0),r=random()*total;
   for(var i=0;i<allowed.length;i++){r-=weight(allowed[i]);if(r<0)return allowed[i];}return allowed[allowed.length-1];}
  function others(){return active.map(function(g){return g.reservation;});}
  function poolFor(particles,lead,w,h){
   var busy=new Set();active.forEach(function(g){g.indices.forEach(function(i){busy.add(i);});});tails.forEach(function(t){busy.add(t.index);});
   return particles.map(function(p,i){return {index:i,x:fold(p.x+p.dx*p.speed*lead,w),y:fold(p.y+p.dy*p.speed*lead,h)};}).filter(function(p){return !busy.has(p.index)&&particles[p.index].speed<35;});
  }
  function candidate(pattern,particles,w,h,ctx,proposal){
   if(!pattern||pattern.stars.length<2)return null;
   var n=pattern.stars.length,size=proposal?proposal.size:Math.min(Math.min(w,h)*0.80,150+n*27)*between(.88,1.12);
   if(size<100)return null;
   var pool=poolFor(particles,9,w,h);if(pool.length<n+6)return null;
   var point=pool[Math.floor(random()*pool.length)],cx=proposal?proposal.x:point.x,cy=proposal?proposal.y:point.y,angle=proposal?proposal.angle:between(-Math.PI,Math.PI);
   var label=labelInfo(pattern,ctx),ui=obstacles(),targets,indices;
   if(!proposal){
    var local=bounds(transform(pattern,size,angle,0,0),label,6).box,clear=false;
    for(var trial=0;trial<8;trial++){
     point=pool[Math.floor(random()*pool.length)];cx=clamp(point.x,padding-local.x,w-padding-local.x-local.w);cy=clamp(point.y,padding-local.y,h-padding-local.y-local.h);
     if(safe({x:cx+local.x,y:cy+local.y,w:local.w,h:local.h},w,h,ui,others())){clear=true;break;}
    }
    if(!clear)return null;
   }
   targets=transform(pattern,size,angle,cx,cy);
   for(var pass=0;pass<3;pass++){indices=assign(targets,pool);if(!indices)return null;if(pass<2)targets=refine(pattern,pool,indices,size*.9,size*1.1);}
   var current=indices.map(function(i){var p=particles[pool[i].index];return {x:p.x,y:p.y};});
   var radius=Math.max.apply(null,indices.map(function(i){return particles[pool[i].index].radius||3;}));
   var end=bounds(targets,label,radius),start=bounds(current,label,radius),reservation=union(start.box,end.box);
   if(!safe(reservation,w,h,ui,others()))return null;
   var sum=0,max=0,startMax=0;indices.forEach(function(i,k){var d=Math.hypot(targets[k].x-pool[i].x,targets[k].y-pool[i].y);sum+=d*d;max=Math.max(max,d);startMax=Math.max(startMax,Math.hypot(targets[k].x-current[k].x,targets[k].y-current[k].y));});
   var rms=Math.sqrt(sum/n);
   if(max>Math.min(210,45+n*6)||rms>Math.min(115,22+n*3.2)||startMax>260)return null;
   return {pattern:pattern,indices:indices.map(function(i){return pool[i].index;}),targets:targets,label:label,reservation:reservation,fitRms:rms,maxDisplacement:startMax};
  }
  function admit(c,particles,frame,w,h,ctx){
   if(!enabled||!c||active.length>=maxActive||recent.indexOf(c.pattern.id)>=0||active.some(function(g){return g.pattern.id===c.pattern.id;}))return false;
   var busy=new Set();active.forEach(function(g){g.indices.forEach(function(i){busy.add(i);});});tails.forEach(function(t){busy.add(t.index);});
   if(c.indices.length!==c.pattern.stars.length||new Set(c.indices).size!==c.indices.length||c.indices.some(function(i){return busy.has(i)||!particles[i];}))return false;
   var radius=Math.max.apply(null,c.indices.map(function(i){return particles[i].radius||3;}));
   c.reservation=union(bounds(c.targets,c.label,radius).box,bounds(c.indices.map(function(i){return particles[i];}),c.label,radius).box);
   if(!safe(c.reservation,w,h,obstacles(),others()))return false;
   var clear=bounds(c.targets,c.label,radius);c.clearance={hull:hull(c.targets),label:rectangle(clear.label),box:clear.box,outer:expand(clear.box,40)};
   // The shared sweep begins at the clock; this group locks when it reaches its area.
   var scan=170+clamp((c.reservation.y+c.reservation.h*.5)/h,0,1)*620+clamp((c.reservation.x+c.reservation.w*.5)/w,0,1)*70;
   var approach=cadence?cadence*1000:Math.max(14000,Math.min(32000,c.maxDisplacement/8*1000));
   // Browser cadence spaces actual locks, rather than batching them on30-second scans.
   var snapEpoch=cadence?Math.max(frame.now+approach,lastLock===null?0:lastLock+cadence*1000)-scan:Math.ceil((frame.now+between(approach,approach+8000))/30000)*30000;
   lastLock=snapEpoch+scan;
   c.start=frame.motion;c.snapMotion=frame.motion+(snapEpoch+scan-frame.now)/1000;c.snapEpoch=snapEpoch;c.hold=between(15,20)+lockTime;c.id=++serial;c.radius=radius;c.phase='gather';c.visible=0;
   c.entryDirection=Math.floor(random()*4);c.exitDirection=Math.floor(random()*4);
   active.push(c);recent.push(c.pattern.id);if(recent.length>8)recent.shift();stats.accepted++;stats.maxActive=Math.max(stats.maxActive,active.length);
   next=frame.motion+(cadence|| (active.length<maxActive&&random()<.14?between(8,16):between(range[0],range[1])));job=null;return true;
  }
  function tail(g,particles,points){g.indices.forEach(function(index,i){var p=particles[index],q=g.display?g.display[i]:g.targets[i];tails.push({index:index,x:q.x,y:q.y,bx:p.x,by:p.y,age:0});if(points){points[index].x=q.x;points[index].y=q.y;points[index].link=0;}});}
  function reset(){active=[];tails=[];job=null;next=null;lastMotion=lastNow=null;lastLock=null;viewport='';}
  function prepare(particles,frame,w,h,ctx){
   var dt=clamp(frame.dt||0,0,.1),key=w+'x'+h;
   if(viewport&&viewport!==key)reset();viewport=key;
   if(lastMotion!==null&&(frame.motion<lastMotion||frame.motion-lastMotion>1||Math.abs((frame.now-lastNow)/1000-(frame.motion-lastMotion))>2))reset();lastMotion=frame.motion;lastNow=frame.now;
   var points=particles.map(function(p){return {x:p.x,y:p.y,radius:p.radius,color:p.color,alpha:p.alpha,link:1,member:false};});
   if(!enabled)return points;
   tails=tails.filter(function(t){var p=particles[t.index];if(!p)return false;t.age+=dt;var ease=smooth(t.age/2);
    t.x+=(p.x-t.bx)*ease;t.y+=(p.y-t.by)*ease;t.bx=p.x;t.by=p.y;
    var dx=p.x-t.x,dy=p.y-t.y,d=Math.hypot(dx,dy),step=Math.min(d,12*dt*ease);if(d){t.x+=dx/d*step;t.y+=dy/d*step;}
    var r=(p.radius||3)+4;t.x=clamp(t.x,r,w-r);t.y=clamp(t.y,r,h-r);
    points[t.index].x=t.x;points[t.index].y=t.y;points[t.index].link=smooth(t.age/2);
    // Even a dot already on its live trajectory must finish reconnecting softly.
    return t.age<2||Math.hypot(p.x-t.x,p.y-t.y)>.3;
   });
   var kept=[],ui=obstacles();
   active.forEach(function(g){
    var until=g.snapMotion-frame.motion,after=frame.motion-g.snapMotion,exit=after-g.hold;
    if(exit>=exitTime){tail(g,particles,points);stats.completed++;return;}
    var t=smooth((frame.motion-g.start)/Math.max(.1,g.snapMotion-g.start));
    g.phase=until>0?'gather':exit>0?'exit':'hold';g.visible=until>0?0:1-smooth((exit-.82)/.18);
    g.labelAlpha=after<0?0:smooth(after/.18)*(1-smooth((exit-.45)/.2));
    g.exitAge=exit*1000;
    g.display=g.indices.map(function(index,i){var p=particles[index],q=g.targets[i];return {x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};});
    var radius=Math.max.apply(null,g.indices.map(function(i){return particles[i].radius||3;})),box=bounds(g.display,g.label,radius),end=bounds(g.targets,g.label,radius);
    var reservation=union(box.box,end.box);
    if(!safe(reservation,w,h,ui,kept.map(function(x){return x.reservation;}))){tail(g,particles,points);stats.safetyDismissals++;return;}
    g.reservation=reservation;g.layout=end;g.radius=radius;
    // Never reveal proximity links while the catalog figure is still departing.
    g.indices.forEach(function(index,i){points[index].x=g.display[i].x;points[index].y=g.display[i].y;points[index].member=true;points[index].link=g.phase==='gather'?1-g.visible:0;points[index].alpha=until>0?particles[index].alpha:.92;});kept.push(g);
   });active=kept;
   if(next===null)next=frame.motion+between((options.initialDelay||[20,40])[0],(options.initialDelay||[20,40])[1]);
   if(frame.motion>=next&&active.length<maxActive&&particles.length>=16){
    if(!job)job={tries:0,next:frame.motion,pattern:pick()};
    if(frame.motion>=job.next){stats.attempts++;var c=candidate(job.pattern,particles,w,h,ctx);
     if(c&&admit(c,particles,frame,w,h,ctx)){}else{job.tries++;job.next=frame.motion+.2;if(job.tries%4===0)job.pattern=pick();if(job.tries>=24){job=null;next=frame.motion+(cadence?Math.min(3,cadence/4):between(8,18));}}}
   }
   return points;
  }
  function ambientAlpha(x,y){var alpha=1,p={x:x,y:y};active.forEach(function(g){if(!g.visible)return;var r=g.clearance.outer;if(x<r.x||x>r.x+r.w||y<r.y||y>r.y+r.h)return;
   var d=Math.min(pointRegion(p,g.clearance.hull),pointRegion(p,g.clearance.label));alpha*=1-.975*g.visible*(1-smooth((d-8)/30));});return alpha;}
  function ambientLinkAlpha(ax,ay,bx,by){var alpha=1,a={x:ax,y:ay},b={x:bx,y:by};active.forEach(function(g){if(!g.visible)return;var r=g.clearance.outer;
   if(Math.max(ax,bx)<r.x||Math.min(ax,bx)>r.x+r.w||Math.max(ay,by)<r.y||Math.min(ay,by)>r.y+r.h)return;
   var d=Math.min(segmentRegion(a,b,g.clearance.hull),segmentRegion(a,b,g.clearance.label));alpha*=1-g.visible*(1-smooth((d-12)/26));});return alpha;}
  function fx(g,frame,x,y,w,h){
   var base={offset:0,offsetY:0,strength:0,color:null,alpha:1,fringe:0,halo:0},band=scanBand(g,frame);if(!band)return base;
   var strength=0,offset=0;
   if(band.transition){var direction=g.phase==='exit'?g.exitDirection:g.entryDirection,elapsed=band.age-arrival(g,x,y,direction);
    if(elapsed>=-25&&elapsed<=140){strength=elapsed<0?1+elapsed/25:Math.pow(1-elapsed/140,2);offset=Math.sin(elapsed*.13)*strength*1.4;}
   }else {strength=1-smooth((Math.abs((band.axis==='x'?x:y)-band.position)-band.half)/3);offset=band.offset*strength;}
   if(strength>0){base.strength=strength;base.fringe=(band.transition?.95:.38)*strength;base.halo=(band.transition?.85:.12)*strength;
    if(band.axis==='x')base.offset=offset;else base.offsetY=offset;}
   return base;
  }
  function drawLines(ctx,frame,w,h){
   active.forEach(function(g){if(g.visible<=0||!g.display)return;var band=scanBand(g,frame);
    g.pattern.edges.forEach(function(edge){var a=g.display[edge[0]],b=g.display[edge[1]],e=fx(g,frame,(a.x+b.x)/2,(a.y+b.y)/2,w,h);
     var opacity=.86*g.visible*e.alpha;
     pieces(g,a,b).forEach(function(piece){var u=piece[0],v=piece[1];ctx.lineWidth=1.05;ctx.globalAlpha=opacity;ctx.strokeStyle='#d3d8d6';ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.stroke();
      if(band&&band.age<420){var slice=strip(u,v,band.position-band.half,band.position+band.half,band.axis);if(slice){var s=slice[0],t=slice[1],dx=band.axis==='x'?band.offset:0,dy=band.axis==='y'?band.offset:0,fringe=band.transition?1.35:.8;
       ctx.lineWidth=band.transition?1.55:1.05;ctx.globalAlpha=band.transition?.94:opacity*.38;
       ctx.strokeStyle='#66b8e6';ctx.beginPath();ctx.moveTo(s.x+dx+fringe,s.y+dy);ctx.lineTo(t.x+dx+fringe,t.y+dy);ctx.stroke();
       ctx.strokeStyle='#e6cf82';ctx.beginPath();ctx.moveTo(s.x+dx-fringe,s.y+dy);ctx.lineTo(t.x+dx-fringe,t.y+dy);ctx.stroke();}}
     });
    });
   });ctx.globalAlpha=1;
  }
  function dotEffect(index,frame,w,h){for(var i=0;i<active.length;i++){var g=active[i],k=g.indices.indexOf(index);if(k>=0&&g.display){var q=g.display[k];return fx(g,frame,q.x,q.y,w,h);}}return {offset:0,strength:0,color:null};}
  function drawLabels(ctx,frame,w,h){ctx.font=font;ctx.textAlign='left';ctx.textBaseline='alphabetic';
   active.forEach(function(g){if(!g.labelAlpha||!g.layout)return;var value=g.label.text,x=g.layout.label.x+4,y=g.layout.baseline;
    for(var i=0;i<value.length;i++){var e=fx(g,frame,x,y,w,h),opacity=.88*g.labelAlpha*e.alpha;ctx.globalAlpha=opacity;ctx.fillStyle=e.color||'#c7ced2';ctx.fillText(value[i],x+e.offset,y+e.offsetY);
     if(e.fringe){ctx.globalAlpha=opacity*e.fringe;ctx.fillStyle='#66b8e6';ctx.fillText(value[i],x+e.offset+.85,y+e.offsetY);ctx.fillStyle='#e6cf82';ctx.fillText(value[i],x+e.offset-.85,y+e.offsetY);}
     x+=ctx.measureText(value[i]).width+tracking;}
    // One continuous underline shares the name's fade and traveling glitch.
    var left=g.layout.label.x+4,right=left+g.label.width,uy=y+6,band=scanBand(g,frame);
    ctx.lineWidth=.8;ctx.globalAlpha=.6*g.labelAlpha;ctx.strokeStyle='#aab8be';ctx.beginPath();ctx.moveTo(left,uy);ctx.lineTo(right,uy);ctx.stroke();
    if(band&&band.age<420){var slice=strip({x:left,y:uy},{x:right,y:uy},band.position-band.half,band.position+band.half,band.axis);
     if(slice){var dx=band.axis==='x'?band.offset:0,dy=band.axis==='y'?band.offset:0;ctx.globalAlpha=.6*g.labelAlpha*(band.transition?.94:.38);
      ['#66b8e6','#e6cf82'].forEach(function(color,i){var fringe=i?-.8:.8;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(slice[0].x+dx+fringe,slice[0].y+dy);ctx.lineTo(slice[1].x+dx+fringe,slice[1].y+dy);ctx.stroke();});}}
   });ctx.globalAlpha=1;
  }
  function properties(p){if(p.showconstellations){enabled=!!p.showconstellations.value;if(!enabled)reset();}}
  function snapshot(){return {enabled:enabled,stats:Object.assign({},stats),recent:recent.slice(),next:next,tails:tails.length,active:active.map(function(g){return {id:g.pattern.id,name:g.pattern.name,phase:g.phase,indices:g.indices.slice(),targets:g.targets.map(function(q){return {x:q.x,y:q.y};}),display:(g.display||[]).map(function(q){return {x:q.x,y:q.y};}),bounds:Object.assign({},g.reservation),label:g.layout?Object.assign({},g.layout.label):null,labelAlpha:g.labelAlpha||0,fitRms:g.fitRms,maxDisplacement:g.maxDisplacement,snapMotion:g.snapMotion,snapEpoch:g.snapEpoch,hold:g.hold};})};}
  return {prepare:prepare,drawLines:drawLines,drawLabels:drawLabels,dotEffect:dotEffect,ambientAlpha:ambientAlpha,ambientLinkAlpha:ambientLinkAlpha,properties:properties,reset:reset,snapshot:snapshot,
   // Same admission checks are used by deterministic QA and the runtime search.
   candidate:candidate,admit:admit};
 }
 root.ScrippsConstellationSystem={create:create,weight:weight,transform:transform,bounds:bounds,overlap:overlap};
 root.ScrippsConstellations=create();
})(window);
