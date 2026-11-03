const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {initialState,applyAction,publicState}=require('../queue');
async function setup(failReplacement=false,logo=null){
 let state=applyAction(initialState(),{type:'join',player:{name:'Returning Robin',skill:'Advanced'}});state=applyAction(state,{type:'remove',id:state.queue[0].id});for(const name of ['Alex','Blair','Casey','Drew','Evan'])state=applyAction(state,{type:'join',player:{name,skill:'Intermediate'}});
 state=applyAction(state,{type:'start',id:state.courts[0].id});
 state.logo=logo;
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'http://localhost/admin',runScripts:'outside-only'});const w=dom.window;
 w.sessionStorage.setItem('courtside-pin','123456');w.EventSource=class {};w.setInterval=()=>0;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');this.querySelector('select,input,button')?.focus();};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');w.setTimeout(()=>this.dispatchEvent(new w.Event('close')),0);};
 w.fetch=async(url,options)=>{
 if(!options)return {ok:true,json:async()=>({...publicState(state),base:'http://localhost:3000'})};
 const body=JSON.parse(options.body);
 if(body.type==='directory')return {ok:true,json:async()=>({players:Object.values(state.profiles)})};
 if(body.type==='replace'&&failReplacement)return {ok:false,json:async()=>({error:'Unknown action.'})};
 state=applyAction(state,body);return {ok:true,json:async()=>publicState(state)};
 };
 w.eval(fs.readFileSync(require.resolve('../public/app.js'),'utf8'));
 await new Promise(resolve=>setImmediate(resolve));return {dom,w,getState:()=>state};
}
test('confirming replacement immediately refreshes the court even before asynchronous dialog close',async()=>{
 const {dom,w,getState}=await setup();try{
 w.document.querySelector('[data-replace]').click();const dialog=w.document.querySelector('dialog');const form=dialog.querySelector('form');
 const button=form.querySelector('[type="submit"]');button.focus();form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.document.querySelector('dialog'),null);
 const card=w.document.querySelector('.courts .card');assert.match(card.textContent,/Evan/);assert.doesNotMatch(card.textContent,/Alex/);
 assert.equal(getState().courts[0].match.entries[0].players[0].name,'Evan');
 }finally{dom.window.close();}
});
test('replacement errors are visible inside the modal and confirmation is reenabled',async()=>{
 const {dom,w}=await setup(true);try{
 w.document.querySelector('[data-replace]').click();const dialog=w.document.querySelector('dialog');const form=dialog.querySelector('form');form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(dialog.querySelector('[role="alert"]').textContent,/older version/);
 assert.equal(form.querySelector('[type="submit"]').disabled,false);assert.equal(dialog.open,true);
 assert.match(w.document.querySelector('.courts .card').textContent,/Alex/);
 }finally{dom.window.close();}
});
test('organizer can search archived players and check them in without reentering details',async()=>{
 const {dom,w,getState}=await setup();try{
 w.document.querySelector('#returning-players').click();await new Promise(resolve=>setImmediate(resolve));
 const dialog=w.document.querySelector('dialog');const search=dialog.querySelector('[name="directorySearch"]');search.value='  ROBIN ';search.dispatchEvent(new w.Event('input'));
 const list=dialog.querySelector('#directory-list');assert.match(list.textContent,/Returning Robin/);assert.doesNotMatch(list.textContent,/Alex/);
 const savedId=Object.values(getState().profiles).find(p=>p.name==='Returning Robin').id;
 dialog.querySelector('[data-check-in]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.document.querySelector('dialog'),null);assert.equal(getState().queue.at(-1).players[0].id,savedId);
 assert.match(w.document.querySelector('.queue').textContent,/Returning Robin/);
 }finally{dom.window.close();}
});
test('organizer sees the saved logo and can remove it without changing the queue',async()=>{
 const logo='/photos/'+'a'.repeat(64)+'.png';const {dom,w,getState}=await setup(false,logo);try{
 assert.equal(w.document.querySelector('.venue-logo').getAttribute('src'),logo);
 const queue=structuredClone(getState().queue);const form=w.document.querySelector('#logo-form');assert.equal(form.querySelector('.photo-preview').getAttribute('src'),logo);
 form.querySelector('[name="remove-logo"]').checked=true;form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(getState().logo,null);assert.equal(w.document.querySelector('.venue-logo'),null);assert.deepEqual(getState().queue,queue);
 }finally{dom.window.close();}
});
