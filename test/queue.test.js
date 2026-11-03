const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initialState,applyAction,nextEntries}=require('../queue');
const add=(s,name,skill='Low Inter',partner)=>applyAction(s,{type:'join',player:{name,skill},partner});
test('FIFO rotation returns all four after waiting players and starts next four',()=>{
 let s=initialState();for(let i=1;i<=8;i++)s=add(s,`Player ${i}`);
 const court=s.courts[0].id;s=applyAction(s,{type:'start',id:court});
 assert.deepEqual(s.courts[0].match.entries.flatMap(e=>e.players.map(p=>p.name)),['Player 1','Player 2','Player 3','Player 4']);
 const matchId=s.courts[0].match.id;
 s=applyAction(s,{type:'finish',id:court,matchId});
 assert.deepEqual(s.courts[0].match.entries.flatMap(e=>e.players.map(p=>p.name)),['Player 5','Player 6','Player 7','Player 8']);
 assert.deepEqual(s.queue.flatMap(e=>e.players.map(p=>p.name)),['Player 1','Player 2','Player 3','Player 4']);
 assert.throws(()=>applyAction(s,{type:'finish',id:court,matchId}),/already changed/);
 assert.equal(s.completed,1);
});
test('skill balancing splits strongest and weakest across equally strong teams',()=>{
 let s=initialState();for(const [n,skill]of [['A','Advance'],['B','Advance'],['C','Beginner'],['D','Beginner']])s=add(s,n,skill);
 s=applyAction(s,{type:'start',id:s.courts[0].id});for(const team of s.courts[0].match.teams)assert.deepEqual(team.map(p=>p.skill).sort(),['Advance','Beginner']);
});
test('locked pairs never split, and unmatched early players retain their position',()=>{
 let s=initialState();s=add(s,'Solo');s=add(s,'A','Advance',{name:'B',skill:'Advance'});s=add(s,'C','Beginner',{name:'D',skill:'Beginner'});
 s=applyAction(s,{type:'start',id:s.courts[0].id});assert.equal(s.queue[0].players[0].name,'Solo');
 const teams=s.courts[0].match.teams.map(t=>t.map(p=>p.name).sort().join(''));
 assert.deepEqual(teams.sort(),['AB','CD']);
 s=applyAction(s,{type:'finish',id:s.courts[0].id,matchId:s.courts[0].match.id});assert.equal(s.queue[0].players[0].name,'Solo');
});
test('teammates vary when equally balanced alternatives exist',()=>{
 let s=initialState();for(const n of ['A','B','C','D'])s=add(s,n);
 s=applyAction(s,{type:'start',id:s.courts[0].id});const first=s.courts[0].match.teams.map(t=>t.map(p=>p.id).sort().join(':'));
 s=applyAction(s,{type:'finish',id:s.courts[0].id,matchId:s.courts[0].match.id});for(const t of s.courts[0].match.teams)assert.ok(!first.includes(t.map(p=>p.id).sort().join(':')));
});
test('court allocations cannot share players; incomplete groups cannot start',()=>{
 let s=initialState();for(let i=0;i<7;i++)s=add(s,`P${i}`);s=applyAction(s,{type:'start',id:s.courts[0].id});
 assert.throws(()=>applyAction(s,{type:'start',id:s.courts[1].id}),/complete group/);
 s=add(s,'P7');s=applyAction(s,{type:'start',id:s.courts[1].id});const ids=s.courts.flatMap(c=>c.match.teams.flat().map(p=>p.id));assert.equal(new Set(ids).size,8);
});
test('invalid and duplicate registrations do not change state',()=>{
 let s=add(initialState(),'Alex');assert.throws(()=>add(s,' alex '),/already checked in/);assert.throws(()=>add(s,'','Advance'),/name/);assert.throws(()=>add(s,'Jamie','Expert'),/skill/);assert.equal(s.queue.length,1);
});
test('paused courts cannot start and active courts cannot pause',()=>{
 let s=initialState();for(let i=0;i<4;i++)s=add(s,`P${i}`);const id=s.courts[0].id;s=applyAction(s,{type:'toggleCourt',id});assert.throws(()=>applyAction(s,{type:'start',id}),/complete group/);s=applyAction(s,{type:'toggleCourt',id});s=applyAction(s,{type:'start',id});assert.throws(()=>applyAction(s,{type:'toggleCourt',id}),/Finish/);
});
test('editing a waiting pair preserves position, identities, and teammate history',()=>{
 let s=add(initialState(),'First');s=add(s,'Alex','Low Inter',{name:'Sam',skill:'Beginner'});
 const original=structuredClone(s.queue[1]);s.history['existing-pair']=3;
 s=applyAction(s,{type:'edit',id:original.id,players:[{name:'Alex R',skill:'Advance'},{name:'Sam T',skill:'Low Inter'}]});
 assert.equal(s.queue[0].players[0].name,'First');assert.equal(s.queue[1].id,original.id);
 assert.equal(s.queue[1].joinedAt,original.joinedAt);assert.deepEqual(s.queue[1].players.map(p=>p.id),original.players.map(p=>p.id));
 assert.equal(s.queue[1].players[0].name,'Alex R');assert.equal(s.queue[1].players[0].skill,'Advance');assert.equal(s.history['existing-pair'],3);
});
test('edits reject duplicate names, invalid skills, and entries already on court',()=>{
 let s=initialState();for(const n of ['A','B','C','D','E'])s=add(s,n);
 const id=s.queue[4].id;
 assert.throws(()=>applyAction(s,{type:'edit',id,players:[{name:' a ',skill:'Advance'}]}),/already checked in/);
 assert.throws(()=>applyAction(s,{type:'edit',id,players:[{name:'E',skill:'Expert'}]}),/skill/);
 assert.throws(()=>applyAction(s,{type:'edit',id,players:[]}),/existing players/);
 const playingId=s.queue[0].id;s=applyAction(s,{type:'start',id:s.courts[0].id});
 assert.throws(()=>applyAction(s,{type:'edit',id:playingId,players:[{name:'Changed',skill:'Advance'}]}),/no longer waiting/);
 assert.throws(()=>applyAction(s,{type:'edit',id,players:[{name:'A',skill:'Advance'}]}),/already checked in/);
 assert.equal(s.queue[0].players[0].name,'E');
});
test('court replacement removes a departed player and preserves timer, queue order, and identities',()=>{
 let s=initialState();for(const n of ['A','B','C','D','E','F'])s=add(s,n);
 const id=s.courts[0].id;s=applyAction(s,{type:'start',id});const old=structuredClone(s.courts[0].match);
 const replacement=s.queue[1];const outgoing=old.entries[0].players[0];
 s=applyAction(s,{type:'replace',id,matchId:old.id,playerId:outgoing.id,replacementId:replacement.id,destination:'leave'});
 const match=s.courts[0].match;assert.equal(match.startedAt,old.startedAt);assert.notEqual(match.id,old.id);
 assert.deepEqual(match.entries.flatMap(e=>e.players.map(p=>p.name)),['F','B','C','D']);assert.equal(match.entries[0].players[0].id,replacement.players[0].id);
 assert.deepEqual(s.queue.flatMap(e=>e.players.map(p=>p.name)),['E']);assert.equal(s.completed,0);
 assert.throws(()=>applyAction(s,{type:'finish',id,matchId:old.id}),/already changed/);
 s=applyAction(s,{type:'finish',id,matchId:match.id});
 assert.ok(!JSON.stringify(require('../queue').publicState(s)).includes(outgoing.id));
});
test('replacement can return outgoing player to queue; stale replacement is rejected',()=>{
 let s=initialState();for(const n of ['A','B','C','D','E','F'])s=add(s,n);const id=s.courts[0].id;s=applyAction(s,{type:'start',id});
 const a={type:'replace',id,matchId:s.courts[0].match.id,playerId:s.courts[0].match.entries[0].players[0].id,replacementId:s.queue[0].id,destination:'queue'};
 const original=structuredClone(s);assert.throws(()=>applyAction(s,{...a,replacementId:'missing'}),/no longer waiting/);assert.deepEqual(s,original);
 s=applyAction(s,a);assert.deepEqual(s.queue.flatMap(e=>e.players.map(p=>p.name)),['F','A']);assert.equal(s.queue[1].players[0].id,a.playerId);
 assert.throws(()=>applyAction(s,a),/court has changed/);
});
test('locked court pair needs explicit unlock and a waiting pair cannot be split',()=>{
 let s=initialState();s=add(s,'A','Advance',{name:'B',skill:'Beginner'});for(const n of ['C','D','E'])s=add(s,n);s=add(s,'F','Advance',{name:'G',skill:'Beginner'});
 const id=s.courts[0].id;s=applyAction(s,{type:'start',id});const match=s.courts[0].match;
 const a={type:'replace',id,matchId:match.id,playerId:match.entries[0].players[0].id,replacementId:s.queue[0].id,destination:'queue'};
 assert.throws(()=>applyAction(s,a),/Confirm unlocking/);
 assert.throws(()=>applyAction(s,{...a,unlockPair:true,replacementId:s.queue[1].id}),/Locked pairs cannot be split/);
 s=applyAction(s,{...a,unlockPair:true});assert.equal(s.courts[0].match.entries.flatMap(e=>e.players).length,4);
 assert.equal(s.courts[0].match.entries.find(e=>e.players.some(p=>p.name==='B')).players.length,1);
 assert.equal(s.queue.at(-1).players[0].name,'A');assert.equal(s.queue.at(-1).players.length,1);
});
test('saved players can be checked in again with their original identity and photo',()=>{
 const photo='/photos/'+'a'.repeat(64)+'.jpg';
 let s=applyAction(initialState(),{type:'join',player:{name:'Returning Alex',skill:'Advance',photo}});
 const original=s.queue[0].players[0];s=applyAction(s,{type:'remove',id:s.queue[0].id});
 assert.deepEqual(s.profiles[original.id],original);
 assert.equal(require('../queue').publicState(s).profiles,undefined);
 s=applyAction(s,{type:'checkIn',playerIds:[original.id]});assert.deepEqual(s.queue[0].players[0],original);
 assert.throws(()=>applyAction(s,{type:'checkIn',playerIds:[original.id]}),/already checked in/);
});
test('editing a photo updates the saved profile; omitted photo is retained and null removes it',()=>{
 let s=add(initialState(),'Alex');const entry=s.queue[0],id=entry.players[0].id;
 const photo='/photos/'+'b'.repeat(64)+'.png';
 s=applyAction(s,{type:'edit',id:entry.id,players:[{name:'Alex R',skill:'Advance',photo}]});assert.equal(s.profiles[id].photo,photo);
 s=applyAction(s,{type:'edit',id:entry.id,players:[{name:'Alex R',skill:'Low Inter'}]});assert.equal(s.profiles[id].photo,photo);
 s=applyAction(s,{type:'edit',id:entry.id,players:[{name:'Alex R',skill:'Low Inter',photo:null}]});assert.equal(s.profiles[id].photo,undefined);
 assert.throws(()=>applyAction(s,{type:'edit',id:entry.id,players:[{name:'Alex R',skill:'Low Inter',photo:'javascript:alert(1)'}]}),/valid player photo/);
});
test('saved check-in supports locked partners and rejects invalid or duplicate selections',()=>{
 let s=add(initialState(),'Alex','Advance',{name:'Sam',skill:'Low Inter'});const ids=s.queue[0].players.map(p=>p.id);
 s=applyAction(s,{type:'remove',id:s.queue[0].id});
 assert.throws(()=>applyAction(s,{type:'checkIn',playerIds:[ids[0],ids[0]]}),/different players/);
 assert.throws(()=>applyAction(s,{type:'checkIn',playerIds:['missing']}),/not found/);
 assert.throws(()=>add(s,'Alex'),/already saved/);
 s=applyAction(s,{type:'checkIn',playerIds:ids});assert.equal(s.queue[0].players.length,2);assert.deepEqual(s.queue[0].players.map(p=>p.id),ids);
});
test('old session data migrates active players into the saved directory without changing queue',()=>{
 const {migrateState}=require('../queue');let s=add(initialState(),'Legacy');delete s.profiles;const queue=structuredClone(s.queue);
 s=migrateState(s);assert.deepEqual(s.queue,queue);assert.equal(Object.values(s.profiles)[0].name,'Legacy');
});
test('completed game counts increase once for current court players and survive edits and recheck-in',()=>{
 let s=initialState();for(const n of ['A','B','C','D','E'])s=add(s,n);
 const id=s.courts[0].id;const originalId=s.queue[0].players[0].id;
 s=applyAction(s,{type:'start',id});assert.equal(s.gamesPlayed[originalId]||0,0);
 const matchId=s.courts[0].match.id;const players=s.courts[0].match.entries.flatMap(e=>e.players);
 s=applyAction(s,{type:'finish',id,matchId});for(const p of players)assert.equal(s.gamesPlayed[p.id],1);
 assert.throws(()=>applyAction(s,{type:'finish',id,matchId}),/already changed/);assert.equal(s.gamesPlayed[originalId],1);
 const waiting=s.queue[0];s=applyAction(s,{type:'edit',id:waiting.id,players:waiting.players.map(p=>({name:p.name+' edited',skill:p.skill}))});
 const playerId=waiting.players[0].id;s=applyAction(s,{type:'remove',id:waiting.id});s=applyAction(s,{type:'checkIn',playerIds:[playerId]});assert.equal(s.gamesPlayed[playerId],1);
});
test('replacement credits only the four players present when the match finishes',()=>{
 let s=initialState();for(const n of ['A','B','C','D','E'])s=add(s,n);const id=s.courts[0].id;s=applyAction(s,{type:'start',id});
 const outgoing=s.courts[0].match.entries[0].players[0].id,replacement=s.queue[0];
 s=applyAction(s,{type:'replace',id,matchId:s.courts[0].match.id,playerId:outgoing,replacementId:replacement.id,destination:'leave'});
 s=applyAction(s,{type:'finish',id,matchId:s.courts[0].match.id});assert.equal(s.gamesPlayed[outgoing]||0,0);assert.equal(s.gamesPlayed[replacement.players[0].id],1);
});
test('legacy counts initialize from completed history once',()=>{
 const {migrateState}=require('../queue');const s=initialState();s.history={'alex:sam':2,'alex:robin':1};migrateState(s);assert.deepEqual(s.gamesPlayed,{alex:3,sam:2,robin:1});s.history['alex:sam']=8;migrateState(s);assert.equal(s.gamesPlayed.alex,3);
});
test('legacy skills migrate in saved profiles, waiting players, and active courts',()=>{
 const {migrateState}=require('../queue');let s=initialState();for(const n of ['A','B','C','D','E'])s=add(s,n);s=applyAction(s,{type:'start',id:s.courts[0].id});
 for(const p of Object.values(s.profiles))p.skill='Advanced';
 s.queue[0].players[0].skill='Intermediate';for(const p of s.courts[0].match.entries.flatMap(e=>e.players))p.skill='Advanced';for(const p of s.courts[0].match.teams.flat())p.skill='Advanced';
 s=migrateState(s);assert.equal(s.queue[0].players[0].skill,'Low Inter');assert.ok(s.courts[0].match.entries.every(e=>e.players.every(p=>p.skill==='Advance')));assert.ok(s.courts[0].match.teams.flat().every(p=>p.skill==='Advance'));
 for(const level of ['Beginner','Low Inter','High Inter','Advance'])assert.equal(add(initialState(),level,level).queue[0].players[0].skill,level);
});
