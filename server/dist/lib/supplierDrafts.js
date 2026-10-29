'use strict';
const {validDraftShape}=require('./supplierDraftShape');
const {supplierImagePathIsOwned}=require('./supplierImageOwnership');
const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS admin_supplier_drafts (
 admin_id INT NOT NULL, supplier_id INT NOT NULL, scope VARCHAR(64) NOT NULL,
 country VARCHAR(8) NOT NULL, data JSON NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (admin_id, supplier_id, scope), INDEX idx_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
async function ensureSupplierDraftSchema(pool) {
 await pool.execute(SCHEMA_SQL);
 await pool.execute(`CREATE TABLE IF NOT EXISTS admin_supplier_submissions (
 admin_id INT NOT NULL,supplier_id INT NOT NULL,scope VARCHAR(64) NOT NULL,request_id VARCHAR(36) NOT NULL,
 response JSON NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(admin_id,supplier_id,scope,request_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
function validData(value, depth = 0) {
 if(depth>8)return false;
 if(value===null||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value==='string')return value.length<=100000;
 if(Array.isArray(value))return value.length<=1000&&value.every(v=>validData(v,depth+1));
 return value&&typeof value==='object'&&Object.keys(value).length<=100&&Object.entries(value).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&validData(v,depth+1));
}
function createSupplierDraftController(pool, options={}) {
 async function context(req,res) {
  const id=Number(req.params.id),adminId=req.admin?.id,scope=req.params.scope;
  if(!Number.isSafeInteger(id)||id<1||!adminId||!/^(product-new|quick-product-new|project-new|supplier-edit|product-[1-9]\d*|project-[1-9]\d*)$/.test(scope||'')){res.status(400).json({error:'Invalid draft target.'});return null;}
  if(req.query.admin_id!==undefined&&String(req.query.admin_id)!==String(adminId)){res.status(409).json({error:'Administrator session changed. Reload before saving.'});return null;}
  const [rows]=await pool.execute('SELECT id, slug, country FROM supplier_profiles WHERE id = ? LIMIT 1',[id]);
  const supplier=rows[0];
  if(!supplier||(req.admin.role!=='super_admin'&&supplier.country!==req.admin.country)||(req.query.country&&req.query.country!==supplier.country)){res.status(404).json({error:'Supplier not found.'});return null;}
  return {id,adminId,scope,country:supplier.country,supplier};
 }
 async function get(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try {const c=await context(req,res);if(!c)return;const [rows]=await pool.execute('SELECT data, revision, updated_at FROM admin_supplier_drafts WHERE admin_id=? AND supplier_id=? AND scope=? AND country=?',[c.adminId,c.id,c.scope,c.country]);const row=rows[0];res.json(row?{data:typeof row.data==='string'?JSON.parse(row.data):row.data,revision:row.revision,updatedAt:row.updated_at}:{data:null,revision:0});}
  catch(error){console.error('Supplier draft read failed:',error);res.status(500).json({error:'Unable to load saved draft.'});}
 }
 async function put(req,res) {
  try {const c=await context(req,res);if(!c)return;const {data,revision}=req.body||{};
   if(!Number.isSafeInteger(revision)||revision<0||!data||Array.isArray(data)||typeof data!=='object'||!validData(data)||!validDraftShape(c.scope,data)||Buffer.byteLength(JSON.stringify(data))>1024*1024)return res.status(400).json({error:'Invalid or oversized draft.'});
   if(data.imageUrl&&(!['quick-product-new'].includes(c.scope)||typeof data.imageUrl!=='string'||!await supplierImagePathIsOwned(c.supplier,data.imageUrl,'photos',null,options.publicRoot)))return res.status(400).json({error:'Draft image must belong to this supplier.'});
   if(data.images!==undefined){
    let existingImages=[];
    if(/^project-[1-9]\d*$/.test(c.scope)){
     const [projects]=await pool.execute('SELECT images FROM supplier_projects WHERE id=? AND supplier_profile_id=?',[Number(c.scope.slice(8)),c.id]);
     if(!projects[0])return res.status(404).json({error:'Project not found.'});
     try{existingImages=typeof projects[0].images==='string'?JSON.parse(projects[0].images):projects[0].images;}catch{existingImages=[];}
     if(!Array.isArray(existingImages))existingImages=[];
    }
    if(!Array.isArray(data.images)||data.images.length>500)return res.status(400).json({error:'Invalid draft images.'});
    for(const image of data.images)if(typeof image!=='string'||(!existingImages.includes(image)&&!await supplierImagePathIsOwned(c.supplier,image,c.scope.startsWith('project')?'projects':'photos',null,options.publicRoot)))return res.status(400).json({error:'Draft images must belong to this supplier.'});
   }
   const json=JSON.stringify(data);let result;
   if(revision===0){try{[result]=await pool.execute('INSERT INTO admin_supplier_drafts (admin_id,supplier_id,scope,country,data,revision) VALUES (?,?,?,?,?,1)',[c.adminId,c.id,c.scope,c.country,json]);}catch(error){if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'This draft changed in another tab. Reload before saving.'});throw error;}}
   else {[result]=await pool.execute('UPDATE admin_supplier_drafts SET data=?,revision=revision+1 WHERE admin_id=? AND supplier_id=? AND scope=? AND country=? AND revision=?',[json,c.adminId,c.id,c.scope,c.country,revision]);if(!result.affectedRows)return res.status(409).json({error:'This draft changed in another tab. Reload before saving.'});}
   res.json({revision:revision+1});
  }catch(error){console.error('Supplier draft save failed:',error);res.status(500).json({error:'Unable to save draft. Your unsaved input is still on this page.'});}
 }
 return {get,put};
}
module.exports={ensureSupplierDraftSchema,createSupplierDraftController,validData,SCHEMA_SQL};
