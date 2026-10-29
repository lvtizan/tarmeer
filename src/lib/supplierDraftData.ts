/** Restore only the form's known fields and types, including older partial drafts. */
export function normalizeSupplierDraft<T extends object>(raw:unknown,baseline:T):T {
 const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const normalize=(value:unknown,base:unknown,key:string):unknown=>{
  if(Array.isArray(base)){
   if(!Array.isArray(value))return base;
   if(key==='specs')return value.filter(record).filter(row=>typeof row.label==='string'&&typeof row.value==='string').map(row=>({label:row.label,value:row.value}));
   return value.filter(item=>typeof item==='string');
  }
  if(record(base)){
   const source=record(value)?value:{};
   return Object.fromEntries(Object.entries(base).filter(([name])=>!['__proto__','constructor','prototype'].includes(name)).map(([name,next])=>[name,normalize(source[name],next,name)]));
  }
  if(base===null||base===undefined)return value===null||['string','number','boolean'].includes(typeof value)?value:base;
  return typeof value===typeof base?value:base;
 };
 return normalize(raw,baseline,'') as T;
}
