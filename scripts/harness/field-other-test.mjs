/**
 * 回归守卫：访谈问卷「其他」自定义文本必须显示 + 同步到公司详情。
 * 字段选「其他」时自定义文本存为 `${fieldKey}__other`；曾经 admin 端两处都没读它 → 看不到。
 * 本测试断言两处源码都读取并渲染 `__other`。
 */
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log(`  \x1b[32m✓\x1b[0m ${name}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${name}`); fail++; }
}

console.log('\n[field-other] 「其他」自定义文本显示/同步回归');

const visit = readFileSync('src/app/admin/visit-records/page.tsx', 'utf8');
const renderer = readFileSync('src/components/admin/VerificationRecordSections.tsx', 'utf8');
check('访谈记录详情接入共享动态渲染器', visit.includes('<VerificationRecordSections'));
check('访谈记录详情读取并渲染 other 自定义文本', /\$\{field\.key\}__other/.test(renderer) && renderer.includes('<RecordValue value={section.data[`${field.key}__other`]}'));
check('只填其他的 section 不被隐藏', !renderer.includes('if (!hasAnyData) return null') && renderer.includes('sections.map'));

const profile = readFileSync('src/app/admin/profile-companies/[id]/page.tsx', 'utf8');
check('公司详情 interviewIndex 读取 ${field.key}__other', /\$\{field\.key\}__other/.test(profile));
check('公司详情把 other 拼进 display', /Other['"],\s*['"]其他['"]\)/.test(profile));

console.log('─'.repeat(40));
if (fail === 0) { console.log(`\x1b[32m field-other: all ${pass} checks passed\x1b[0m`); process.exit(0); }
else { console.log(`\x1b[31m field-other: ${fail} failed\x1b[0m`); process.exit(1); }
