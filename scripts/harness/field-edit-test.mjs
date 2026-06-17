/**
 * 回归守卫：访谈记录「编辑」按钮 + 编辑需外勤人员登录验证。
 * 编辑已提交问卷 = field_staff/super_admin 专属（后端 field.js 已 requireFieldOrSuperAdmin）；
 * 前端：详情有 Edit 入口 → /field/survey?edit=<id> → 无 field_token 跳 /field/login → 登录后跳回。
 */
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? (console.log(`  \x1b[32m✓\x1b[0m ${name}`), pass++) : (console.log(`  \x1b[31m✗\x1b[0m ${name}`), fail++); };

console.log('\n[field-edit] 访谈编辑按钮 + 外勤登录验证回归');

const visit = readFileSync('src/app/admin/visit-records/page.tsx', 'utf8');
check('详情已提交记录有 Edit 入口 /field/survey?edit=', /\/field\/survey\?edit=\$\{detail\.id\}/.test(visit));
check('Edit 仅 submitted 显示', /detail\.status === 'submitted' &&[\s\S]{0,200}\/field\/survey\?edit=/.test(visit));

const survey = readFileSync('src/app/field/survey/page.tsx', 'utf8');
check('survey 读 ?edit 进编辑模式', /URLSearchParams\(window\.location\.search\)\.get\('edit'\)/.test(survey));
check('编辑模式无 field_token → 跳 /field/login?return', /field_token[\s\S]{0,120}\/field\/login\?return=/.test(survey));
check('编辑模式 loadInterview + setEditingInterviewId', /loadInterview\(Number\(editId\)\)/.test(survey) && /setEditingInterviewId\(Number\(editId\)\)/.test(survey));

const login = readFileSync('src/app/field/login/page.tsx', 'utf8');
check('field/login 仅 field_staff/super_admin 可登录', /field_staff[\s\S]{0,60}super_admin/.test(login));
check('field/login 登录后跳回 return', /URLSearchParams\(window\.location\.search\)\.get\('return'\)/.test(login));

console.log('─'.repeat(40));
if (fail === 0) { console.log(`\x1b[32m field-edit: all ${pass} checks passed\x1b[0m`); process.exit(0); }
else { console.log(`\x1b[31m field-edit: ${fail} failed\x1b[0m`); process.exit(1); }
