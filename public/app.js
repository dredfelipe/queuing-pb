const app=document.querySelector('#app');
const admin=location.pathname==='/admin',join=location.pathname==='/join';
let state=null,base='',pin=sessionStorage.getItem('courtside-pin')||'',authenticated=false,online=false,joined=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=entries=>entries.reduce((n,e)=>n+e.players.length,0);
function toast(message){const t=document.querySelector('#toast');t.textContent=message;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',4500);}
function actionError(message){
 const dialog=document.querySelector('dialog[open]');
 if(!dialog)return toast(message);
 let error=dialog.querySelector('[data-action-error]');
 if(!error){error=document.createElement('p');error.dataset.actionError='';error.setAttribute('role','alert');dialog.querySelector('form').prepend(error);}
 error.textContent=message;error.scrollIntoView?.({block:'nearest'});
}
function closeEditor(dialog){dialog.close();dialog.remove();render();}
async function action(body){try{const res=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,pin})});const data=await res.json();if(!res.ok)throw Error(data.error);state=data;return true;}catch(e){actionError(e.message==='Unknown action.'?'The server is using an older version. Restart it with npm start, then try again.':e.message||'Could not connect to the local server.');return false;}}
function themeButton(extraClass=''){const light=document.documentElement.dataset.theme==='light';return `<button type="button" class="secondary ${extraClass}" data-theme-toggle title="Switch to ${light?'dark':'light'} mode" aria-label="Switch to ${light?'dark':'light'} mode" aria-pressed="${light}"><span aria-hidden="true">${light?'☾':'☀'}</span></button>`;}
function setTheme(theme){
 document.documentElement.dataset.theme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f4f6ef':'#141c19');
 document.querySelectorAll('[data-theme-toggle]').forEach(button=>{const light=theme==='light';button.innerHTML=`<span aria-hidden="true">${light?'☾':'☀'}</span>`;button.title=`Switch to ${light?'dark':'light'} mode`;button.setAttribute('aria-label',`Switch to ${light?'dark':'light'} mode`);button.setAttribute('aria-pressed',String(light));});
}
function toggleTheme(){const theme=document.documentElement.dataset.theme==='light'?'dark':'light';setTheme(theme);try{localStorage.setItem('courtside-theme',theme);}catch{}}
window.addEventListener('storage',e=>{if(e.key==='courtside-theme'&&['light','dark'].includes(e.newValue))setTheme(e.newValue);});
function header(){return `<header><a class="brand" href="/">${state?.logo?`<img class="venue-logo" src="${esc(state.logo)}" alt="Venue logo">`:'courtside<span>↗</span>'}</a><div class="live ${online?'':'offline'}"><span class="dot"></span>${online?'Local session · live':'Reconnecting to venue server'}</div><nav><a href="/">TV display</a><a href="/join">Join queue</a><a href="/admin">Organizer</a>${themeButton()}${!admin&&!join?'<button type="button" data-tv-fullscreen>Fullscreen TV ⛶</button>':''}</nav></header>`;}
function avatar(p){return `<span class="avatar" data-initial="${esc(p.name.slice(0,1).toUpperCase())}">${p.photo?`<img src="${esc(p.photo)}" alt="" loading="lazy" >`:esc(p.name.slice(0,1).toUpperCase())}</span>`;}
function skillTag(p){const colors={Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'};return `<span class="skill-tag ${colors[p.skill]||'beginner'}" role="img" title="${esc(p.skill)}" aria-label="${esc(p.skill)}"></span>`;}
function gamesBadge(p){const games=state.gamesPlayed?.[p.id]||0;return `<span class="games-played" title="Completed games this session">${games} ${games===1?'game':'games'}</span>`;}
function player(p){return `<div class="player">${avatar(p)}<div>${esc(p.name)}${skillTag(p)}${gamesBadge(p)}${admin?`<span class="skill">${esc(p.skill)}</span>`:''}</div></div>`;}

function court(c){return `<article class="card"><div class="court-head"><h2>${esc(c.name)}</h2><span class="badge ${c.match?'':'muted'}">${c.match?'IN PLAY':c.enabled?'AVAILABLE':'PAUSED'}</span></div>${c.match?`<div class="teams">${c.match.entries.flatMap(e=>e.players).map(player).join('')}</div><div class="court-foot"><span>On court <b data-time="${c.match.startedAt}"></b></span>${admin?`<button class="secondary" data-replace="${c.id}">Replace player</button><button data-action="finish" data-id="${c.id}" data-match="${c.match.id}">Finish & rotate ↗</button>`:'<span>DOUBLES</span>'}</div>`:`<div class="empty"><strong>${c.enabled?'Ready for the next rally':'Taking a break'}</strong>${c.enabled?'Waiting for the organizer to start a match.':'This court is out of rotation.'}</div>${admin?`<div class="court-foot">${c.enabled?`<button data-action="start" data-id="${c.id}">Start next four</button>`:'<span>Court paused</span>'}<button class="secondary" data-action="toggleCourt" data-id="${c.id}">${c.enabled?'Pause':'Enable'}</button></div>`:''}`}</article>`;}
function queue(){let position=0;return `<section class="card queue"><div class="section-title"><h2>On deck</h2><span class="subtle">${count(state.queue)} waiting</span></div>${state.queue.length?state.queue.map(e=>{const n=position+1;position+=e.players.length;return `<div class="queue-row"><span class="position">${String(n).padStart(2,'0')}</span><div class="queue-name">${e.players.map(p=>`<div class="queue-person">${avatar(p)}<span>${esc(p.name)}${skillTag(p)}${gamesBadge(p)}</span></div>`).join('')}${e.players.length===2?'<div class="pair-mark">↔ LOCKED TEAMMATES</div>':''}${admin?`<span class="skill">${e.players.map(p=>esc(p.skill)).join(' · ')}</span>`:''}</div>${admin?`<button class="remove" data-edit="${e.id}">Edit</button><button class="remove" data-action="remove" data-id="${e.id}" aria-label="Remove ${esc(e.players.map(p=>p.name).join(' and '))}">Remove</button>`:''}</div>`;}).join(''):'<p>The queue is open.<br>Scan the code to get in the game.</p>'}</section>`;}
function skillSelect(field){return `<label>Skill level<select name="${field}"><option>Beginner</option><option selected>Intermediate</option><option>Advanced</option></select></label>`;}
function photoFields(field,current,label='Photo (optional)'){return `<div class="photo-field"><label>${label}<input type="file" name="${field}" accept="image/jpeg,image/png,image/webp" data-photo-input></label><img class="photo-preview" ${current?`src="${esc(current)}"`:'hidden'} alt="Image preview">${current?`<label class="photo-remove"><input type="checkbox" name="remove-${field}">${field==='logo'?'Remove logo':'Remove photo'}</label>`:''}</div>`;}
async function readPhoto(form,field,current,options={}){
 const input=form.querySelector(`[name="${field}"]`);const file=input?.files?.[0];
 if(!file)return form.querySelector(`[name="remove-${field}"]`)?.checked?null:current;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG, or WebP photo.');
 if(file.size>10*1024*1024)throw Error('Choose a photo smaller than 10 MB.');
 const url=URL.createObjectURL(file);
 try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not open this photo. Choose another image.'));image.src=url;});
 const canvas=document.createElement('canvas');const scale=Math.min(1,(options.maxDimension||256)/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL(options.transparent?'image/png':'image/jpeg',.85);if(data.length>400000)throw Error('This image is too detailed. Choose a smaller image.');return data;
 }finally{URL.revokeObjectURL(url);}
}
function bindPhotoInputs(root=document){root.querySelectorAll('[data-photo-input]').forEach(input=>input.addEventListener('change',()=>{
 const preview=input.closest('.photo-field').querySelector('.photo-preview');const file=input.files[0];
 if(file){const reader=new FileReader();reader.onload=()=>{preview.src=reader.result;preview.hidden=false;};reader.readAsDataURL(file);}
 }));}
function joinForm(){return `<form id="join-form"><label>Player name<input required name="name" maxlength="40" placeholder="Name or nickname" autocomplete="off"></label>${skillSelect('skill')}${photoFields('photo')}<label>Teammate preference<select id="pair-mode" name="pairMode"><option value="single">Choose my partner on court</option><option value="pair">Lock in with a partner</option></select></label><div id="partner-fields" hidden><label>Partner name<input name="partner" maxlength="40" placeholder="Your teammate’s name" autocomplete="off"></label>${skillSelect('partnerSkill')}${photoFields('partnerPhoto')}</div><button type="submit">${admin?'Add to queue':'Join the queue'} ↗</button></form>`;}
function render(){if(!state)return;const focus=document.activeElement;const formActive=focus&&focus.closest('form');if(formActive&&app.childElementCount)return;
 const total=count(state.queue)+state.courts.reduce((n,c)=>n+(c.match?4:0),0);
 if(admin&&!authenticated){app.innerHTML=header()+`<main><section class="card form-card pin"><div class="eyebrow">Session controls</div><h1>Welcome, organizer.</h1><p>Enter the PIN printed in the server terminal.</p><form id="login"><label>Organizer PIN<input name="pin" type="password" inputmode="numeric" required autocomplete="current-password"></label><button>Unlock controls</button></form></section></main>`;bind();return;}
 if(join){app.innerHTML=header()+`<main class="join-wrap"><div class="eyebrow">Less waiting. More playing.</div><h1>Your next game<br>starts here.</h1><p>Join the queue, keep an eye on the TV, and be ready when your name is called.</p>${joined?'<div class="success"><h2>You’re in the queue.</h2><p>Watch the TV for your court assignment. Locked partners will always play together.</p><button id="another" class="secondary">Register another player</button></div>':`<section class="card form-card">${joinForm()}</section>`}<p class="subtle">Connect to the venue Wi-Fi to use this page. All four players return to the queue after each match.</p></main>`;bind();return;}
 app.innerHTML=header()+`<main><div class="heading"><div><div class="eyebrow">Pickleball · Open play</div><h1>${admin?'Run the court.':'Good games. Great company.'}</h1><span class="subtle">${admin?'Manage players, courts, and the next rotation.':'Find your name. Grab your paddle. You’re up next.'}</span></div><div class="stats"><div class="stat"><strong>${state.courts.filter(c=>c.match).length}<span style="display:inline;font-size:18px"> / ${state.courts.filter(c=>c.enabled).length}</span></strong><span>Courts in play</span></div><div class="stat"><strong>${total}</strong><span>Players checked in</span></div></div></div>${admin?`<section class="card form-card"><div class="section-title"><h2>Check in players</h2><button type="button" id="returning-players" class="secondary">Returning players</button><button id="logout" class="secondary">Lock controls</button></div>${joinForm()}</section><section class="card form-card logo-settings"><h2>Venue logo</h2><p>Upload your logo for the TV and registration pages. PNG transparency is preserved.</p><form id="logo-form">${photoFields('logo',state.logo,'Logo (optional)')}<button type="submit">Save logo</button></form></section><section class="card form-card"><form id="court-form"><label>Court name<input name="court" required maxlength="40" placeholder="e.g. Court 3"></label><button>Add court +</button></form></section><p class="admin-note">Start each available court when ready. Finish & rotate returns all four to the queue and starts the next complete group automatically.</p>`:''}${!admin&&state.logo?`<div class="tv-logo"><img src="${esc(state.logo)}" alt="Venue logo"></div>`:''}<div class="layout"><div class="courts">${state.courts.map(court).join('')}</div><aside class="side">${queue()}<section class="card qr"><div class="eyebrow" style="color:inherit">Got next?</div><h2 style="margin:9px 0 15px">Scan. Join. Play.</h2><img src="/qr.svg" alt="QR code to join the queue"><p>Connect to venue Wi-Fi<br>then scan to join the queue.</p><small>${esc(base)}/join</small></section><div class="notice">Queue order comes first. Players choose their partners on court. Locked pairs stay together; the earliest complete group of four plays next.</div></aside></div><footer class="footer"><span>${state.completed} matches completed · Everyone rotates after each match</span><span id="clock"></span></footer></main>${!admin?themeButton('tv-theme'):''}${!admin?'<button class="tv-exit secondary" data-tv-fullscreen aria-label="Exit fullscreen TV display">Exit fullscreen ⛶</button>':''}`;
 bind();tick();}
function editEntry(id){
 const entry=state.queue.find(e=>e.id===id);if(!entry)return toast('This entry is no longer waiting.');
 const dialog=document.createElement('dialog');dialog.className='edit-dialog';
 dialog.innerHTML=`<form id="edit-form"><h2>Edit waiting ${entry.players.length===2?'pair':'player'}</h2><p>Queue position and locked teammates stay the same.</p>${entry.players.map((p,i)=>`<fieldset><legend>Player ${i+1}</legend><label>Name<input name="name${i}" value="${esc(p.name)}" maxlength="40" required></label><label>Skill level<select name="skill${i}">${['Beginner','Intermediate','Advanced'].map(level=>`<option${level===p.skill?' selected':''}>${level}</option>`).join('')}</select></label>${photoFields('photo'+i,p.photo)}</fieldset>`).join('')}<div class="toolbar"><button type="submit">Save changes</button><button type="button" class="secondary" id="cancel-edit">Cancel</button></div></form>`;
 document.body.append(dialog);bindPhotoInputs(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#cancel-edit').onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const button=e.target.querySelector('[type="submit"]');button.disabled=true;
 try{const players=await Promise.all(entry.players.map(async(p,i)=>({name:f.get('name'+i),skill:f.get('skill'+i),photo:await readPhoto(e.target,'photo'+i,p.photo)})));
 if(await action({type:'edit',id,players})){closeEditor(dialog);toast('Player details updated.');}}catch(error){actionError(error.message);}finally{button.disabled=false;}
 };dialog.showModal();
}
function replacePlayer(id){
 const court=state.courts.find(c=>c.id===id);if(!court?.match)return toast('This court is no longer active.');
 const waiting=state.queue.filter(e=>e.players.length===1);
 if(!waiting.length)return toast('Add an individual player to the queue first. Locked pairs cannot be split for a replacement.');
 const match=court.match;
 const dialog=document.createElement('dialog');dialog.className='edit-dialog';
 dialog.innerHTML=`<form><h2>Replace player · ${esc(court.name)}</h2><p>The other players and match timer stay in place. The TV updates immediately.</p><label>Player coming off court<select name="outgoing">${match.entries.flatMap(e=>e.players.map(p=>`<option value="${p.id}">${esc(p.name)}${e.players.length===2?' (locked pair)':''}</option>`)).join('')}</select></label><label>Search waiting players<input type="search" name="replacementSearch" placeholder="Type a player’s name" autocomplete="off"></label><label>Replacement from queue<select name="replacement" required>${waiting.map(e=>`<option value="${e.id}">${esc(e.players[0].name)}</option>`).join('')}</select></label><p id="replacement-results" role="status" aria-live="polite"></p><p>Only individual waiting players are available; locked pairs stay together.</p><label>Outgoing player<select name="destination"><option value="leave">Has left — remove from session</option><option value="queue">Still playing — return to back of queue</option></select></label><div id="unlock-notice" hidden><p>This player is in a locked pair. Their partner will stay on court and both will become individual players.</p><label><input type="checkbox" name="unlock">Unlock this pair to allow the replacement</label></div><div class="toolbar"><button type="submit">Confirm replacement</button><button type="button" class="secondary" id="cancel-replace">Cancel</button></div></form>`;
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('#cancel-replace').onclick=()=>dialog.close();
 const outgoing=dialog.querySelector('[name="outgoing"]');const unlock=dialog.querySelector('[name="unlock"]');
 function updateUnlock(){const locked=match.entries.some(e=>e.players.length===2&&e.players.some(p=>p.id===outgoing.value));dialog.querySelector('#unlock-notice').hidden=!locked;unlock.required=locked;unlock.checked=false;}
 outgoing.onchange=updateUnlock;updateUnlock();
 const search=dialog.querySelector('[name="replacementSearch"]');const replacement=dialog.querySelector('[name="replacement"]');
 const confirmButton=dialog.querySelector('[type="submit"]');
 search.addEventListener('input',()=>{
 const term=search.value.trim().toLocaleLowerCase();const previous=replacement.value;
 const matches=waiting.filter(e=>e.players[0].name.toLocaleLowerCase().includes(term));
 replacement.innerHTML=matches.length?matches.map(e=>`<option value="${e.id}">${esc(e.players[0].name)}</option>`).join(''):'<option value="">No matching players</option>';
 if(matches.some(e=>e.id===previous))replacement.value=previous;
 replacement.disabled=!matches.length;confirmButton.disabled=!matches.length;
 dialog.querySelector('#replacement-results').textContent=matches.length?`${matches.length} waiting player${matches.length===1?'':'s'} found`:'No matching waiting players. Try another name.';
 });
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const button=e.target.querySelector('[type="submit"]');button.disabled=true;
 if(await action({type:'replace',id,matchId:match.id,playerId:f.get('outgoing'),replacementId:f.get('replacement'),destination:f.get('destination'),unlockPair:f.get('unlock')==='on'})){closeEditor(dialog);toast('Court player replaced.');}else button.disabled=false;
 };dialog.showModal();
}
async function returningPlayers(){
 let players;
 try{const res=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'directory',pin})});const data=await res.json();if(!res.ok)throw Error(data.error);players=data.players;}catch(error){return toast(error.message);}
 const dialog=document.createElement('dialog');dialog.className='edit-dialog directory-dialog';
 dialog.innerHTML=`<form><h2>Returning players</h2><p>Find a saved player and check them in again. Their name, skill, and photo are remembered.</p><label>Search saved players<input type="search" name="directorySearch" placeholder="Type a name" autocomplete="off"></label><label>Lock in with another saved player (optional)<select name="directoryPartner"><option value="">No locked partner</option></select></label><p class="subtle" id="directory-count" role="status"></p><div id="directory-list"></div><div class="toolbar"><button type="button" id="close-directory" class="secondary">Close</button></div></form>`;
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('form').onsubmit=e=>e.preventDefault();dialog.querySelector('#close-directory').onclick=()=>closeEditor(dialog);
 const activeIds=new Set([...state.queue,...state.courts.flatMap(c=>c.match?c.match.entries:[])].flatMap(e=>e.players.map(p=>p.id)));
 dialog.querySelector('[name="directoryPartner"]').innerHTML+=[...players].filter(p=>!activeIds.has(p.id)).sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
 function draw(){const term=dialog.querySelector('[name="directorySearch"]').value.trim().toLocaleLowerCase();const matches=players.filter(p=>p.name.toLocaleLowerCase().includes(term)).sort((a,b)=>a.name.localeCompare(b.name));
 dialog.querySelector('#directory-count').textContent=`${matches.length} saved player${matches.length===1?'':'s'}${matches.length>50?' · showing first 50, type more to narrow your search':''}`;
 dialog.querySelector('#directory-list').innerHTML=matches.length?matches.slice(0,50).map(p=>`<div class="directory-row">${avatar(p)}<div class="queue-name">${esc(p.name)}${skillTag(p)}${gamesBadge(p)}<span class="skill">${esc(p.skill)}</span></div>${activeIds.has(p.id)?'<span class="subtle">Checked in</span>':`<button type="button" data-check-in="${p.id}">Check in</button>`}</div>`).join(''):'<p>No saved players found. New players are saved automatically when they first join.</p>';
 dialog.querySelectorAll('[data-check-in]').forEach(b=>b.onclick=async()=>{b.disabled=true;const partner=dialog.querySelector('[name="directoryPartner"]').value;const playerIds=partner?[b.dataset.checkIn,partner]:[b.dataset.checkIn];if(await action({type:'checkIn',playerIds})){closeEditor(dialog);toast('Returning player checked in.');}else b.disabled=false;});
 }
 dialog.querySelector('[name="directorySearch"]').oninput=draw;draw();dialog.showModal();dialog.querySelector('[name="directorySearch"]').focus();
}
async function toggleTvFullscreen(){
 if(admin||join)return;
 if(document.body.classList.contains('tv-mode')){
 document.body.classList.remove('tv-mode');
 if(document.fullscreenElement)try{await document.exitFullscreen();}catch{toast('Use Esc or your browser controls to exit fullscreen.');}
 return;
 }
 document.body.classList.add('tv-mode');window.scrollTo(0,0);
 try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('TV view enabled. Use your browser’s fullscreen control to hide its toolbar.');}
 catch{toast('TV view enabled. Use your browser’s fullscreen control to hide its toolbar.');}
}
// Fullscreen is attached to the document so live updates can redraw the queue safely.
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('tv-mode');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.fullscreenElement)document.body.classList.remove('tv-mode');});
function bind(){
 document.querySelectorAll("[data-theme-toggle]").forEach(b=>b.addEventListener("click",toggleTheme));
 bindPhotoInputs();
 document.querySelectorAll('.avatar img').forEach(img=>img.addEventListener('error',()=>{img.parentElement.textContent=img.parentElement.dataset.initial;}));
 document.querySelector('#returning-players')?.addEventListener('click',returningPlayers);
 document.querySelectorAll("[data-tv-fullscreen]").forEach(b=>b.addEventListener("click",toggleTvFullscreen));
 document.querySelectorAll("[data-replace]").forEach(b=>b.addEventListener("click",()=>replacePlayer(b.dataset.replace)));
 document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editEntry(b.dataset.edit)));
 document.querySelector('#login')?.addEventListener('submit',async e=>{e.preventDefault();pin=new FormData(e.target).get('pin');if(await action({type:'login'})){authenticated=true;sessionStorage.setItem('courtside-pin',pin);document.activeElement.blur();render();}});
 document.querySelector('#logout')?.addEventListener('click',()=>{authenticated=false;pin='';sessionStorage.removeItem('courtside-pin');render();});
 document.querySelector('#pair-mode')?.addEventListener('change',e=>{const fields=document.querySelector('#partner-fields');fields.hidden=e.target.value!=='pair';fields.querySelector('input').required=!fields.hidden;});
 document.querySelector('#join-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;const f=new FormData(form);const button=form.querySelector('button');button.disabled=true;
 try{const body={type:'join',player:{name:f.get('name'),skill:f.get('skill'),photo:await readPhoto(form,'photo')}};
 if(f.get('pairMode')==='pair')body.partner={name:f.get('partner'),skill:f.get('partnerSkill'),photo:await readPhoto(form,'partnerPhoto')};
 if(await action(body)){joined=!admin;document.activeElement.blur();render();toast('Added to the queue.');}
 }catch(error){actionError(error.message);}finally{button.disabled=false;}});
 document.querySelector('#another')?.addEventListener('click',()=>{joined=false;render();});
 document.querySelector('#logo-form')?.addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
 try{const logo=await readPhoto(e.target,'logo',state.logo,{maxDimension:512,transparent:true});if(await action({type:'setLogo',logo:logo||null})){document.activeElement.blur();render();toast(logo?'Logo updated.':'Logo removed.');}}catch(error){actionError(error.message);}finally{button.disabled=false;}
 });
 document.querySelector('#court-form')?.addEventListener('submit',async e=>{e.preventDefault();if(await action({type:'addCourt',name:new FormData(e.target).get('court')})){document.activeElement.blur();render();}});
 document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',async()=>{if(b.dataset.action==='remove'&&!confirm('Remove this queue entry? Locked partners will both be removed.'))return;b.disabled=true;if(await action({type:b.dataset.action,id:b.dataset.id,matchId:b.dataset.match})){render();}else b.disabled=false;}));
}
function tick(){document.querySelectorAll('[data-time]').forEach(el=>{const sec=Math.max(0,Math.floor((Date.now()-Number(el.dataset.time))/1000));el.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;});const clock=document.querySelector('#clock');if(clock)clock.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
async function boot(){try{const res=await fetch('/api/state');if(!res.ok)throw Error();const data=await res.json();base=data.base;state=data;online=true;if(admin&&pin)authenticated=await action({type:'login'});render();}catch{app.innerHTML='<main><h1>Connecting to the court…</h1><p>Check that the venue server is running and you are on the same Wi-Fi.</p></main>';setTimeout(boot,3000);}}
const events=new EventSource('/events');events.onmessage=e=>{state=JSON.parse(e.data);online=true;render();};events.onerror=()=>{online=false;const status=document.querySelector('.live');if(status){status.classList.add('offline');status.innerHTML='<span class="dot"></span>Reconnecting to venue server';}};events.onopen=()=>{online=true;};setInterval(tick,1000);boot();
