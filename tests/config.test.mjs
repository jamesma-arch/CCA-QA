import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configurationStatus} from '../netlify/lib/config.mjs';
test('configuration identifies exact missing keys without exposing secrets',()=>{
 const result=configurationStatus({STAFF_ACCESS_CODE:'private-staff-value'});
 assert.deepEqual(result.missing,['ADMIN_ACCESS_CODE','SESSION_SECRET']);
 assert.equal(result.configured,false);
 assert.ok(!JSON.stringify(result).includes('private-staff-value'));
});
test('valid separate codes and long session secret pass configuration',()=>{
 assert.equal(configurationStatus({STAFF_ACCESS_CODE:'staff-value',ADMIN_ACCESS_CODE:'admin-value',SESSION_SECRET:'x'.repeat(48)}).configured,true);
});
test('matching access codes and short session secrets fail configuration',()=>{
 const result=configurationStatus({STAFF_ACCESS_CODE:'same',ADMIN_ACCESS_CODE:'same',SESSION_SECRET:'short'});
 assert.equal(result.configured,false);assert.equal(result.issues.length,2);
});
