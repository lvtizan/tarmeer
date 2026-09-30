// Read-only scan of a server-exported product snapshot. No database access.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sanitizeDescription} from '../../src/lib/materialDescription.ts';
const snapshot=process.argv[2];
if(!snapshot)throw Error('Usage: node scripts/harness/material-description-audit.mjs <snapshot.json> [report.json]');
const rows=JSON.parse(fs.readFileSync(snapshot,'utf8'));
const edits=JSON.parse(fs.readFileSync(new URL('../operations/data/material-descriptions-20260930.json',import.meta.url)));
const html=/<\/?[a-zA-Z][^>]*>|&(?:lt|gt|nbsp);/;
const summary={total:rows.length,published:0,html:0,publishedHtml:0,empty:0,untranslatedPublishedAe:0,placeholder:0};
const items=[];
for(const row of rows){
 const before=row.description_translated||row.description||'';
 const edited=edits.find(e=>e.id===row.id);
 if(edited)assert.equal(row.supplier_profile_id,edited.supplier_id);
 const cleaned=sanitizeDescription(edited?.after??before)||'';
 const published=row.status==='approved'&&!!row.is_published;
 summary.published+=published;
 const flags=[];
 if(html.test(before)){summary.html++;summary.publishedHtml+=published;flags.push('imported_html');}
 if(!cleaned){summary.empty++;flags.push('description_missing');}
 if(published&&row.country==='ae'&&/[\u3400-\u9fff]/.test(cleaned)){summary.untranslatedPublishedAe++;flags.push('untranslated');}
 if(/^\d+$/.test(cleaned)){summary.placeholder++;flags.push('placeholder');}
 assert(!html.test(cleaned),`Markup remains in ${row.id}`);
 if(flags.length||edited)items.push({id:row.id,supplier_id:row.supplier_profile_id,country:row.country,published,flags,editorialUpdate:!!edited});
}
assert.equal(summary.untranslatedPublishedAe,0);assert.equal(summary.placeholder,0);
const report={summary,editorialUpdates:edits.length,items};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2));
console.log(JSON.stringify(summary));console.log(`${rows.length}/${rows.length} description format checks PASS; ${edits.length} editorial updates`);
