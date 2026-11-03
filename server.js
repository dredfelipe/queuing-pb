const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { initialState, applyAction, publicState, migrateState } = require('./queue');
const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dir, {recursive:true});
const file = path.join(dir,'session.json');
let state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : initialState();
migrateState(state);
const photosDir=path.join(dir,'photos');fs.mkdirSync(photosDir,{recursive:true});
const pinFile=path.join(dir,'organizer-pin');
const pin=process.env.ORGANIZER_PIN || (fs.existsSync(pinFile) ? fs.readFileSync(pinFile,'utf8').trim() : String(crypto.randomInt(100000,1000000)));
fs.writeFileSync(pinFile,pin,{mode:0o600});
const port=Number(process.env.PORT || 3000);
const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>`http://${x.address}:${port}`);
const base=process.env.PUBLIC_URL || addresses[0] || `http://localhost:${port}`;
const clients=new Set();
function save(){fs.writeFileSync(file+'.tmp',JSON.stringify(state));fs.renameSync(file+'.tmp',file);for(const res of clients) res.write(`data: ${JSON.stringify(publicState(state))}\n\n`);}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const attempts=new Map();
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/events') {res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(`data: ${JSON.stringify(publicState(state))}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;}
 if(url.pathname==='/api/state')return json(res,200,{...publicState(state),base});
 if(/^\/photos\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(url.pathname)){
 const photoFile=path.join(photosDir,path.basename(url.pathname));
 if(!fs.existsSync(photoFile)){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':url.pathname.endsWith('.jpg')?'image/jpeg':url.pathname.endsWith('.png')?'image/png':'image/webp','Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(photoFile));
 }
 if(url.pathname==='/qr.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end(await QRCode.toString(base+'/join',{type:'svg',margin:2}));}
 if(req.method==='POST'&&url.pathname==='/api/action'){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>850000)return json(res,413,{error:'Request too large'});}
 const body=JSON.parse(raw);
 if(body.type!=='join'){
 const ip=req.socket.remoteAddress;const entry=attempts.get(ip)||{count:0,until:0};
 if(entry.until>Date.now())return json(res,429,{error:'Too many PIN attempts. Try again in a minute.'});
 if(body.pin!==pin){entry.count++;if(entry.count>=10){entry.until=Date.now()+60000;entry.count=0;}attempts.set(ip,entry);return json(res,401,{error:'Enter the correct organizer PIN.'});}
 attempts.delete(ip);
 }
 if(body.type==='directory')return json(res,200,{players:Object.values(state.profiles||{})});
 const uploaded=[];const logoUpload=body.type==='setLogo'?{photo:body.logo}:null;if(logoUpload)uploaded.push(logoUpload);
 if(body.type==='join')uploaded.push(body.player,body.partner);
 if(body.type==='edit'&&Array.isArray(body.players))uploaded.push(...body.players);
 for(const value of uploaded.filter(Boolean))if(typeof value.photo==='string'&&value.photo.startsWith('data:')){
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.photo);
 if(!match||match[2].length>400000)throw Error('Use a JPEG, PNG, or WebP photo under 300 KB.');
 const bytes=Buffer.from(match[2],'base64');const type=match[1];
 if(type==='jpeg'&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||type==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||type==='webp'&&!(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))throw Error('This file is not a valid image.');
 const filename=crypto.createHash('sha256').update(bytes).digest('hex')+'.'+(type==='jpeg'?'jpg':type);
 fs.writeFileSync(path.join(photosDir,filename),bytes);value.photo='/photos/'+filename;
 }
 if(logoUpload)body.logo=logoUpload.photo;
 const next=applyAction(state,body);
 const previous=state;state=next;try{save();}catch(error){state=previous;throw error;}return json(res,200,publicState(state));
 }
 const name=url.pathname==='/app.js'?'app.js':url.pathname==='/style.css'?'style.css':'index.html';
 res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache'});res.end(fs.readFileSync(path.join(__dirname,'public',name)));
 }catch(e){json(res,400,{error:e.message});}
});
const heartbeat=setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n');},20000);heartbeat.unref();
server.listen(port,'0.0.0.0',()=>console.log(`\nCOURTSIDE\nTV: ${base}\nOrganizer: ${base}/admin\nPlayer registration: ${base}/join\nOrganizer PIN: ${pin}\nLocal: http://localhost:${port}\n`));
