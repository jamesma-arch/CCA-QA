import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const text=(v,max=300)=>typeof v==='string'&&v.length<=max?v.trim():null;
export async function receivePlannerActivity(raw,signature,{store,env,now=Date.now()}){
 if(env.PLANNER_QA_ENABLED!=='true'||typeof env.PLANNER_QA_SHARED_SECRET!=='string'||env.PLANNER_QA_SHARED_SECRET.length<32)return reply(503,{error:'Planner QA connection is not configured.'});
 const expected=createHmac('sha256',env.PLANNER_QA_SHARED_SECRET).update(raw).digest('base64url');
 if(typeof signature!=='string'||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return reply(401,{error:'Invalid Planner signature.'});
 let p;try{p=JSON.parse(raw)}catch{return reply(400,{error:'Invalid Planner data.'})}
 const a=p?.activity;
 if(p?.version!==1||p.source!=='harrow-season-planner'||!Number.isSafeInteger(p.sentAt)||Math.abs(now-p.sentAt)>300000||!Number.isSafeInteger(p.revision)||p.revision<0||!/^\d{4}-\d{2}-s[123]$/.test(p.cycle||'')||!/^\d{4}\/\d{2}$/.test(p.academicYear||'')||Number(p.academicYear.slice(5))!==(Number(p.academicYear.slice(0,4))+1)%100||!['1','2','3'].includes(p.seasonNumber)||p.cycle!==p.academicYear.replace('/','-')+'-s'+p.seasonNumber||!a||!text(a.id,100)||!text(a.title)||!text(a.provider)||!text(a.years)||a.school!=='Lower School'||!['Monday','Tuesday','Wednesday','Thursday','Friday'].includes(a.day))return reply(400,{error:'Invalid or expired Planner data.'});
 const fields={};for(const k of ['title','years','school','day','time','room','backup','provider','lead','season']){fields[k]=text(a[k]??'');if(fields[k]===null)return reply(400,{error:'Invalid activity field.'})}
 const id='planner-'+createHash('sha256').update(p.cycle+'\n'+a.id).digest('hex').slice(0,32),key='activity/'+id,previous=await store.get(key,{type:'json'});
 if(previous&&(!previous.plannerSource||previous.active===false))return reply(409,{error:'Ask the QA administrator to check this activity before reopening it.'});
 if(previous?.plannerSource?.revision>p.revision)return reply(409,{error:'Planner record has changed. Refresh and try again.'});
 const activity={...previous,...fields,id,active:true,plannerSource:{activityId:a.id,cycle:p.cycle,academicYear:p.academicYear,seasonNumber:p.seasonNumber,revision:p.revision}};
 await store.setJSON(key,activity);return reply(200,{activityId:id});
}
