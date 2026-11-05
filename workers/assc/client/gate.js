(() => {
  const gate=document.querySelector('#gate'),form=document.querySelector('#entry-form'),input=document.querySelector('#answer'),button=document.querySelector('#entry-submit'),feedback=document.querySelector('#feedback'),retry=document.querySelector('#entry-retry'),reveal=document.querySelector('#gate-reveal');
  const wave=gate.querySelector('.gate-answer-wave path'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let busy=false,authenticated=false,shell,appStarted=false,acceptedAnswer='',waveFrame;
  function inputResponse(){cancelAnimationFrame(waveFrame);waveFrame=requestAnimationFrame(()=>{const length=input.value.length,bend=reduced.matches?0:Math.sin(length*.7)*Math.min(4,length*.7);wave.setAttribute('d',`M0 10 C70 ${10+bend} 120 ${10-bend} 200 10 S330 ${10+bend} 400 10`);});}
  input.addEventListener('input',()=>{feedback.textContent='';input.removeAttribute('aria-invalid');inputResponse();});reduced.addEventListener('change',inputResponse);
  async function timedFetch(url,options={}){return fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:AbortSignal.timeout(15000)});}
  async function stylesheet(href){const url=new URL(href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/ASSC/client/'))throw Error('Unexpected workspace styling.');if([...document.styleSheets].some(sheet=>sheet.href===url.href))return;const link=document.createElement('link');link.rel='stylesheet';link.href=url.href;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{link.remove();reject(Error('The styling took too long to load. Please try again.'));},15000);link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(Error('The styling could not load. Please try again.'));};document.head.append(link);});}
  async function loadWorkspace(){
    if(shell&&appStarted&&document.documentElement.dataset.asscReady==='true')return;
    const response=await timedFetch('/ASSC/',{headers:{Accept:'text/html'}});if(!response.ok)throw Error('The workspace could not open. Please try again.');
    const parsed=new DOMParser().parseFromString(await response.text(),'text/html');if(!parsed.querySelector('#main')||!parsed.querySelector('#logout')||parsed.querySelector('#entry-form')){authenticated=false;throw Error('Your session ended. Enter your answer again.');}
    await Promise.all([...parsed.querySelectorAll('link[rel="stylesheet"]')].map(link=>stylesheet(link.getAttribute('href'))));
    shell?.remove();shell=document.createElement('div');shell.className='gate-workspace';shell.inert=true;shell.style.transform='none';shell.style.filter='none';
    parsed.body.querySelectorAll('script,iframe,object,embed').forEach(node=>node.remove());for(const child of [...parsed.body.children])shell.append(document.importNode(child,true));document.body.append(shell);
    const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{document.removeEventListener('assc-ready',done);reject(Error('The records took too long to open. Please try again.'));},20000);function done(event){clearTimeout(timer);document.removeEventListener('assc-ready',done);event.detail?.ok===false?reject(Error(event.detail.message||'The records could not open.')):resolve();}document.addEventListener('assc-ready',done);});
    await import('/ASSC/client/app.js');appStarted=true;await ready;
    const logo=shell.querySelector('.console-brand-logo');if(logo&&!logo.complete)await logo.decode();
    document.title=parsed.title||'ASSC';
  }
  async function animateOpening(){
    const field=input.getBoundingClientRect(),target=shell.querySelector('.console-brand-logo'),destination=target?.getBoundingClientRect();
    if(!destination)throw Error('The workspace logo could not be placed. Please try again.');
    const word=document.createElement('span');word.className='gate-morph-word';word.textContent=acceptedAnswer;word.setAttribute('aria-hidden','true');
    const logo=document.createElement('img');logo.className='gate-morph-logo';logo.src=target.src;logo.alt='';logo.width=logo.height=1254;await logo.decode();
    reveal.replaceChildren(word,logo);reveal.style.transition='none';reveal.dataset.morph='';Object.assign(reveal.style,{position:'fixed',inset:'auto',transform:'none',margin:'0',padding:'0',border:'0',boxSizing:'border-box'});reveal.style.left=field.left+'px';reveal.style.top=field.top+'px';reveal.style.width=field.width+'px';reveal.style.height=field.height+'px';
    word.style.fontSize=Math.min(26,field.width/Math.max(acceptedAnswer.length,1)*1.3)+'px';
    gate.style.background='transparent';target.style.visibility='hidden';document.body.classList.add('gate-opening');feedback.textContent='';
    if(!reduced.matches){
      const size=Math.min(260,innerWidth*.55,innerHeight*.38),duration=1550,easing='cubic-bezier(.22,.75,.2,1)';
      const flight=reveal.animate([{left:field.left+'px',top:field.top+'px',width:field.width+'px',height:field.height+'px'},{offset:.42,left:(innerWidth-size)/2+'px',top:(innerHeight-size)/2+'px',width:size+'px',height:size+'px'},{left:destination.left+'px',top:destination.top+'px',width:destination.width+'px',height:destination.height+'px'}],{duration,easing,fill:'forwards'});
      const wordMotion=word.animate([{opacity:1,filter:'blur(0px)',transform:'scale(1)',letterSpacing:'.12em'},{offset:.17,opacity:1,filter:'blur(0px)',transform:'scale(1.04)',letterSpacing:'.04em'},{offset:.46,opacity:0,filter:'blur(5px)',transform:'scale(.72)',letterSpacing:'-.08em'},{opacity:0,filter:'blur(5px)',transform:'scale(.72)',letterSpacing:'-.08em'}],{duration,easing:'ease-in-out',fill:'forwards'});
      const logoMotion=logo.animate([{opacity:0,filter:'blur(5px)',transform:'scale(.85)'},{offset:.17,opacity:0,filter:'blur(5px)',transform:'scale(.85)'},{offset:.5,opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration,easing:'ease-in-out',fill:'forwards'});
      const workspaceMotion=shell.animate([{opacity:0},{offset:.4,opacity:0},{opacity:1}],{duration,easing:'ease-in-out',fill:'forwards'});
      await Promise.all([flight.finished,wordMotion.finished,logoMotion.finished,workspaceMotion.finished]);
    }
    target.style.visibility='';shell.style.opacity='1';shell.inert=false;const main=shell.querySelector('#main');shell.replaceWith(...shell.childNodes);gate.remove();document.querySelector('noscript')?.remove();document.body.classList.remove('gate-body','gate-opening');acceptedAnswer='';main?.focus({preventScroll:true});window.dispatchEvent(new Event('resize'));
  }
  function recover(error){document.body.classList.remove('gate-opening');gate.style.background='';reveal.replaceChildren();delete reveal.dataset.morph;const target=shell?.querySelector('.console-brand-logo');if(target)target.style.visibility='';feedback.textContent=['AbortError','TimeoutError'].includes(error.name)?'The connection took too long. Please try again.':error.message||'Could not connect. Please try again.';if(authenticated){retry.hidden=false;retry.focus();}else{retry.hidden=true;input.focus();input.select();}}
  async function enter(event){event?.preventDefault();if(busy)return;busy=true;button.disabled=true;retry.disabled=true;form.setAttribute('aria-busy','true');feedback.textContent='Connecting…';
    try{if(!authenticated){acceptedAnswer=input.value.trim();const response=await timedFetch('/ASSC/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answer:input.value})});let result;try{result=await response.json();}catch{result={};}if(!response.ok){acceptedAnswer='';if(response.status===401)input.setAttribute('aria-invalid','true');throw Error(result.error||'That answer did not connect. Please try again.');}authenticated=true;}
      await loadWorkspace();await animateOpening();
    }catch(error){recover(error);}finally{busy=false;button.disabled=false;retry.disabled=false;form.removeAttribute('aria-busy');}
  }
  form.addEventListener('submit',enter);retry.addEventListener('click',()=>authenticated?location.replace('/ASSC/'):enter());window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
})();
