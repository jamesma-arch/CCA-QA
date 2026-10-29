import test from 'node:test';
import assert from 'node:assert/strict';
import {clampGuidePosition} from '../public/harrow-tutorial.js';
test('dragged guides stay inside desktop and phone viewports, including after a resize',()=>{
 assert.deepEqual(clampGuidePosition({x:-900,y:2000},{width:358,height:440},{width:1280,height:800}),{x:12,y:348});
 assert.deepEqual(clampGuidePosition({x:900,y:900},{width:358,height:400},{width:390,height:844}),{x:20,y:432});
 assert.deepEqual(clampGuidePosition({x:1100,y:600},{width:358,height:400},{width:500,height:600}),{x:130,y:188});
});
test('visual viewport offsets and oversized panels keep the drag handle reachable',()=>{
 assert.deepEqual(clampGuidePosition({x:-1,y:-1},{width:350,height:400},{left:100,top:200,width:390,height:500}),{x:112,y:212});
 assert.deepEqual(clampGuidePosition({x:1000,y:1000},{width:600,height:1000},{width:320,height:480}),{x:12,y:12});
});
