import {createHash,timingSafeEqual} from 'node:crypto';
const checklistIds=['register','instructions','resources','staff-role','relationships','engagement','safety','behaviour','differentiation','dismissal'];
const text=v=>typeof v==='string'&&v.length<=300?v.trim():null;
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function qaReportingFeed(data,scope,{now=Date.now()}={}){
 const records=[],omitted=[];
 for(const a of data.activities){
  const m=a.misReporting,p=a.plannerSource;
  // Explicit reporting approval AND confirmed external-support eligibility; no title matching.
  if(m?.approved!==true||m.externalSupported!==true||a.active===false||!p?.activityId||p.academicYear!==scope.academicYear||String(p.seasonNumber)!==scope.season.slice(1)||m.division!==scope.division)continue;
  const reviews=data.reviews.filter(r=>r.activityId===a.id&&r.academicYear===scope.academicYear&&String(r.seasonNumber)===scope.season.slice(1)&&r.misReporting?.approved===true);
  const observations=[];
  for(const r of reviews){
   if(!['Mid-season','End-of-season'].includes(r.reviewType)||!validDate(r.date)||!Number.isInteger(r.score)||r.score<1||r.score>5||!Array.isArray(r.checklist)||r.checklist.length!==checklistIds.length||r.checklist.some(v=>!['yes','no','na'].includes(v))||!['Routine','Follow-up','Urgent'].includes(r.priority)||!['Open','In progress','Closed'].includes(r.status)){omitted.push({code:'invalid-approved-review'});continue;}
   const followUps=(data.followUps||[]).filter(f=>f.reviewId===r.id&&f.misReporting?.approved===true&&validDate(f.date)&&['In progress','Closed'].includes(f.status)).sort((a,b)=>a.date.localeCompare(b.date));
   const status=followUps.at(-1)?.status||r.status;
   const actions=r.misReporting?.actionsApproved===true&&Array.isArray(r.misReporting.actions)?r.misReporting.actions.filter(x=>text(x.id)&&checklistIds.includes(x.category)&&['Open','In progress'].includes(x.status)&&(!x.dueDate||validDate(x.dueDate))).map(x=>({id:text(x.id),category:x.category,status:x.status,dueDate:x.dueDate||null})):[];
   observations.push({reviewId:r.id,stage:r.reviewType,date:r.date,score:r.score,checklist:Object.fromEntries(checklistIds.map((id,i)=>[id,r.checklist[i]])),priority:r.priority,followUpStatus:status,actions});
  }
  records.push({qaActivityId:a.id,plannerActivityId:p.activityId,academicYear:scope.academicYear,season:scope.season,division:scope.division,providerId:text(m.providerId),externalSupported:true,approvalStatus:'approved',
   midSeasonComplete:observations.some(r=>r.stage==='Mid-season'),endSeasonComplete:observations.some(r=>r.stage==='End-of-season'),observations});
 }
 const providerAggregates=[...new Set(records.map(r=>r.providerId).filter(Boolean))].map(providerId=>{const observations=records.filter(r=>r.providerId===providerId).flatMap(r=>r.observations);return {providerId,reviewCount:observations.length,meanScore:observations.length>=3?observations.reduce((n,r)=>n+r.score,0)/observations.length:null,suppressed:observations.length<3};});
 return {schemaVersion:1,source:'qa',scope,revision:data.revision||0,generatedAt:new Date(now).toISOString(),complete:data.complete===true&&omitted.length===0,records,providerAggregates,issues:omitted};
}
export function createQaMisHandler(repository,{environment=()=>process.env,now=()=>Date.now()}={}){
 return async request=>{
  const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}),env=environment();
  if(request.method!=='GET')return reply(405,{error:'Read-only endpoint'});
  if(env.QA_MIS_REPORTING_ENABLED!=='true'||env.QA_MIS_IT_APPROVED!=='true')return reply(503,{error:'MIS reporting connection disabled'});
  const key=env.QA_MIS_REPORTING_TOKEN;
  if(typeof key!=='string'||key.length<32||[env.STAFF_ACCESS_CODE,env.ADMIN_ACCESS_CODE,env.SESSION_SECRET,env.PLANNER_QA_SHARED_SECRET].filter(Boolean).includes(key))return reply(503,{error:'Dedicated MIS service credential required'});
  const supplied=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!supplied||!timingSafeEqual(createHash('sha256').update(key).digest(),createHash('sha256').update(supplied).digest()))return reply(401,{error:'Service authentication required'});
  const url=new URL(request.url),scope={academicYear:url.searchParams.get('academicYear'),season:url.searchParams.get('season'),division:url.searchParams.get('division')};
  if(!/^\d{4}\/\d{2}$/.test(scope.academicYear||'')||!/^S[123]$/.test(scope.season||'')||!['LS','US'].includes(scope.division)||(env.QA_MIS_DIVISIONS||'').split(',').indexOf(scope.division)<0)return reply(400,{error:'Explicit authorised reporting scope required'});
  try{return reply(200,qaReportingFeed(await repository.read(scope),scope,{now:now()}));}catch{return reply(503,{error:'Reporting feed unavailable; no source data changed'});}
 };
}
