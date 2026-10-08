import {keyFor} from '../../public/import-data.js';
import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
export const checks=['Register / attendance accurate','Clear instructions / routines','Resources ready and suitable','TA / staff role being used well','Positive relationships visible','Students engaged and purposeful','Safe organisation and supervision','Behaviour expectations clear','Differentiation / support evident','Dismissal / parent pick-up clear'];
const res=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
const sign=(value,secret)=>createHmac('sha256',secret).update(value).digest('base64url');
const str=(v,max=3000)=>typeof v==='string'&&v.length<=max?v.trim():null;
function validateStaff(b){const s={};for(const k of ['code','title','forename','middle','surname','preferredName','email','teaching','status','roleType','division','employeeId']){s[k]=str(b[k]??'',300);if(s[k]===null)throw Error('Staff fields must be text, at most 300 characters.');}if(!s.surname||(!s.forename&&!s.preferredName)||!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(s.email))throw Error('Each staff record needs a valid name and school email.');s.email=s.email.toLowerCase();return s;}
function validateActivity(b){const a={};for(const k of ['title','years','school','day','lead','leadEmail','room','season','reviewStage','sessionsObserved','provider','contact','strengths','priorities','context','time','muster','pickup','backup','capacity','students','support']){a[k]=str(b[k]??'');if(a[k]===null)throw Error('Activity fields must be text, at most 3,000 characters.');}if(!a.title||!a.provider||!a.years||!a.season||!['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(a.day)||!['Lower School','Upper School'].includes(a.school))throw Error('Complete the required activity details.');if(a.leadEmail&&!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(a.leadEmail))throw Error('Enter a valid school lead email address.');a.active=b.active!==false;return a;}
export function makeHandler({store,env,seed=[]}){return async function(req){
try{
 const url=new URL(req.url),action=url.searchParams.get('action')||'data',method=req.method;
 if(!['GET','POST'].includes(method))return res({error:'Method not allowed.'},405);
 if(method==='POST'&&req.headers.get('origin')!==url.origin)return res({error:'Request origin not permitted.'},403);
 if(!env.STAFF_ACCESS_CODE||!env.ADMIN_ACCESS_CODE||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||env.STAFF_ACCESS_CODE===env.ADMIN_ACCESS_CODE)return res({error:'Staff access has not been configured. Ask the CCA administrator to complete setup.'},503);
 let b={};if(method==='POST'){if(Number(req.headers.get('content-length'))>60000)return res({error:'Request too large.'},413);const raw=await req.text();if(raw.length>60000)return res({error:'Request too large.'},413);try{b=JSON.parse(raw)}catch{return res({error:'Invalid request.'},400)}}
 const cookie=req.headers.get('cookie')?.split('; ').find(x=>x.startsWith('cca_session='))?.slice(12);let auth;
 if(cookie){const [payload,sig]=cookie.split('.');if(sig&&equal(sign(payload,env.SESSION_SECRET),sig)){try{auth=JSON.parse(Buffer.from(payload,'base64url'));if(auth.exp<Date.now()||!['staff','admin'].includes(auth.role)||auth.rev!==sign(auth.role==='admin'?env.ADMIN_ACCESS_CODE:env.STAFF_ACCESS_CODE,env.SESSION_SECRET))auth=null}catch{auth=null}}}
 if(action==='login'&&method==='POST'){
  const role=equal(b.code??'',env.ADMIN_ACCESS_CODE)?'admin':equal(b.code??'',env.STAFF_ACCESS_CODE)?'staff':null;
  if(!role||b.role&&b.role!==role)return res({error:'Access code not recognised.'},401);
  const payload=Buffer.from(JSON.stringify({role,exp:Date.now()+8*3600000,rev:sign(role==='admin'?env.ADMIN_ACCESS_CODE:env.STAFF_ACCESS_CODE,env.SESSION_SECRET)})).toString('base64url');
  return res({role},200,{'Set-Cookie':`cca_session=${payload}.${sign(payload,env.SESSION_SECRET)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
 }
 if(action==='logout'&&method==='POST')return res({ok:true},200,{'Set-Cookie':'cca_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 if(!auth)return res({error:'Please sign in to continue.'},401);
 const all=async prefix=>{const result=await store.list({prefix});return (await Promise.all(result.blobs.map(x=>store.get(x.key,{type:'json'})))).filter(Boolean)};
 const activities=async()=>{const existing=await all('activity/');return [...seed.filter(a=>!existing.some(e=>e.id===a.id)),...existing]};
 if(action==='data'&&method==='GET'){const reviews=await all('review/');return res({role:auth.role,activities:await activities(),reviews:auth.role==='admin'?reviews:[],followUps:auth.role==='admin'?await all('followup/'):[],staffDirectory:auth.role==='admin'?await all('staff/'):[],reviewProgress:reviews.filter(r=>r.reviewType).map(({activityId,academicYear,seasonNumber,reviewType})=>({activityId,academicYear,seasonNumber,reviewType}))})}
 if(action==='review'&&method==='POST'){
  const activity=(await activities()).find(a=>a.id===b.activityId&&a.active);if(!activity)return res({error:'Activity is unavailable. Refresh the activity list.'},400);
  if(!str(b.reviewer,100)||!str(b.review,5000)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date??'')||!Number.isInteger(b.score)||b.score<1||b.score>5||!Array.isArray(b.checklist)||b.checklist.length!==checks.length||b.checklist.some(v=>!['yes','no','na'].includes(v))||!['Routine','Follow-up','Urgent'].includes(b.priority)||!str(b.nextSteps??'',5000)&&b.priority!=='Routine')return res({error:'Complete the observation, checklist, score and required next steps.'},400);
  if(!/^(?:[1-9]|10)$/.test(String(b.sessions??'')))return res({error:'Select between 1 and 10 sessions observed.'},400);
  if(!['Mid-season','End-of-season'].includes(b.reviewType)||!/^\d{4}\/\d{2}$/.test(b.academicYear??'')||Number(b.academicYear.slice(5))!==(Number(b.academicYear.slice(0,4))+1)%100||!['1','2','3'].includes(String(b.seasonNumber)))return res({error:'Select the academic year, season and review type.'},400);
  if(b.due&&!/^\d{4}-\d{2}-\d{2}$/.test(b.due))return res({error:'Invalid due date.'},400);
  const nextSteps=str(b.nextSteps??'',5000),strengths=str(b.strengths??'',5000),sessions=String(b.sessions),owner=str(b.owner??'',100),due=str(b.due??'',20);
  if([nextSteps,strengths,sessions,owner,due].some(v=>v===null))return res({error:'One or more fields exceed the text limit.'},400);
  const review={id:randomUUID(),activityId:activity.id,activitySnapshot:activity,academicYear:b.academicYear,seasonNumber:String(b.seasonNumber),reviewType:b.reviewType,reviewer:str(b.reviewer,100),date:b.date,score:b.score,checklist:b.checklist,priority:b.priority,review:str(b.review,5000),nextSteps,strengths,sessions,owner,due,status:'Open',createdAt:new Date().toISOString()};await store.setJSON('review/'+review.id,review);return res({review},201);
 }
 if(auth.role!=='admin')return res({error:'Administrator access required.'},403);
 if(action==='followup'&&method==='POST'){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(b.reviewId??''))return res({error:'Invalid review identifier.'},400);
  const original=await store.get('review/'+b.reviewId,{type:'json'});if(!original)return res({error:'Review not found.'},404);
  if(!str(b.reviewer,100)||!str(b.review,5000)||!/^\d{4}-\d{2}-\d{2}$/.test(b.date??'')||!Number.isInteger(b.score)||b.score<1||b.score>5||!['In progress','Closed'].includes(b.status)||b.status==='Closed'&&b.score<4)return res({error:'Complete the follow-up review. Scores below 4 must remain In progress.'},400);
  const nextSteps=str(b.nextSteps??'',5000),owner=str(b.owner??'',100),due=str(b.due??'',20);
  if([nextSteps,owner,due].some(v=>v===null)||b.status!=='Closed'&&!nextSteps||due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))return res({error:'Add next steps for an ongoing follow-up and a valid due date.'},400);
  const followUp={id:randomUUID(),reviewId:original.id,activityId:original.activityId,reviewer:str(b.reviewer,100),date:b.date,score:b.score,review:str(b.review,5000),nextSteps,owner,due,status:b.status,createdAt:new Date().toISOString()};
  await store.setJSON('followup/'+followUp.id,followUp);original.status=b.status;original.owner=owner||original.owner;original.due=due;await store.setJSON('review/'+original.id,original);return res({followUp,review:original},201);
 }
 if(action==='staffDirectory'&&method==='POST'){
  if(!Array.isArray(b.staff)||!b.staff.length||b.staff.length>100)return res({error:'Import between 1 and 100 staff records per request.'},400);
  let incoming;try{incoming=b.staff.map(validateStaff)}catch(e){return res({error:e.message},400)}
  if(new Set(incoming.map(s=>s.email)).size!==incoming.length)return res({error:'Duplicate staff emails in import batch.'},400);
  const existing=await all('staff/');let saved=0,added=0,updated=0;
  try{for(const item of incoming){const previous=existing.find(s=>s.email===item.email||item.employeeId&&s.employeeId===item.employeeId||item.code&&s.code===item.code);const s={...previous,...item,id:previous?.id||randomUUID()};await store.setJSON('staff/'+s.id,s);if(previous)Object.assign(previous,s);else existing.push(s);saved++;previous?updated++:added++}}catch{return res({error:'Staff directory import interrupted. Refresh and retry.',saved,added,updated},503)}
  return res({saved,added,updated});
 }
 if(action==='import'&&method==='POST'){
  if(!Array.isArray(b.activities)||!b.activities.length||b.activities.length>50)return res({error:'Import between 1 and 50 activities per request.'},400);
  let incoming;try{incoming=b.activities.map(validateActivity)}catch(e){return res({error:e.message},400)}
  if(new Set(incoming.map(keyFor)).size!==incoming.length)return res({error:'Duplicate activities in import.'},400);
  const existing=await activities();let saved=0,added=0,updated=0;
  try{for(const item of incoming){const previous=existing.find(a=>keyFor(a)===keyFor(item));const a={...previous,...item,id:previous?.id||randomUUID()};await store.setJSON('activity/'+a.id,a);existing.push(a);saved++;previous?updated++:added++}}catch{return res({error:'Import interrupted. Refresh and retry; matching activities will be updated.',saved,added,updated},503)}
  return res({saved,added,updated});
 }
 if(action==='activity'&&method==='POST'){let a;try{a=validateActivity(b)}catch(e){return res({error:e.message},400)}a.id=b.id||randomUUID();if(!/^[a-zA-Z0-9-]{1,80}$/.test(a.id))return res({error:'Invalid activity identifier.'},400);const previous=(await activities()).find(x=>x.id===a.id);a={...previous,...a};await store.setJSON('activity/'+a.id,a);return res({activity:a});}
 if(action==='status'&&method==='POST'){if(!/^[a-zA-Z0-9-]{1,80}$/.test(b.id??'')||!['Open','In progress','Closed'].includes(b.status))return res({error:'Invalid action status.'},400);const review=await store.get('review/'+b.id,{type:'json'});if(!review)return res({error:'Review not found.'},404);review.status=b.status;await store.setJSON('review/'+review.id,review);return res({review});}
 return res({error:'Not found.'},404);
}catch(e){console.error('CCA API error',e.name);return res({error:'Unable to save or load records. Please try again.'},500)}
};}
