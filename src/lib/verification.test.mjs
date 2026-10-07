import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleField, validateVerification, copyVerificationFields, safeEvidenceUrl, parseVerificationData } from './verification.ts';
const field = { key:'n', label:'Count',type:'number',min:0, step:1,visibleWhen:{field:'works',values:['Selected']} };
test('worker counts appear only for selected works',()=>{assert.equal(visibleField(field,{works:[]}),false);assert.equal(visibleField(field,{works:['Selected']}),true);});
test('hidden required fields do not block submission',()=>{const schema={sections:[{key:'s',title:'S',fields:[{...field,required:true}]}]};assert.deepEqual(validateVerification(schema,{works:[]}),{});assert.ok(validateVerification(schema,{works:['Selected']}).n);});
test('counts reject negatives and fractions but preserve unknown blanks',()=>{const schema={sections:[{key:'s',title:'S',fields:[field]}]};assert.ok(validateVerification(schema,{works:['Selected'],n:'-1'}).n);assert.ok(validateVerification(schema,{works:['Selected'],n:'2.5'}).n);assert.deepEqual(validateVerification(schema,{works:['Selected'],n:''}),{});});
test('copy contact mappings preserve unrelated answers and permit blanks',()=>{assert.deepEqual(copyVerificationFields({a:'Contact',b:'Old',c:'Other'},{b:'a',d:'missing'}),{a:'Contact',b:'Contact',c:'Other',d:''});});
test('safe evidence links reject active and protocol-relative URLs',()=>{assert.equal(safeEvidenceUrl('javascript:alert(1)'),undefined);assert.equal(safeEvidenceUrl('//evil.com'),undefined);assert.equal(safeEvidenceUrl('/uploads/a.pdf'),'/uploads/a.pdf');assert.equal(safeEvidenceUrl('https://www.tarmeer.com/uploads/a.pdf'),'https://www.tarmeer.com/uploads/a.pdf');});
test('malformed saved data is rejected rather than silently discarded',()=>{assert.throws(()=>parseVerificationData('{bad'));assert.deepEqual(parseVerificationData('{"x":"ok"}'),{x:'ok'});});
test('facility evidence stays hidden for no facilities and reveals actual selected facility',()=>{const f={...field,visibleWhen:{field:'f',excludeValues:['None']}};assert.equal(visibleField(f,{}),false);assert.equal(visibleField(f,{f:['None']}),false);assert.equal(visibleField(f,{f:['Joinery']}),true);});
test('custom work counts follow non-empty trimmed descriptions',()=>{const f={...field,visibleWhen:{field:'custom',notEmpty:true}};assert.equal(visibleField(f,{custom:'  '}),false);assert.equal(visibleField(f,{custom:'Water feature'}),true);});
test('numeric saved answers retain visible values and invalid shapes fail explicitly',()=>{assert.deepEqual(parseVerificationData({n:0,a:[{x:3}]}),{n:'0',a:[{x:'3'}]});assert.throws(()=>parseVerificationData({n:{unexpected:true}}));});

test('confirmed stale draft 404 removes only matching references and resumes new-draft flow once',async()=>{
  const { restoreStoredVerificationDraft }=await import('./verification.ts');
  const entries=new Map([['field_draft_id_ae','41'],['field_draft_id','41'],['field_draft_id_vn','99']]);
  const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};
  const cleared=[];let requests=0;let creates=0;
  const draft=await restoreStoredVerificationDraft(storage,'ae',async id=>{requests++;assert.equal(id,41);throw Object.assign(new Error('Not found'),{status:404});},id=>cleared.push(id));
  if(!draft){creates++;entries.set('field_draft_id_ae','42');}
  assert.equal(requests,1);assert.equal(creates,1);assert.deepEqual(cleared,[41]);assert.equal(entries.get('field_draft_id'),undefined);assert.equal(entries.get('field_draft_id_vn'),'99');assert.equal(entries.get('field_draft_id_ae'),'42');
});
test('403 and network failures preserve stored draft and its credential',async()=>{
  const { restoreStoredVerificationDraft }=await import('./verification.ts');
  for(const error of [Object.assign(new Error('Forbidden'),{status:403}),new Error('Network failure')]){
    const entries=new Map([['field_draft_id_ae','41'],['field_draft_id','41']]);const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};let cleared=0;
    await assert.rejects(()=>restoreStoredVerificationDraft(storage,'ae',async()=>{throw error;},()=>cleared++),e=>e===error);
    assert.equal(entries.get('field_draft_id_ae'),'41');assert.equal(entries.get('field_draft_id'),'41');assert.equal(cleared,0);
  }
});
test('stale resolution does not erase a newer draft chosen during request',async()=>{
  const { restoreStoredVerificationDraft }=await import('./verification.ts');
  const entries=new Map([['field_draft_id_ae','41'],['field_draft_id','41']]);const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};
  await restoreStoredVerificationDraft(storage,'ae',async()=>{entries.set('field_draft_id_ae','42');entries.set('field_draft_id','42');throw {status:404};},()=>{});
  assert.equal(entries.get('field_draft_id_ae'),'42');assert.equal(entries.get('field_draft_id'),'42');
});

test('initial 401 clears only selected field token, preserves admin token and draft capability',async()=>{
  const { captureVerificationAuth, recoverVerificationAuthentication }=await import('./verification.ts');
  const entries=new Map([['field_token','expired-field'],['admin_token','admin-session'],['field_draft_id','41'],['field_draft_access_41','capability'],['field_user','country-data']]);
  const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};
  const auth=captureVerificationAuth(storage);assert.deepEqual(auth,{key:'field_token',token:'expired-field'});
  const url=recoverVerificationAuthentication({status:401},storage,auth,null);assert.equal(url,'/field/login?return=%2Ffield%2Fsurvey');
  assert.equal(entries.get('field_token'),undefined);assert.equal(entries.get('admin_token'),'admin-session');assert.equal(entries.get('field_draft_id'),'41');assert.equal(entries.get('field_draft_access_41'),'capability');assert.equal(entries.get('field_user'),'country-data');
});
test('admin-only 401 recovery clears admin token and preserves edit return path',async()=>{
  const { captureVerificationAuth, recoverVerificationAuthentication }=await import('./verification.ts');
  const entries=new Map([['admin_token','expired-admin'],['field_draft_id','41']]);const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};
  assert.equal(recoverVerificationAuthentication({status:401},storage,captureVerificationAuth(storage),17),'/field/login?return=%2Ffield%2Fsurvey%3Fedit%3D17');assert.equal(entries.get('admin_token'),undefined);assert.equal(entries.get('field_draft_id'),'41');
});
test('403,404 and network errors do not clear authentication or trigger sign-in',async()=>{
  const { captureVerificationAuth, recoverVerificationAuthentication }=await import('./verification.ts');
  for(const error of [{status:403},{status:404},new Error('Network')]){const entries=new Map([['field_token','session']]);const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};assert.equal(recoverVerificationAuthentication(error,storage,captureVerificationAuth(storage),null),null);assert.equal(entries.get('field_token'),'session');}
});
test('late 401 cannot clear a refreshed authentication token',async()=>{
  const { captureVerificationAuth, recoverVerificationAuthentication }=await import('./verification.ts');
  const entries=new Map([['field_token','expired']]);const storage={getItem:key=>entries.get(key)??null,removeItem:key=>entries.delete(key)};const captured=captureVerificationAuth(storage);entries.set('field_token','refreshed');recoverVerificationAuthentication({status:401},storage,captured,null);assert.equal(entries.get('field_token'),'refreshed');
});
