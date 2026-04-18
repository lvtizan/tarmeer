import sharp from 'sharp';
import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'root',
  database: 'tarmeer'
};

async function compressImages() {
  const connection = await mysql.createConnection(config);
  
  try {
    // 获取这两个设计师的所有项目
    const [projects] = await connection.query(
      'SELECT id, designer_id, title, images FROM projects WHERE designer_id IN (2035, 2041)'
    );
    
    console.log(`\n找到 ${projects.length} 个项目需要处理\n`);
    
    for (const project of projects) {
      try {
        // 处理可能是字符串或已解析的对象
        let images = project.images;
        if (typeof images === 'string') {
          images = JSON.parse(images);
        }
        
        if (!Array.isArray(images) || images.length === 0) {
          console.log(`⏭️  项目 ${project.id} (${project.title}): 没有图片，跳过`);
          continue;
        }
        
        console.log(`\n📦 项目 ${project.id} (${project.title})`);
        console.log(`   找到 ${images.length} 张图片`);
        
        const compressedImages = [];
        let hasChanges = false;
        
        for (let i = 0; i < images.length; i++) {
          const imageData = images[i];
          
          if (typeof imageData !== 'string' || !imageData.startsWith('data:')) {
            console.log(`   [${i+1}/${images.length}] 不是 base64 格式，跳过`);
            compressedImages.push(imageData);
            continue;
          }
          
          // 解析 base64
          const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            console.log(`   [${i+1}/${images.length}] 格式错误，跳过`);
            compressedImages.push(imageData);
            continue;
          }
          
          const mimeType = matches[1];
          const base64 = matches[2];
          const buffer = Buffer.from(base64, 'base64');
          const originalSize = buffer.length / (1024 * 1024);
          
          console.log(`   [${i+1}/${images.length}] 原始大小: ${originalSize.toFixed(2)} MB`);
          
          try {
            // 使用 sharp 压缩
            let compressedBuffer = await sharp(buffer)
              .png({ quality: 70, compressionLevel: 9 })
              .toBuffer();
            
            let compressedSize = compressedBuffer.length / (1024 * 1024);
            console.log(`              压缩后: ${compressedSize.toFixed(2)} MB (${((1 - compressedSize/originalSize) * 100).toFixed(1)}% 减少)`);
            
            // 如果仍然超过 5MB，尝试更激进的压缩
            if (compressedSize > 5) {
              console.log(`   ⚠️  仍然超过 5MB，尝试更激进的压缩...`);
              compressedBuffer = await sharp(buffer)
                .png({ quality: 50, compressionLevel: 9 })
                .resize(3840, 2160, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();
              
              compressedSize = compressedBuffer.length / (1024 * 1024);
              console.log(`              激进压缩: ${compressedSize.toFixed(2)} MB`);
            }
            
            // 如果还是超过，再试一次更激进的
            if (compressedSize > 5) {
              console.log(`   ⚠️  仍然超过 5MB，尝试极端压缩...`);
              compressedBuffer = await sharp(buffer)
                .png({ quality: 40, compressionLevel: 9 })
                .resize(2560, 1440, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();
              
              compressedSize = compressedBuffer.length / (1024 * 1024);
              console.log(`              极端压缩: ${compressedSize.toFixed(2)} MB`);
            }
            
            const newBase64 = compressedBuffer.toString('base64');
            compressedImages.push(`data:image/png;base64,${newBase64}`);
            hasChanges = true;
          } catch (err) {
            console.log(`   ❌ 压缩失败: ${err.message}`);
            compressedImages.push(imageData);
          }
        }
        
        // 保存到数据库
        if (hasChanges) {
          const compressedJson = JSON.stringify(compressedImages);
          const compressedJsonSize = compressedJson.length / (1024 * 1024);
          console.log(`\n   保存到数据库... (总大小: ${compressedJsonSize.toFixed(2)} MB)`);
          
          await connection.query(
            'UPDATE projects SET images = ? WHERE id = ?',
            [compressedJson, project.id]
          );
          
          console.log(`   ✅ 保存成功！`);
        }
      } catch (err) {
        console.error(`❌ 处理项目 ${project.id} 失败:`, err.message);
      }
    }
    
    console.log('\n✅ 所有项目处理完成！');
    
  } finally {
    await connection.end();
  }
}

compressImages().catch(console.error);
