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
 * 清理目录中的符号链接和硬链接（GitHub Pages 部署要求 artifact 中不能含有链接文件）
 * - symlink：替换为其目标内容的真实副本；无法解析的（坏链接）直接删除
 * - 硬链接（nlink > 1）：重写为独立文件
 */
function sanitizeLinks(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        const stat = fs.stat(fullPath); // 跟随链接获取真实目标信息
        if (stat.isDirectory()) {
          const target = fs.realpathSync(fullPath);
          fs.rmSync(fullPath, { recursive: true, force: true });
          fs.cpSync(target, fullPath, { recursive: true });
        } else {
          const content = fs.readFileSync(fullPath);
          fs.rmSync(fullPath, { force: true });
          fs.writeFileSync(fullPath, content);
        }
        console.log(`  ↻ Replaced symlink: ${fullPath}`);
      } catch {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ✗ Removed broken symlink: ${fullPath}`);
      }
    } else if (entry.isDirectory()) {
      sanitizeLinks(fullPath);
    } else if (entry.isFile()) {
      const lstat = fs.lstatSync(fullPath);
      if (lstat.nlink > 1) {
        const content = fs.readFileSync(fullPath);
        fs.rmSync(fullPath, { force: true });
        fs.writeFileSync(fullPath, content);
        console.log(`  ↻ Rewrote hard link as regular file: ${fullPath}`);
      }
    }
  }
}

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
/**
 * 拷贝plugins.json
 */
function copyPluginMeta() {
  fs.copyFileSync("plugins.json", path.join(siteDir, "plugins.json"))
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
      sanitizeLinks(destDir);

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

  // 对整个站点目录统一清理（覆盖缓存恢复的旧内容）
  sanitizeLinks(siteDir);

  // 生成总索引
  generateRootIndex(siteDir, pluginsConfig);
}

processPlugins().catch(err => {
  console.error(err);
  process.exit(1);
});
copyPluginMeta();