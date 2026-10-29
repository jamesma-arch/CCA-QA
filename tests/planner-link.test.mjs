import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeHandler} from '../netlify/lib/core.mjs';
import {receivePlannerActivity} from '../netlify/lib/planner-link.mjs';
import {parsePlannerReview,resolvePlannerReview} from '../public/planner-link.js';
const key='synthetic-planner-qa-integration-key-for-tests';
const env={PLANNER_QA_ENABLED:'true',PLANNER_QA_SHARED_SECRET:key,STAFF_ACCESS_CODE:'test-staff',ADMIN_ACCESS_CODE:'test-admin',SESSION_SECRET:'synthetic-qa-session-key-with-32-characters'};
const memory=()=>{const m=new Map();return {m,get:async k=>structuredClone(m.get(k)||null),setJSON:async(k,v)=>m.set(k,structuredClone(v)),list:async({prefix})=>({blobs:[...m.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))})}};
const payload=()=>({version:1,source:'harrow-season-planner',sentAt:Date.now(),cycle:'2026-27-s2',revision:4,academicYear:'2026/27',seasonNumber:'2',role:'support',activity:{id:'club-1',title:'Lego Engineers',years:'Y3, Y4',school:'Lower School',day:'Monday',time:'14:50–15:50',room:'Studio',backup:'Hall',provider:'School-led activity',lead:'',season:'Season 2 2026/27',privateNotes:'PRIVATE_NOT_FOR_QA'}});
const signed=p=>{const raw=JSON.stringify(p);return {raw,signature:createHmac('sha256',key).update(raw).digest('base64url')}};
test('signed integration rejects missing config, forged signatures, stale payloads and invalid cycles',async()=>{
 const store=memory(),p=payload(),s=signed(p);
 assert.equal((await receivePlannerActivity(s.raw,s.signature,{store,env:{}})).status,503);
 assert.equal((await receivePlannerActivity(s.raw,'forged',{store,env})).status,401);
 const old=signed({...p,sentAt:Date.now()-360000});assert.equal((await receivePlannerActivity(old.raw,old.signature,{store,env})).status,400);
 const wrong=signed({...p,cycle:'2027-28-s1'});assert.equal((await receivePlannerActivity(wrong.raw,wrong.signature,{store,env})).status,400);assert.equal(store.m.size,0);
});
test('sync is idempotent, preserves existing QA notes and reviews, and rejects older revisions',async()=>{
 const store=memory(),p=payload();let s=signed(p),r=await receivePlannerActivity(s.raw,s.signature,{store,env}),{activityId}=await r.json();
 const a=await store.get('activity/'+activityId);assert.equal(a.plannerSource.academicYear,'2026/27');assert.ok(!JSON.stringify(a).includes('PRIVATE_NOT_FOR_QA'));
 a.context='Existing QA follow-up';await store.setJSON('activity/'+activityId,a);await store.setJSON('review/old',{activityId,review:'Keep this observation'});
 s=signed({...p,revision:5,activity:{...p.activity,room:'New room'}});r=await receivePlannerActivity(s.raw,s.signature,{store,env});assert.equal(r.status,200);assert.equal((await r.json()).activityId,activityId);
 const latest=await store.get('activity/'+activityId);assert.equal(latest.room,'New room');assert.equal(latest.context,a.context);assert.equal((await store.get('review/old')).review,'Keep this observation');
 s=signed(p);assert.equal((await receivePlannerActivity(s.raw,s.signature,{store,env})).status,409);
 latest.active=false;await store.setJSON('activity/'+activityId,latest);assert.equal((await receivePlannerActivity(s.raw,s.signature,{store,env})).status,409);
});
test('service sync does not create a QA login; deep link opens only a stored linked activity after normal authentication',async()=>{
 const store=memory(),handler=makeHandler({store,env}),s=signed(payload());
 const sync=await handler(new Request('https://qa.example/.netlify/functions/api?action=planner-sync',{method:'POST',headers:{'x-planner-signature':s.signature},body:s.raw}));assert.equal(sync.status,200);assert.equal(sync.headers.get('set-cookie'),null);
 const {activityId}=await sync.json();assert.equal((await handler(new Request('https://qa.example/.netlify/functions/api?action=data'))).status,401);
 const login=await handler(new Request('https://qa.example/.netlify/functions/api?action=login',{method:'POST',headers:{origin:'https://qa.example'},body:JSON.stringify({code:'test-staff',role:'staff'})}));
 const cookie=login.headers.get('set-cookie').split(';')[0],data=await (await handler(new Request('https://qa.example/.netlify/functions/api?action=data',{headers:{cookie}}))).json();
 const hint=parsePlannerReview('#planner-review='+activityId+'&role=support&academicYear=1900/01');assert.equal(resolvePlannerReview(data.activities,hint).activity.plannerSource.academicYear,'2026/27');assert.equal(parsePlannerReview('#planner-review=untrusted'),null);assert.equal(resolvePlannerReview([],hint),null);
});
