const crypto = require('node:crypto');
const levels={Beginner:1,'Low Inter':2,'High Inter':3,Advance:4};
const normalizeSkill=skill=>skill==='Intermediate'?'Low Inter':skill==='Advanced'?'Advance':skill;
const id=()=>crypto.randomUUID();
function initialState(){return {courts:[{id:id(),name:'Court 1',enabled:true,match:null},{id:id(),name:'Court 2',enabled:true,match:null}],queue:[],history:{},completed:0};}
function publicState(s){return {...s,history:undefined,profiles:undefined};}
function migrateState(s){if(!s.gamesPlayed){s.gamesPlayed={};for(const [team,total] of Object.entries(s.history||{}))for(const playerId of team.split(':'))s.gamesPlayed[playerId]=(s.gamesPlayed[playerId]||0)+total;}s.profiles ||= {};for(const p of [...Object.values(s.profiles),...s.queue.flatMap(e=>e.players),...s.courts.flatMap(c=>c.match?[...c.match.entries.flatMap(e=>e.players),...c.match.teams.flat()]:[])])p.skill=normalizeSkill(p.skill);for(const e of [...s.queue,...s.courts.flatMap(c=>c.match?c.match.entries:[])])for(const p of e.players)s.profiles[p.id]={...p};return s;}
function photo(value){if(value==null||value==='')return undefined;if(typeof value!=='string'||!/^\/photos\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(value))throw Error('Choose a valid player photo.');return value;}
function name(value){if(typeof value!=='string'||!value.trim()||value.trim().length>40)throw Error('Use a name between 1 and 40 characters.');return value.trim();}
function player(value){if(!value||!Object.hasOwn(levels,normalizeSkill(value.skill)))throw Error('Choose a valid skill level.');return {id:id(),name:name(value.name),skill:normalizeSkill(value.skill),photo:photo(value.photo)};}
function teamKey(a,b){return [a.id,b.id].sort().join(':');}
function splitTeams(entries,history){
 const p=entries.flatMap(e=>e.players);const options=[[0,1,2,3],[0,2,1,3],[0,3,1,2]];
 let best=null;
 for(const indices of options){const teams=[indices.slice(0,2).map(i=>p[i]),indices.slice(2).map(i=>p[i])];
 if(entries.some(e=>e.players.length===2&&!teams.some(t=>e.players.every(p=>t.some(q=>p.id===q.id)))))continue;
 const balance=Math.abs(teams[0].reduce((n,p)=>n+levels[p.skill],0)-teams[1].reduce((n,p)=>n+levels[p.skill],0));
 const repeats=teams.reduce((n,t)=>n+(history[teamKey(...t)]||0),0);
 const score=balance*1000000+repeats;
 if(!best||score<best.score||(score===best.score&&Math.random()<.5))best={teams,score};
 }return best.teams;
}
function nextEntries(queue){
 function search(start,selected,count){if(count===4)return selected;for(let i=start;i<queue.length;i++){const size=queue[i].players.length;if(count+size>4)continue;const found=search(i+1,[...selected,queue[i]],count+size);if(found)return found;}return null;}
 return search(0,[],0);
}
function fill(s,court){if(!court.enabled||court.match)return;const entries=nextEntries(s.queue);if(!entries)return;const teams=splitTeams(entries,s.history);const ids=new Set(entries.map(e=>e.id));s.queue=s.queue.filter(e=>!ids.has(e.id));court.match={id:id(),entries,teams,startedAt:Date.now()};}
function applyAction(input,a){const s=migrateState(structuredClone(input));
 switch(a.type){
 case 'login':break;
 case 'setLogo':s.logo=photo(a.logo)||null;break;
 case 'join':{
 const players=[player(a.player)];if(a.partner)players.push(player(a.partner));
 const existing=[...s.queue,...s.courts.flatMap(c=>c.match?c.match.entries:[])].flatMap(e=>e.players);
 const names=new Set(existing.map(p=>p.name.toLowerCase()));
 for(const p of players){if(names.has(p.name.toLowerCase()))throw Error('That name is already checked in. Add a surname or initial to distinguish players.');names.add(p.name.toLowerCase());}
 for(const p of players)if(Object.values(s.profiles).some(saved=>saved.name.toLowerCase()===p.name.toLowerCase()))throw Error('This player is already saved. Use Returning players in organizer controls to check them in.');
 if(existing.length+players.length>1000)throw Error('The session is full.');
 s.queue.push({id:id(),players,joinedAt:Date.now()});break;
 }
 case 'checkIn':{
 if(!Array.isArray(a.playerIds)||a.playerIds.length<1||a.playerIds.length>2||new Set(a.playerIds).size!==a.playerIds.length)throw Error('Choose one player or two different players for a locked pair.');
 const players=a.playerIds.map(id=>{const p=Object.hasOwn(s.profiles,id)?s.profiles[id]:null;if(!p)throw Error('Saved player not found.');return {...p};});
 const active=[...s.queue,...s.courts.flatMap(c=>c.match?c.match.entries:[])].flatMap(e=>e.players);
 if(active.length+players.length>1000)throw Error('The session is full.');
 if(players.some(p=>active.some(q=>q.id===p.id||q.name.toLowerCase()===p.name.toLowerCase())))throw Error('This player is already checked in.');
 s.queue.push({id:id(),players,joinedAt:Date.now()});break;
 }
 case 'addCourt':if(s.courts.length>=100)throw Error('A session supports up to 100 courts.');s.courts.push({id:id(),name:name(a.name),enabled:true,match:null});break;
 case 'deleteCourt':{const c=s.courts.find(c=>c.id===a.id);if(!c)throw Error('Court not found.');if(c.match)throw Error('Finish the active match before deleting this court.');s.courts=s.courts.filter(x=>x.id!==c.id);break;}
 case 'toggleCourt':{const c=s.courts.find(c=>c.id===a.id);if(!c)throw Error('Court not found.');if(c.match)throw Error('Finish the current match before pausing this court.');c.enabled=!c.enabled;break;}
 case 'start':{const c=s.courts.find(c=>c.id===a.id);if(!c)throw Error('Court not found.');if(c.match)throw Error('This court already has a match.');fill(s,c);if(!c.match)throw Error('Need a complete group of four players.');break;}
 case 'finish':case 'finishSitOut':{const c=s.courts.find(c=>c.id===a.id);if(!c||!c.match||c.match.id!==a.matchId)throw Error('This match has already changed. Refresh and try again.');const match=c.match;for(const p of match.entries.flatMap(e=>e.players))s.gamesPlayed[p.id]=(s.gamesPlayed[p.id]||0)+1;for(const team of match.teams){const key=teamKey(...team);s.history[key]=(s.history[key]||0)+1;}s.queue.push(...match.entries);s.completed++;c.match=null;if(a.type==='finish')fill(s,c);break;}
 case 'replace':{
 const court=s.courts.find(c=>c.id===a.id);
 if(!court||!court.match||court.match.id!==a.matchId)throw Error('This court has changed. Close this window and try again.');
 const entry=court.match.entries.find(e=>e.players.some(p=>p.id===a.playerId));
 if(!entry)throw Error('That player is no longer on this court.');
 const replacement=s.queue.find(e=>e.id===a.replacementId);
 if(!replacement)throw Error('The replacement is no longer waiting. Choose another player.');
 if(replacement.players.length!==1)throw Error('Choose an individual waiting player. Locked pairs cannot be split.');
 if(!['leave','queue'].includes(a.destination))throw Error('Choose whether the outgoing player leaves or rejoins the queue.');
 if(entry.players.length===2&&a.unlockPair!==true)throw Error('Confirm unlocking the outgoing player’s locked pair.');
 const outgoing=entry.players.find(p=>p.id===a.playerId);
 s.queue=s.queue.filter(e=>e.id!==replacement.id);
 court.match.entries=court.match.entries.flatMap(e=>e.id!==entry.id?[e]:e.players.map(p=>p.id===outgoing.id?replacement:{...e,players:[p]}));
 if(a.destination==='queue')s.queue.push({id:entry.players.length===1?entry.id:id(),players:[outgoing],joinedAt:Date.now()});
 court.match.teams=splitTeams(court.match.entries,s.history);
 court.match.id=id();break;
 }
 case 'edit':{
 const entry=s.queue.find(e=>e.id===a.id);
 if(!entry)throw Error('This entry is no longer waiting. Only waiting players can be edited.');
 if(!Array.isArray(a.players)||a.players.length!==entry.players.length)throw Error('Keep the existing players in this entry.');
 const players=a.players.map((value,i)=>({...player(value),id:entry.players[i].id,photo:Object.hasOwn(value,'photo')?photo(value.photo):entry.players[i].photo}));
 const others=[...s.queue.filter(e=>e.id!==entry.id),...s.courts.flatMap(c=>c.match?c.match.entries:[])].flatMap(e=>e.players);
 const editedIds=new Set(players.map(p=>p.id));
 const names=new Set([...others,...Object.values(s.profiles).filter(p=>!editedIds.has(p.id))].map(p=>p.name.toLowerCase()));
 for(const p of players){if(names.has(p.name.toLowerCase()))throw Error('That name is already checked in. Add a surname or initial to distinguish players.');names.add(p.name.toLowerCase());}
 entry.players=players;break;
 }
 case 'remove':{if(!s.queue.some(e=>e.id===a.id))throw Error('Player is no longer waiting.');s.queue=s.queue.filter(e=>e.id!==a.id);break;}
 default:throw Error('Unknown action.');
 }return migrateState(s);
}
module.exports={initialState,publicState,applyAction,nextEntries,splitTeams,migrateState};
