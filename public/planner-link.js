// A route hint only. Existing QA authentication and stored activity records remain authoritative.
export function parsePlannerReview(hash){
 const p=new URLSearchParams(String(hash||'').replace(/^#/,'')),id=p.get('planner-review');
 return /^planner-[a-f0-9]{32}$/.test(id||'')?{activityId:id,role:p.get('role')==='lead'?'lead':p.get('role')==='support'?'support':''}:null;
}
export function resolvePlannerReview(activities,request){
 if(!request)return null;
 const activity=activities.find(a=>a.id===request.activityId&&a.active&&a.plannerSource);
 return activity?{activity,role:request.role}:null;
}
