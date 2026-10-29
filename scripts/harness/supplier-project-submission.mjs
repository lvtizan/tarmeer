import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const require=createRequire(new URL('../../server/dist/app.js',import.meta.url));require('dotenv').config({path:'server/.env',quiet:true});assert.ok(['localhost','127.0.0.1'].includes(process.env.DB_HOST));const mysql=require('mysql2/promise'),config={host:process.env.DB_HOST,user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''};const admin=await mysql.createConnection(config);const name=`supplier_project_test_${process.pid}`;let pool,checks=0;const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await admin.query(`CREATE DATABASE ${name}`);pool=mysql.createPool({...config,database:name,connectionLimit:8});
 await require('./lib/supplierDrafts').ensureSupplierDraftSchema(pool);
 await pool.query('CREATE TABLE supplier_profiles(id INT PRIMARY KEY,slug VARCHAR(64))');await pool.query("INSERT INTO supplier_profiles VALUES(1,'one'),(2,'two')");
 await pool.query('CREATE TABLE supplier_projects(id INT AUTO_INCREMENT PRIMARY KEY,supplier_profile_id INT,title VARCHAR(255),description TEXT,location TEXT,area_sqm DECIMAL(12,2),budget VARCHAR(100),year VARCHAR(20),images JSON,sort_order INT)');
 const source=readFileSync('server/dist/controllers/supplierAdminController.js','utf8');
 const methods=source.slice(source.indexOf('async function adminAddProject('),source.indexOf('async function adminDeleteProject('));
 const handlers=vm.runInNewContext(methods+';({adminAddProject,adminUpdateProject})',{database_1:{default:pool},validProjectImageList:images=>Array.isArray(images)&&images.every(i=>typeof i==='string'),MAX_ADMIN_PROJECT_IMAGES:200,supplierImagePathIsOwned:async()=>true,logSupplierAction:async()=>{},console});
 const {createSupplierSubmissionHandler}=require('./lib/supplierSubmission');const {withCatalogChunkLock}=require('./lib/catalogChunkLock');
 const handler=createSupplierSubmissionHandler(pool,handlers.adminAddProject,handlers.adminUpdateProject);
 const id='11111111-1111-4111-8111-111111111111';
 const hit=async(title='Original',requestId=id,supplierId=1,selected=handler)=>{let status=200,data;const req={admin:{id:1},params:{id:supplierId},body:{title,images:[],draft_id:requestId}};await withCatalogChunkLock(pool,1,()=>selected(req,{status(code){status=code;return this;},json(value){data=value;return this;}}),'test-project');assert.equal(req.supplierWriteConnection,undefined);return{status,data};};
 const first=await hit();check(first.status,201);check(first.data.project.title,'Original');
 const replay=await hit('Edited after uncertain success');check(replay.status,200);check(replay.data.project.id,first.data.project.id);check(replay.data.project.title,'Edited after uncertain success');check((await pool.query('SELECT COUNT(*) n FROM supplier_projects'))[0][0].n,1);
 const parallel=await Promise.all([hit('Same retry'),hit('Same retry')]);check(parallel[0].data.project.id,parallel[1].data.project.id);check((await pool.query('SELECT COUNT(*) n FROM supplier_projects'))[0][0].n,1);
 check((await hit('New supplier',id,2)).status,201);check((await pool.query('SELECT COUNT(*) n FROM supplier_projects'))[0][0].n,2);
 check((await hit('Bad','invalid')).status,400);
 const failingPool={getConnection:async()=>{const connection=await pool.getConnection();const execute=connection.execute.bind(connection);return{beginTransaction:()=>connection.beginTransaction(),commit:()=>connection.commit(),rollback:()=>connection.rollback(),release:()=>connection.release(),execute:(sql,args)=>{if(sql.startsWith('INSERT INTO admin_supplier_submissions'))throw Error('Injected receipt failure');return execute(sql,args);}};}};
 const failure=await hit('Rolled back','22222222-2222-4222-8222-222222222222',1,createSupplierSubmissionHandler(failingPool,handlers.adminAddProject,handlers.adminUpdateProject));check(failure.status,500);check((await pool.query('SELECT COUNT(*) n FROM supplier_projects'))[0][0].n,2);
 await pool.execute('DELETE FROM supplier_projects WHERE id=?',[first.data.project.id]);check((await hit('No resurrection')).status,404);check((await pool.query('SELECT COUNT(*) n FROM supplier_projects'))[0][0].n,1);
 console.log(`supplier-project-submission: ${checks}/${checks} PASS`);
}finally{await pool?.end();await admin.query(`DROP DATABASE IF EXISTS ${name}`);await admin.end();}
