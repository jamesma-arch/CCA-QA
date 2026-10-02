import {getStore} from '@netlify/blobs';
import {makeHandler} from '../lib/core.mjs';
// Bundled as an imported JSON asset, shared across production deployments.
import seed from '../../public/seed.json' with {type:'json'};
export default async(req,context)=>makeHandler({store:getStore({name:context.deploy.context==='production'?'cca-qa-production':'cca-qa-nonproduction',consistency:'strong',region:'ap-southeast-1'}),env:process.env,seed})(req);
export const config={rateLimit:{action:'rate_limit',windowLimit:60,windowSize:60,aggregateBy:['ip']}};
