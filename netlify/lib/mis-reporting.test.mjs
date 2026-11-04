import test from 'node:test';
import assert from 'node:assert/strict';
import {qaReportingFeed,createQaMisHandler} from './mis-reporting.mjs';
const scope={academicYear:'2026/27',season:'S1',division:'LS'};
test('separate read-only QA endpoint is disabled without IT approval',async()=>{
 let reads=0;const handler=createQaMisHandler({read:async()=>{reads++;}},{environment:()=>({})});
 assert.equal((await handler(new Request('https://example.invalid/api/mis/v1/qa'))).status,503);
 assert.equal((await handler(new Request('https://example.invalid/api/mis/v1/qa',{method:'POST'}))).status,405);assert.equal(reads,0);
});
test('approved external summaries reuse Planner IDs and exclude private narratives',()=>{
 const data={complete:true,activities:[{id:'DEMO-Q',misReporting:{approved:true,externalSupported:true,division:'LS',providerId:'DEMO-P'},plannerSource:{activityId:'DEMO-A',academicYear:'2026/27',seasonNumber:'1'}}],reviews:[{id:'DEMO-R',activityId:'DEMO-Q',academicYear:'2026/27',seasonNumber:'1',reviewType:'Mid-season',date:'2026-10-05',score:4,checklist:Array(10).fill('yes'),status:'Open',priority:'Routine',reviewer:'PRIVATE',review:'PRIVATE',nextSteps:'PRIVATE',misReporting:{approved:true}}],followUps:[]};
 const feed=qaReportingFeed(data,scope);assert.equal(feed.records[0].plannerActivityId,'DEMO-A');assert.equal(feed.records[0].midSeasonComplete,true);assert.equal(feed.providerAggregates[0].meanScore,null);assert.ok(!JSON.stringify(feed).includes('PRIVATE'));
 data.activities[0].misReporting.externalSupported=false;assert.equal(qaReportingFeed(data,scope).records.length,0);
});
