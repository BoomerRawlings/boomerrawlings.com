// Keep the complete walkthrough in the project's normal document scroll.
const frame=document.querySelector('iframe[data-stars-workflow]');
if(frame){
 const measure=()=>frame.contentWindow?.postMessage({type:'stars-workflow-measure'},location.origin);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='stars-workflow-height')return;
  const height=event.data.height;
  if(typeof height==='number'&&Number.isFinite(height)&&height>=320&&height<=50000)frame.style.height=Math.ceil(height)+'px';
 });
 frame.addEventListener('load',measure);measure();
}
