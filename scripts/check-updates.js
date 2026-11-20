const fs = require('fs');
const { execSync } = require('child_process');

const PLUGINS_FILE = 'plugins.json';
const MAX_VERSIONS_PER_PACKAGE = 5;

// 读取现有配置
let plugins = [];
try {
  plugins = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf-8'));
} catch {
  console.log('plugins.json not found or invalid, starting fresh.');
}

// 获取当前包名集合
const packageNames = [...new Set(plugins.map(p => p.name))];

// 如果没有包，退出
if (packageNames.length === 0) {
  console.log('No packages in plugins.json, nothing to check.');
  process.exit(0);
}

let changed = false;

for (const name of packageNames) {
  try {
    // 获取 npm 上最新版本
    const latest = execSync(`npm view ${name} version`, { encoding: 'utf-8' }).trim();
    console.log(`Package ${name}: latest = ${latest}`);

    // 检查是否已存在该版本
    const existingVersions = plugins.filter(p => p.name === name).map(p => p.version);
    if (existingVersions.includes(latest)) {
      console.log(`  Already have ${latest}, skipping.`);
      continue;
    }

    // 添加新版本
    plugins.push({ name, version: latest });
    changed = true;
    console.log(`  Added ${name}@${latest}.`);

    // 对该包的所有版本按 semver 降序排列，保留最新的 MAX_VERSIONS_PER_PACKAGE 个
    const allForThis = plugins.filter(p => p.name === name);
    allForThis.sort((a, b) => compareSemver(b.version, a.version)); // 降序

    while (allForThis.length > MAX_VERSIONS_PER_PACKAGE) {
      const removed = allForThis.pop(); // 移除最旧的一个
      const idx = plugins.findIndex(p => p.name === removed.name && p.version === removed.version);
      if (idx !== -1) {
        plugins.splice(idx, 1);
        changed = true;
        console.log(`  Removed old version ${removed.version} (exceeds limit).`);
      }
    }
  } catch (err) {
    console.error(`Failed to check ${name}: ${err.message}`);
  }
}

if (changed) {
  fs.writeFileSync(PLUGINS_FILE, JSON.stringify(plugins, null, 2) + '\n');
  console.log('plugins.json updated.');
} else {
  console.log('No changes needed.');
}

// 辅助：比较 semver 版本（简单字符串分割，适用于标准 semver）
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}