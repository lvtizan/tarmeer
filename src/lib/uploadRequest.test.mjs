import {test} from 'node:test';
import assert from 'node:assert/strict';
import {xhrPost,uploadRequestTimeout} from './uploadRequest.ts';

function fixture(){
 const original={XMLHttpRequest:globalThis.XMLHttpRequest,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const timers=new Map();let now=0,id=0,xhr;
 globalThis.setTimeout=(fn,delay)=>{timers.set(++id,{fn,time:now+delay});return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.XMLHttpRequest=class {
  upload={};headers={};status=200;responseText='{"url":"/uploads/photo.webp"}';
  constructor(){xhr=this;}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(key,value){this.headers[key]=value;}
  send(body){this.body=body;}
  abort(){this.aborted=true;this.onabort?.();}
 };
 const data=new FormData();data.append('file',new Blob([new Uint8Array(1.5*1024*1024)]),'photo.jpg');
 return{data,timers,get xhr(){return xhr;},tick(ms){now+=ms;for(const[key,timer]of [...timers])if(timer.time<=now){timers.delete(key);timer.fn();}},restore(){Object.assign(globalThis,original);}};
}

test('size-based deadline accommodates 1.5 MiB at 8 KiB/s and is capped',()=>{assert.equal(uploadRequestTimeout(1.5*1024*1024),252000);assert.equal(uploadRequestTimeout(1),120000);assert.equal(uploadRequestTimeout(100*1024*1024),600000);});
test('slow but progressing upload survives old 45 second cutoff',async()=>{const f=fixture();try{const progress=[];const result=xhrPost('/upload',{Authorization:'Bearer test-only'},f.data,p=>progress.push(p));for(let i=1;i<=4;i++){f.tick(50000);assert.notEqual(f.xhr.aborted,true);f.xhr.upload.onprogress({loaded:i*250,total:1000,lengthComputable:true});}f.xhr.onload();assert.equal((await result).url,'/uploads/photo.webp');assert.deepEqual(progress,[25,50,75,100]);assert.equal(f.timers.size,0);assert.equal(f.xhr.headers.Authorization,'Bearer test-only');}finally{f.restore();}});
test('stalled upload aborts and clears timers',async()=>{const f=fixture();try{const result=xhrPost('/upload',{},f.data);const rejected=assert.rejects(result,/没有进展/);f.tick(90000);await rejected;assert.equal(f.xhr.aborted,true);assert.equal(f.timers.size,0);f.xhr.upload.onload();assert.equal(f.timers.size,0);}finally{f.restore();}});
test('repeated identical progress does not keep a stalled request alive',async()=>{const f=fixture();try{const result=xhrPost('/upload',{},f.data);const rejected=assert.rejects(result,/没有进展/);f.xhr.upload.onprogress({loaded:20,lengthComputable:false});f.tick(60000);f.xhr.upload.onprogress({loaded:20,lengthComputable:false});f.tick(30000);await rejected;assert.equal(f.xhr.aborted,true);}finally{f.restore();}});
test('server processing window starts after upload completion',async()=>{const f=fixture();try{const result=xhrPost('/upload',{},f.data);f.tick(80000);f.xhr.upload.onload();f.tick(80000);assert.notEqual(f.xhr.aborted,true);f.xhr.onload();await result;assert.equal(f.timers.size,0);}finally{f.restore();}});
test('4xx HTTP status remains available to suppress automatic retry',async()=>{const f=fixture();try{const result=xhrPost('/upload',{},f.data);f.xhr.status=403;f.xhr.responseText='{"error":"Access denied"}';f.xhr.onload();await assert.rejects(result,e=>e.status===403&&e.message==='Access denied');assert.equal(f.timers.size,0);}finally{f.restore();}});
test('invalid success JSON is explicit and timers cleaned',async()=>{const f=fixture();try{const result=xhrPost('/upload',{},f.data);f.xhr.responseText='<html>Bad proxy</html>';f.xhr.onload();await assert.rejects(result,/格式异常/);assert.equal(f.timers.size,0);}finally{f.restore();}});
for(const [event,message]of [['ontimeout',/超过上限/],['onerror',/网络连接失败/],['onabort',/已中断/]])test(`${event} cleans timer and rejects`,async()=>{const f=fixture();try{const result=xhrPost('/upload',{},f.data);f.xhr[event]();await assert.rejects(result,message);assert.equal(f.timers.size,0);}finally{f.restore();}});
