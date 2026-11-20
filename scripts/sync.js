const fs = require('fs');
const path = require('path');
const pacote = require('pacote');

const pluginsConfig = JSON.parse(fs.readFileSync('plugins.json', 'utf-8'));
const siteDir = 'plugins';

// 确保 plugins 存在
if (!fs.existsSync(siteDir)) {
  fs.mkdirSync(siteDir, { recursive: true });
}

/**
 * 为某个版本目录生成 index.html（列出所有文件）
 */
// function generateVersionIndex(dir, name, version) {
//   const files = [];

//   function walk(currentDir, relativePath = '') {
//     const entries = fs.readdirSync(currentDir, { withFileTypes: true });
//     for (const entry of entries) {
//       const fullPath = path.join(currentDir, entry.name);
//       const relPath = path.join(relativePath, entry.name);
//       if (entry.isDirectory()) {
//         walk(fullPath, relPath);
//       } else {
//         files.push(relPath);
//       }
//     }
//   }
//   walk(dir);

//   let html = `<!DOCTYPE html>
// <html lang="en">
// <head><meta charset="UTF-8"><title>${name} ${version}</title></head>
// <body>
// <h1>${name} @ ${version}</h1>
// <ul>`;
//   for (const file of files) {
//     html += `<li><a href="${encodeURI(file)}">${file}</a></li>`;
//   }
//   html += `</ul></body></html>`;
//   fs.writeFileSync(path.join(dir, 'index.html'), html);
// }

/**
 * 生成根目录 index.html（列出所有已同步的插件版本）
 */
function generateRootIndex(siteDir, plugins) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Plugin Index</title></head>
<body>
<h1>Available Plugins</h1>
<ul>`;
  for (const plugin of plugins) {
    const { name, version } = plugin;
    const dirPath = path.join(name, version);
    if (fs.existsSync(path.join(siteDir, dirPath))) {
      html += `<li><a href="${dirPath}/">${name} @ ${version}</a></li>`;
    }
  }
  html += `</ul></body></html>`;
  fs.writeFileSync(path.join(siteDir, 'index.html'), html);
}

async function processPlugins() {
  for (const plugin of pluginsConfig) {
    const { name, version } = plugin;
    const destDir = path.join(siteDir, name, version);

    // 增量跳过：如果目录已存在，跳过下载
    if (fs.existsSync(destDir)) {
      console.log(`✔ Skipping ${name}@${version} (already exists)`);
      continue;
    }

    console.log(`⬇ Downloading ${name}@${version}...`);
    try {
      // pacote.extract 会自动创建目录
      await pacote.extract(`${name}@${version}`, destDir);
      console.log(`✓ Extracted to ${destDir}`);

      // 为该版本生成 index.html
      // generateVersionIndex(destDir, name, version);
    } catch (err) {
      console.error(`✗ Failed to download ${name}@${version}: ${err.message}`);
      // 清理可能产生的部分文件
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
    }
  }

  // 生成总索引
  generateRootIndex(siteDir, pluginsConfig);
}

processPlugins().catch(err => {
  console.error(err);
  process.exit(1);
});