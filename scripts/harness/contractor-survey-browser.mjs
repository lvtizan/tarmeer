// Run against the release dev server. HTTP fixture isolates UI actions from live data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fullSchema=JSON.parse(readFileSync(new URL('../../server/dist/lib/verificationV7Schema.json',import.meta.url)));
const template=JSON.parse(readFileSync(new URL('../migrations/contractor-survey-template.json',import.meta.url)));
const allFields=template.sections.flatMap(section=>section.fields);
const companyField=structuredClone(allFields.find(field=>field.role==='company_name'));
const choiceField=structuredClone(allFields.find(field=>field.type==='checkbox'&&field.options?.length));
const photoField=structuredClone(allFields.find(field=>field.type==='attachment'));
for(const field of [companyField,choiceField,photoField]){delete field.group;delete field.visibleWhen;}
const option=typeof choiceField.options[0]==='string'?choiceField.options[0]:choiceField.options[0].label;
const photoLabel=photoField.labelEn||photoField.label;
const photoSelector=`[data-field-key=${JSON.stringify(photoField.key)}]`;
// A small derived fixture exercises the skin; production schema is never changed.
const schema={...template,sections:[{...template.sections[0],fields:[companyField,{key:'custom_test',label:'Additional company detail',type:'text',custom:true},structuredClone(allFields.find(field=>field.layout==='inline')),photoField]},{...template.sections[1],fields:[choiceField]}]};
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
let count=0;const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{count++;console.log('PASS '+name);});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 let answers={},attachments=[],submitted=false,failSave=false,created=0,currentId=778899;const calls=[];
 const record=()=>({id:currentId,country:'ae',status:'draft',schema_version:schema.version,schema_snapshot:schema,verification_data:answers,attachments});
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const send=(data,status=200)=>route.fulfill({status,json:data});
  if(path==='/api/field/survey-schema')return send({schema});
  if(path==='/api/field/interviews'&&request.method()==='POST'){created++;currentId++;answers={};attachments=[];return send({...record(),draft_token:'a'.repeat(64)},201);}
  if(path==='/api/field/interviews/draft')return send({draft:record()});
  if(path===`/api/field/interviews/${currentId}`&&request.method()==='PATCH'){
   const body=request.postDataJSON();calls.push(body);if(failSave)return send({error:'Temporary save failure'},500);
   answers={...answers,...body.verification_data};return send({success:true});
  }
  if(path.endsWith('/attachments')){const file={url:'/uploads/contractor-test.png',name:'project.png',type:'image/png',field_key:photoField.key};attachments.push(file);return send(file);}
  if(path.endsWith('/submit')){submitted=true;return send({success:true});}
  return send({canEdit:false});
 });
 await page.route('**/uploads/contractor-test.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrN8AAAAASUVORK5CYII=','base64')}));
 await page.goto((process.env.HARNESS_FRONTEND||'http://localhost:5182')+'/field/survey#survey-section-0');
 await page.getByRole('heading',{name:schema.title,exact:true}).waitFor();
 await check('both template sections render together, without local preview messaging',async()=>{assert.equal(await page.locator('.contractor-sheet:visible').count(),2);assert(!await page.getByText('LOCAL PREVIEW',{exact:true}).count());});
 await check('new custom text inputs retain the same half-row width as original inputs',async()=>{const a=await page.locator(`[data-field-key=${JSON.stringify(companyField.key)}] input`).boundingBox(),b=await page.getByLabel('Additional company detail',{exact:true}).boundingBox();assert(Math.abs(a.width-b.width)<2);assert.equal(Math.round(a.y),Math.round(b.y));});
 await page.locator(`[data-field-key=${JSON.stringify(companyField.key)}] input`).fill('Browser test contractor');
 await page.getByLabel('Additional company detail',{exact:true}).fill('Retain me');
 await page.getByLabel('Partner 1',{exact:true}).fill('+971501234567');
 await check('three inline partner controls use the existing repeat answer structure',async()=>{assert.equal(await page.locator('[data-field-key=partners] input').count(),3);});
 await page.getByLabel('Additional company detail',{exact:true}).press('Enter');
 await check('Enter in a text input keeps the survey in editing with its answers intact',async()=>{assert.equal(await page.locator('.verification-current:visible').count(),1);assert.equal(await page.getByLabel('Additional company detail',{exact:true}).inputValue(),'Retain me');});
 await page.getByRole('button',{name:option,exact:true}).click();
 await check('input and checkbox changes save as field patches',async()=>{await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent==='Saved to server');assert.equal(answers[companyField.key],'Browser test contractor');assert.deepEqual(answers[choiceField.key],[option]);});
 await page.getByRole('button',{name:`Choose files for ${photoLabel}`,exact:true}).click({trial:true});
 await page.locator(`${photoSelector} input[type=file]`).setInputFiles({name:'project.png',mimeType:'image/png',buffer:Buffer.from('sample')});
 await check('project upload is stored and renders a thumbnail',async()=>{await page.locator(`${photoSelector} img`).waitFor();assert.equal(attachments.length,1);});
 await page.getByRole('button',{name:'Review information ↗',exact:true}).click();
 await check('review renders entered answers and attachment names',async()=>{assert.equal(await page.locator('.verification-current:visible').count(),0);assert(await page.locator('.verification-review').innerText().then(t=>t.includes('Browser test contractor')&&t.includes('project.png')));});
 await page.getByRole('link',{name:`1 ${schema.sections[0].titleEn||schema.sections[0].title}`}).click();
 await check('section navigation returns from review and preserves answers and uploads',async()=>{await page.locator('.verification-current').waitFor({state:'visible'});assert.equal(await page.locator(`[data-field-key=${JSON.stringify(companyField.key)}] input`).inputValue(),'Browser test contractor');assert.equal(await page.locator(`${photoSelector} img`).count(),1);});
 await page.reload();await page.getByRole('heading',{name:schema.title,exact:true}).waitFor();
 await check('reload restores saved draft answers and evidence',async()=>{assert.equal(await page.getByLabel('Additional company detail',{exact:true}).inputValue(),'Retain me');assert.equal(await page.locator(`${photoSelector} img`).count(),1);});
 failSave=true;await page.getByLabel('Additional company detail',{exact:true}).fill('Retry value');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();
 await check('failed saves keep answers and show an explicit retry action',async()=>{await page.getByRole('button',{name:'Retry save',exact:true}).waitFor();assert.equal(await page.getByLabel('Additional company detail',{exact:true}).inputValue(),'Retry value');});
 failSave=false;await page.getByRole('button',{name:'Retry save',exact:true}).click();
 await check('retry persists the retained answers',async()=>{await page.waitForFunction(()=>document.querySelector('[role=status]')?.textContent==='Saved to server');assert.equal(answers.custom_test,'Retry value');});
 await page.setViewportSize({width:390,height:844});
 await check('390px mobile layout fits with single-column inputs and reachable footer',async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const a=await page.locator(`[data-field-key=${JSON.stringify(companyField.key)}] input`).boundingBox(),b=await page.getByLabel('Additional company detail',{exact:true}).boundingBox();assert(b.y>a.y);await page.getByRole('button',{name:'Review information ↗',exact:true}).click();});
 await page.screenshot({path:'/tmp/contractor-survey-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Submit verification',exact:true}).click();
 await check('review submission reaches success state through the formal submit endpoint',async()=>{await page.getByRole('heading',{name:'Interview Submitted'}).waitFor();assert(submitted);});
 await page.evaluate(()=>localStorage.clear());
 Object.assign(schema,structuredClone(fullSchema));answers={};attachments=[];
 await page.goto((process.env.HARNESS_FRONTEND||'http://localhost:5182')+'/field/survey');
 await page.getByRole('heading',{name:schema.title,exact:true}).waitFor();
 await check('the existing full schema keeps every nonempty section and its questions',async()=>{assert.equal(await page.locator('.contractor-sheet:visible').count(),schema.sections.filter(section=>section.fields.some(field=>!field.retired)).length);for(const section of schema.sections.filter(section=>section.fields.length))assert(await page.getByRole('heading',{name:section.titleEn||section.title,exact:true}).count());});
 failSave=true;await page.locator(`[data-field-key=${JSON.stringify(fullSchema.sections.flatMap(section=>section.fields).find(field=>field.role==='company_name').key)}] input`).fill('Unsaved draft retained');
 let leaveDialogs=0;page.on('dialog',async dialog=>{leaveDialogs++;await dialog.accept();});
 const previousCreated=created;await page.getByRole('link',{name:'New form',exact:true}).click();
 await check('New form creates a fresh template-backed draft instead of restoring the old draft',async()=>{await page.getByRole('heading',{name:schema.title,exact:true}).waitFor();assert.equal(created,previousCreated+1);assert(!new URL(page.url()).searchParams.has('new'));assert.equal(leaveDialogs,1);assert.equal(await page.locator(`[data-field-key=${JSON.stringify(fullSchema.sections.flatMap(section=>section.fields).find(field=>field.role==='company_name').key)}] input`).inputValue(),'');});
 Object.assign(schema,structuredClone(template));
 await page.goto((process.env.HARNESS_FRONTEND||'http://localhost:5182')+'/field/survey?new=1');await page.getByRole('heading',{name:template.title,exact:true}).waitFor();
 await check('the actual release template renders both preview sections and every configured question',async()=>{assert.equal(await page.locator('.contractor-sheet:visible').count(),2);for(const field of template.sections.flatMap(section=>section.fields))assert(await page.locator(`[data-field-key=${JSON.stringify(field.key)}]`).count());});
 assert.equal(await page.locator('.contractor-survey [role=alert]').count(),0);await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/contractor-survey-desktop.png',fullPage:true});
 await context.close();
 console.log(`${count}/${count} PASS — contractor survey browser`);
}finally{await browser.close();}
