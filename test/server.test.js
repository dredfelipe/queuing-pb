const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
test('local HTTP flow: PIN, QR, live events, registration, and persisted restart',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'courtside-test-'));
 const port=32000+Math.floor(Math.random()*10000);const base=`http://127.0.0.1:${port}`;let child;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dir,ORGANIZER_PIN:'123456',PUBLIC_URL:base},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited: ${code}`));});child.stdout.on('data',()=>{clearTimeout(timer);resolve();});});}
 async function stop(){if(child&&child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}}
 async function action(body){const res=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};}
 try{await start();for(const route of ['/','/join','/admin','/app.js','/style.css'])assert.equal((await fetch(base+route)).status,200);
 assert.equal((await action({type:'addCourt',name:'Unauthorized'})).status,401);
 assert.equal((await action({type:'login',pin:'123456'})).status,200);
 const qr=await fetch(base+'/qr.svg');assert.match(await qr.text(),/<svg/);
 const events=await fetch(base+'/events');const reader=events.body.getReader();const initial=new TextDecoder().decode((await reader.read()).value);assert.match(initial,/data:/);
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
 const joined=await action({type:'join',player:{name:'Alex',skill:'Intermediate',photo},partner:{name:'Sam',skill:'Advanced'}});assert.equal(joined.status,200);assert.equal(joined.body.queue[0].players.length,2);assert.equal(joined.body.profiles,undefined);
 const photoPath=joined.body.queue[0].players[0].photo;assert.match(photoPath,/^\/photos\//);const image=await fetch(base+photoPath);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(image.status,200);
 assert.equal((await action({type:'directory'})).status,401);const directory=await action({type:'directory',pin:'123456'});assert.equal(directory.body.players.length,2);
 const update=new TextDecoder().decode((await reader.read()).value);assert.match(update,/Alex/);await reader.cancel();
 assert.equal((await action({type:'setLogo',logo:photo})).status,401);
 const beforeLogo=await(await fetch(base+'/api/state')).json();
 const logoResult=await action({type:'setLogo',logo:photo,pin:'123456'});assert.equal(logoResult.status,200);const logoPath=logoResult.body.logo;
 assert.match(logoPath,/^\/photos\//);assert.equal((await fetch(base+logoPath)).status,200);
 assert.deepEqual(logoResult.body.queue,beforeLogo.queue);assert.deepEqual(logoResult.body.courts,beforeLogo.courts);
 const logoEvents=await fetch(base+'/events');const logoReader=logoEvents.body.getReader();assert.match(new TextDecoder().decode((await logoReader.read()).value),new RegExp(logoPath));
 const invalidLogo=await action({type:'setLogo',logo:'data:image/png;base64,YmFk',pin:'123456'});assert.equal(invalidLogo.status,400);
 const unchanged=await(await fetch(base+'/api/state')).json();assert.equal(unchanged.logo,logoPath);
 await action({type:'setLogo',logo:photo,pin:'123456'});assert.match(new TextDecoder().decode((await logoReader.read()).value),new RegExp(logoPath));await logoReader.cancel();
 assert.equal((await action({type:'addCourt',name:'Patio',pin:'123456'})).status,200);
 await stop();await start();const s=await(await fetch(base+'/api/state')).json();assert.equal(s.queue[0].players[1].name,'Sam');assert.equal(s.courts[2].name,'Patio');assert.equal(s.base,base);assert.equal(s.logo,logoPath);
 assert.equal((await fetch(base+s.queue[0].players[0].photo)).status,200);
 const savedPlayerId=s.queue[0].players[0].id;await action({type:'remove',id:s.queue[0].id,pin:'123456'});
 const rejoined=await action({type:'checkIn',playerIds:[savedPlayerId],pin:'123456'});assert.equal(rejoined.status,200);assert.equal(rejoined.body.queue[0].players[0].photo,photoPath);
 const badImage=await action({type:'join',player:{name:'Bad image',skill:'Beginner',photo:'data:image/png;base64,YmFk'},pin:'123456'});assert.equal(badImage.status,400);
 const removedLogo=await action({type:'setLogo',logo:null,pin:'123456'});assert.equal(removedLogo.status,200);assert.equal(removedLogo.body.logo,null);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
