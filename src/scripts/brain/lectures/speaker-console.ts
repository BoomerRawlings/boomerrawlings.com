import type {LectureSlide,LecturePresentation} from './types';
import {nativeLectureCSS,renderLectureContent} from './native-slide';

type State={title:string;index:number;slides:LectureSlide[];blanked:boolean;demo:boolean};
type Actions={previous:()=>void;next:()=>void;demo:()=>void;blank:()=>void;select:(index:number)=>void};

/** The companion keeps notes off the audience canvas. Content exists only while open. */
export function createSpeakerConsole(actions:Actions){
  let popup:Window|null=null,timer:ReturnType<typeof setInterval>|null=null;
  let elements:Record<string,HTMLElement>={},started=0,elapsed=0,running=true;
  function close(){if(timer)clearInterval(timer);timer=null;elements={};try{if(popup&&!popup.closed){popup.document.body.replaceChildren();popup.close();}}catch{/* The user may have navigated the companion elsewhere. */}popup=null;}
  function update(state:State){
    if(!popup||popup.closed){if(popup)close();return;}
    try{if(!popup.document.getElementById('currentCanvas')){close();return;}}catch{close();return;}
    const slide=state.slides[state.index],next=state.slides[state.index+1];if(!slide)return;
    popup.document.title=`Presenter · ${state.title}`;
    elements.title.textContent=state.title;elements.position.textContent=`${state.index+1} / ${state.slides.length}`;
    elements.currentTitle.textContent=slide.title;elements.nextTitle.textContent=next?`Next: ${next.title}`:'Final slide';
    const presentation=(s:LectureSlide):LecturePresentation=>s.presentation||{title:s.title,layout:'split',groups:[{items:s.bullets}],figures:s.visual.kind==='figure'?[s.visual]:[],takeaway:s.takeaway};
    renderLectureContent(elements.currentCanvas,presentation(slide));
    if(next)renderLectureContent(elements.nextCanvas,presentation(next));else elements.nextCanvas.replaceChildren();
    for(const key of ['currentCanvas','nextCanvas'])elements[key].style.setProperty('--preview-scale',String((elements[key].clientWidth||500)/1100));
    elements.notes.textContent=slide.notes||slide.takeaway;
    elements.cues.replaceChildren(...(slide.teaching?.steps||[]).map(step=>{const item=popup!.document.createElement('li'),strong=popup!.document.createElement('strong');strong.textContent=step.title;item.append(strong,popup!.document.createTextNode(` — ${step.explanation}`));return item;}));
    elements.demo.textContent=state.demo?'Return to lecture':slide.teaching?.demo?.label||'Demonstration';(elements.demo as HTMLButtonElement).disabled=!slide.teaching?.demo;
    elements.blank.textContent=state.blanked?'Restore audience screen':'Blank audience screen';
    (elements.previous as HTMLButtonElement).disabled=state.index===0;
    elements.next.textContent=next?'Next slide →':'Finish lecture';
    const select=elements.select as HTMLSelectElement;
    if(select.options.length!==state.slides.length){select.replaceChildren(...state.slides.map((s,i)=>{const o=popup!.document.createElement('option');o.value=String(i);o.textContent=`${i+1}. ${s.title}`;return o;}));}
    select.value=String(state.index);
  }
  function open(state:State):boolean{
    if(popup&&!popup.closed){update(state);if(popup&&!popup.closed){popup.focus();return true;}}
    close();popup=window.open('','_blank','popup,width=1180,height=820');if(!popup)return false;
    const doc=popup.document;doc.documentElement.lang='en';doc.head.replaceChildren();doc.body.replaceChildren();
    const style=doc.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#102027;color:#ecf5f4;font:16px/1.5 system-ui,sans-serif}header,footer{padding:16px 24px;display:flex;align-items:center;gap:12px;background:#172d35}header h1{font-size:18px;margin:0;flex:1}main{padding:24px;display:grid;grid-template-columns:1.5fr 1fr;gap:24px}h2{font-size:20px;margin:0 0 12px}h3{font-size:15px;color:#a5dfc8;margin:20px 0 8px}img{display:block;width:100%;max-height:45vh;object-fit:contain;background:#050b10}#nextImage{max-height:23vh}p{white-space:pre-wrap}ul{padding-left:22px}li{margin-bottom:12px}strong{color:#c3f5df}button,select{font:inherit;max-width:100%;border:1px solid #52746d;background:#213d46;color:#edfff6;border-radius:6px;padding:9px 12px;cursor:pointer}button:disabled{opacity:.35;cursor:default}button:focus-visible,select:focus-visible{outline:3px solid #abffd4;outline-offset:2px}footer{position:sticky;bottom:0;flex-wrap:wrap}#next{background:#baedd7;color:#102e23}#time{font-variant-numeric:tabular-nums;font-size:22px}#notes{color:#cdddda}.tip{font-size:13px;color:#9dbaaf}#select{width:100%}@media(max-width:750px){main{grid-template-columns:1fr}header{flex-wrap:wrap}}`;
    style.textContent+=nativeLectureCSS+`.speaker-preview{width:100%;height:calc(620px * var(--preview-scale,.5));overflow:hidden;background:#0a171e;border:1px solid #436257}.speaker-preview .native-lecture{width:1100px;height:620px;transform-origin:top left;transform:scale(var(--preview-scale,.5));padding:32px;--native-size:25px!important}.speaker-preview .native-title{font-size:38px!important}.speaker-preview .native-figure img{max-height:440px}.speaker-preview .native-takeaway{font-size:20px}.speaker-preview .native-heading{padding:0;background:none}`;

    doc.head.append(style);const meta=doc.createElement('meta');meta.name='viewport';meta.content='width=device-width,initial-scale=1';doc.head.append(meta);
    const make=(tag:string,id:string,text='')=>{const n=doc.createElement(tag);n.id=id;n.textContent=text;elements[id]=n;return n;};
    const action=(id:string,label:string,fn:()=>void)=>{const b=make('button',id,label);b.addEventListener('click',fn);return b;};
    const header=doc.createElement('header');header.append(make('h1','title'),make('span','position'),make('output','time','00:00'),action('timer','Pause timer',()=>{if(running)elapsed+=Date.now()-started;else started=Date.now();running=!running;elements.timer.textContent=running?'Pause timer':'Resume timer';}),action('resetTimer','Reset timer',()=>{elapsed=0;started=Date.now();elements.time.textContent='00:00';}));
    const main=doc.createElement('main'),left=doc.createElement('section'),right=doc.createElement('aside');
    const currentCanvas=make('div','currentCanvas');currentCanvas.className='speaker-preview';const nextCanvas=make('div','nextCanvas');nextCanvas.className='speaker-preview';
    left.append(make('h2','currentTitle'),currentCanvas,make('h3','cuesTitle','Teaching cues · presenter only'),make('ul','cues'),make('h3','notesTitle','Presenter notes'),make('p','notes'));
    right.append(make('h2','nextTitle'),nextCanvas,make('h3','jumpTitle','Jump to slide'));
    const select=make('select','select') as HTMLSelectElement;select.setAttribute('aria-label','Jump to slide');select.addEventListener('change',()=>actions.select(Number(select.value)));right.append(select,make('p','tip','Move this window to your own display. Share or project the audience window; these notes stay here.'));elements.tip.className='tip';
    const footer=doc.createElement('footer');footer.append(action('previous','← Previous',actions.previous),action('next','Next slide →',actions.next),action('demo','Demonstration',actions.demo),action('blank','Blank audience screen',actions.blank));
    main.append(left,right);doc.body.append(header,main,footer);started=Date.now();elapsed=0;running=true;
    doc.addEventListener('keydown',event=>{if((event.target as Element).closest('button,input,select,textarea')||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(['ArrowRight','PageDown',' '].includes(event.key)){event.preventDefault();actions.next();}else if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();actions.previous();}else if(event.key.toLowerCase()==='b')actions.blank();});
    timer=setInterval(()=>{if(!popup||popup.closed){close();return;}const seconds=Math.floor((elapsed+(running?Date.now()-started:0))/1000);elements.time.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;},1000);
    popup.addEventListener('resize',()=>{for(const key of ['currentCanvas','nextCanvas'])elements[key]?.style.setProperty('--preview-scale',String((elements[key].clientWidth||500)/1100));});
    update(state);return true;
  }
  return{open,update,close};
}
