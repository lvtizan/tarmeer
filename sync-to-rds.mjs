import mysql from 'mysql2/promise';

const LOCAL_CONFIG = {
  host: 'localhost',
  user: 'root',
  database: 'tarmeer',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
};

const RDS_CONFIG = {
  host: 'rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com',
  user: 'tarmeerCRM',
  password: 'Tarmeer2026@',
  database: 'tarmeer',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
};

async function syncProjects() {
  let localConn = null;
  let rdsConn = null;

  try {
    // 连接本地数据库
    console.log('🔗 连接本地数据库...');
    localConn = await mysql.createConnection(LOCAL_CONFIG);
    console.log('✅ 本地数据库已连接\n');

    // 连接RDS
    console.log('🔗 连接线上RDS数据库...');
    rdsConn = await mysql.createConnection(RDS_CONFIG);
    console.log('✅ 线上RDS已连接\n');

    // 获取这两个设计师的所有项目
    console.log('📋 从本地读取数据...');
    const [projects] = await localConn.query(
      'SELECT * FROM projects WHERE designer_id IN (2035, 2041) ORDER BY id'
    );
    console.log(`✅ 读取了 ${projects.length} 个项目\n`);

    // 在RDS上删除旧数据
    console.log('🗑️  在RDS删除旧数据...');
    await rdsConn.query('DELETE FROM projects WHERE designer_id IN (2035, 2041)');
    console.log('✅ 旧数据已删除\n');

    // 上传每个项目
    console.log('📤 上传项目到RDS...\n');
    for (const project of projects) {
      const {
        id, designer_id, title, description, style, location, area, year, cost,
        images, tags, status, rejection_reason, created_at, updated_at, view_count
      } = project;

      try {
        await rdsConn.query(
          `INSERT INTO projects 
           (id, designer_id, title, description, style, location, area, year, cost, images, tags, status, rejection_reason, created_at, updated_at, view_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, designer_id, title, description, style, location, area, year, cost,
            images, tags, status, rejection_reason, created_at, updated_at, view_count
          ]
        );

        const imageCount = typeof images === 'string' 
          ? (JSON.parse(images)?.length || 0) 
          : (images?.length || 0);
        const dataSize = (Buffer.byteLength(JSON.stringify(images)) / (1024 * 1024)).toFixed(2);

        console.log(`✅ 项目 ${id}: "${title}" (${imageCount} 张图片, ${dataSize} MB)`);
      } catch (err) {
        console.error(`❌ 项目 ${id} 上传失败:`, err.message);
      }
    }

    console.log('\n✅ 所有项目已上传到RDS！\n');

    // 验证数据
    console.log('🔍 验证RDS数据...\n');
    const [verifyProjects] = await rdsConn.query(
      'SELECT id, designer_id, title, LENGTH(images)/(1024*1024) as size_mb FROM projects WHERE designer_id IN (2035, 2041) ORDER BY id'
    );

    console.log('线上RDS项目状态:');
    console.log('────────────────────────────────────────────────');
    for (const p of verifyProjects) {
      console.log(`📌 项目 ${p.id}: "${p.title}" (${p.size_mb.toFixed(2)} MB)`);
    }
    console.log('────────────────────────────────────────────────\n');

    console.log('✅ 数据同步完成！');
    console.log('\n📌 后续验证步骤:');
    console.log('1. 检查前端能否显示这些项目');
    console.log('2. 访问: https://designer.tarmeer.com/showcase');

  } catch (error) {
    console.error('❌ 同步失败:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 提示: RDS连接失败，请检查:');
      console.error('   - RDS主机地址');
      console.error('   - 用户名和密码');
      console.error('   - 网络连接是否正常');
    }
  } finally {
    if (localConn) await localConn.end();
    if (rdsConn) await rdsConn.end();
  }
}

syncProjects();
