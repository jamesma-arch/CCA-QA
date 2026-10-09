import {getStore} from '@netlify/blobs';
import seed from '../../public/seed.json' with {type:'json'};

const staffNameKey=v=>String(v??'').toLowerCase().replace(/\b(mr|mrs|ms|miss|dr)\b\.?/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const compactNameKey=v=>staffNameKey(v).replace(/\s+/g,'');
const staffNames=s=>[
  s.preferredName&&s.surname?`${s.preferredName} ${s.surname}`:'',
  s.forename&&s.surname?`${s.forename} ${s.surname}`:'',
  [s.forename,s.middle&&s.middle!=='-'?s.middle:'',s.surname].filter(Boolean).join(' '),
  s.preferredName&&s.forename&&s.surname?`${s.preferredName} ${s.forename} ${s.surname}`:'',
  s.preferredName&&s.forename&&s.middle&&s.middle!=='-'&&s.surname?`${s.preferredName} ${s.forename} ${s.middle} ${s.surname}`:''
].filter(Boolean);
const editDistance=(a,b)=>{a=String(a);b=String(b);if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]};
const nameSimilarity=(a,b)=>{const x=compactNameKey(a),y=compactNameKey(b);if(!x||!y)return 0;if(x===y)return 1;const dist=editDistance(x,y),edit=1-dist/Math.max(x.length,y.length),xt=staffNameKey(a).split(' ').filter(Boolean),yt=staffNameKey(b).split(' ').filter(Boolean),common=xt.filter(t=>yt.includes(t)).length,token=(2*common)/(xt.length+yt.length||1);return Math.max(edit,token)};
const firstNames=s=>[s.preferredName,String(s.forename||'').split(/\s+/)[0]].filter(Boolean).map(staffNameKey);
function directoryMatch(lead,directory){
  const key=staffNameKey(lead),compact=compactNameKey(lead);if(!key)return null;
  const exact=directory.filter(s=>staffNames(s).some(name=>staffNameKey(name)===key||compactNameKey(name)===compact));
  if(exact.length===1)return exact[0];
  const candidates=directory.map(staff=>({staff,score:Math.max(...staffNames(staff).map(name=>nameSimilarity(lead,name)))})).filter(x=>x.score>=0.9).sort((a,b)=>b.score-a.score);
  if(candidates.length&&(!candidates[1]||candidates[0].score-candidates[1].score>=0.06))return candidates[0].staff;
  const tokens=key.split(' ').filter(Boolean),leadFirst=tokens[0]||'',leadLast=tokens.at(-1)||'',sameFirst=directory.filter(s=>firstNames(s).includes(leadFirst));
  if(sameFirst.length===1&&leadLast){const staff=sameFirst[0],staffLast=staffNameKey(staff.surname),distance=editDistance(leadLast,staffLast);if(staffLast&&leadLast[0]===staffLast[0]&&Math.abs(leadLast.length-staffLast.length)<=2&&distance<=2)return staff}
  return null;
}
const operationalCorrection=a=>{
 if(String(a?.title||'').trim().toLowerCase()!=='chess coaching')return a;
 const day=String(a.day||'').toLowerCase(),years=String(a.years||'').toLowerCase().replace(/\s+/g,'');
 if(day==='monday'||(/y3/.test(years)&&/y4/.test(years)&&/y5/.test(years)))return {...a,lead:'Soh Ngamprom',leadEmail:''};
 if(day==='wednesday'||(/y2/.test(years)&&/y3/.test(years)&&!/y4/.test(years)))return {...a,lead:'Juvelyn Escabusa',leadEmail:''};
 return a;
};
const todayBangkok=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const all=async(store,prefix)=>{const result=await store.list({prefix});return (await Promise.all(result.blobs.map(x=>store.get(x.key,{type:'json'})))).filter(Boolean)};
async function graphToken(){
  const body=new URLSearchParams({client_id:process.env.MS_CLIENT_ID,client_secret:process.env.MS_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'});
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.MS_TENANT_ID)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw Error(`Microsoft Graph token request failed (${response.status})`);
  return (await response.json()).access_token;
}
async function sendMail(token,{to,subject,body}){
  const sender=process.env.MAIL_SENDER;
  const response=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject,body:{contentType:'Text',content:body},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:true})});
  if(!response.ok){const detail=await response.text();throw Error(`Microsoft Graph sendMail failed (${response.status}): ${detail.slice(0,250)}`)}
}
export default async()=>{
  const required=['MS_TENANT_ID','MS_CLIENT_ID','MS_CLIENT_SECRET','MAIL_SENDER','STAFF_ACCESS_CODE'];
  if(String(process.env.AUTO_REMINDER_ENABLED).toLowerCase()!=='true'){console.log('CCA automatic reminders are disabled.');return}
  const missing=required.filter(k=>!process.env[k]);if(missing.length){console.log('CCA automatic reminders missing configuration:',missing.join(', '));return}
  const store=getStore({name:'cca-qa-production',consistency:'strong',region:'ap-southeast-1'}),today=todayBangkok();
  const [storedActivities,reviews,reminders]=await Promise.all([all(store,'activity/'),all(store,'review/'),all(store,'reminder-status/')]);
  const activities=[...seed.filter(a=>!storedActivities.some(e=>e.id===a.id)),...storedActivities].map(operationalCorrection),directory=await store.get('staff-directory/current',{type:'json'})||[],sent=new Map(reminders.map(r=>[r.activityId,r]));
  const due=activities.filter(a=>a.active&&/^\d{4}-\d{2}-\d{2}$/.test(a.reviewStage||'')&&a.reviewStage<=today&&!sent.get(a.id)?.sent&&!reviews.some(r=>r.activityId===a.id&&r.date>=a.reviewStage));
  if(!due.length){console.log('CCA automatic reminders: no reminders due.');return}
  const token=await graphToken(),siteUrl=(process.env.QA_SITE_URL||process.env.URL||'https://cca-qa.netlify.app/').replace(/\/+$/,'')+'/',results=[];
  for(const activity of due){
    const staff=directoryMatch(activity.lead,directory),email=String(activity.leadEmail||staff?.email||'').trim();
    if(!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)){results.push({activity:activity.title,status:'skipped-no-email'});continue}
    const preferred=String(staff?.preferredName||'').trim(),fallback=String(activity.lead||'').trim().split(/\s+/)[0]||'colleague',name=preferred||fallback,subject=`CCA QA observation reminder – ${activity.title}`,body=`Dear Khun ${name},\n\nA quick reminder that the QA observation form for ${activity.title} (${activity.years}) is still showing as incomplete for the current review period.\n\nPlease could you complete the QA form when you have a chance.\n\nCCA QA form: ${siteUrl}\n\nPlease choose Staff login when you open the link.\nPassword is: ${process.env.STAFF_ACCESS_CODE}\n\nMany thanks,\nCCA Team`;
    try{
      await sendMail(token,{to:email,subject,body});
      const now=new Date().toISOString(),record={activityId:activity.id,sent:true,sentAt:now,source:'automatic',triggerDate:activity.reviewStage,updatedAt:now};
      await store.setJSON('reminder-status/'+activity.id,record);results.push({activity:activity.title,status:'sent'});
    }catch(error){console.error('CCA automatic reminder failed for',activity.id,error.message);results.push({activity:activity.title,status:'failed'})}
  }
  console.log('CCA automatic reminder run',JSON.stringify({date:today,due:due.length,results}));
};
