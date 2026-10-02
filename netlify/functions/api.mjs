import {getStore} from '@netlify/blobs';
import {makeHandler} from '../lib/core.mjs';
import {configurationStatus} from '../lib/config.mjs';
import seed from '../../public/seed.json' with {type:'json'};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export default async(req,context)=>{
  // Configuration can be checked before initialising storage, including on a first deploy.
  const setup=configurationStatus(process.env);
  const action=new URL(req.url).searchParams.get('action');
  if(req.method==='GET'&&action==='health')return json(setup,setup.configured?200:503);
  if(!setup.configured)return json({error:'Staff access has not been configured. Ask the CCA administrator to complete setup.',...setup},503);
  try{
    const store=getStore({name:context.deploy.context==='production'?'cca-qa-production':'cca-qa-nonproduction',consistency:'strong',region:'ap-southeast-1'});
    return await makeHandler({store,env:process.env,seed})(req);
  }catch(error){
    console.error('CCA service initialisation failed',error.name);
    return json({error:'Unable to save or load records. Please try again.'},503);
  }
};
export const config={rateLimit:{action:'rate_limit',windowLimit:60,windowSize:60,aggregateBy:['ip']}};
