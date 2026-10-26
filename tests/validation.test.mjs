import test from 'node:test';
import assert from 'node:assert/strict';
import { isEnergyMap, imageKind } from '../lib/validation.ts';
test('energy maps reject malformed, coerced and out-of-range AI outputs', () => {
 const valid={title:'Sunrise',description:'A gentle build',energy:[0,10,20,30,40,50,60,70,80,100]};
 assert.equal(isEnergyMap(valid),true);
 for(const invalid of [null,{}, {...valid,title:''},{...valid,energy:[1,2]}, {...valid,energy:[...Array(10)].map(()=>101)}, {...valid,energy:Array(10).fill('50')}, {...valid,energy:Array(10).fill(0.5)}]) assert.equal(isEnergyMap(invalid),false);
});
test('image upload uses byte signatures rather than trusting MIME or extensions',()=>{
 assert.equal(imageKind(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(imageKind(Uint8Array.from([255,216,255])),'image/jpeg');
 assert.equal(imageKind(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');
 assert.equal(imageKind(new TextEncoder().encode('<svg onload=alert(1)>')),null);
 assert.equal(imageKind(new Uint8Array()),null);
});
