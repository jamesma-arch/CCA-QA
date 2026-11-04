import {createQaMisHandler} from '../lib/mis-reporting.mjs';
// Reporting reads stored records only; no seed, staff-directory, login or write API.
const repository={async read(){
 const {getStore}=await import('@netlify/blobs');
 if(!process.env.QA_MIS_STORE_NAME)throw Error('An explicit reporting store is required');
 const store=getStore({name:process.env.QA_MIS_STORE_NAME,consistency:'strong',region:'ap-southeast-1'});
 // list() automatically traverses pages. Bound each collection before fetching JSON records.
 const all=async prefix=>{const listed=await store.list({prefix});if(listed.blobs.length>10000)throw Error('Reporting collection limit exceeded');return (await Promise.all(listed.blobs.map(b=>store.get(b.key,{type:'json'})))).filter(Boolean);};
 return {activities:await all('activity/'),reviews:await all('review/'),followUps:await all('followup/'),complete:process.env.QA_MIS_COMPLETE_SNAPSHOT==='true',revision:0};
}};
export default createQaMisHandler(repository);
export const config={path:'/api/mis/v1/qa',rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip']}};
