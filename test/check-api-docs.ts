import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const log = (msg: string) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`);
const pass = (msg: string) => console.log(`✅ PASS: ${msg}`);
const fail = (msg: string) => console.log(`❌ FAIL: ${msg}`);
const warn = (msg: string) => console.log(`⚠️  WARN: ${msg}`);
const info = (msg: string) => console.log(`ℹ️  ${msg}`);

interface RouteInfo {
  method: string;
  path: string;
  fullPath: string;
  file: string;
}

interface ReadmeApiRef {
  path: string;
  method: string;
  line: number;
}

const extractRoutesFromFile = async (filePath: string, routePrefix: string): Promise<RouteInfo[]> => {
  const content = await fs.readFile(filePath, 'utf-8');
  const routes: RouteInfo[] = [];
  const relativePath = path.relative(projectRoot, filePath);
  
  const routerPattern = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = routerPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const fullPath = `/api${routePrefix}${routePath}`.replace(/\/+/g, '/');
    routes.push({ method, path: routePath, fullPath, file: relativePath });
  }
  
  return routes;
};

const extractReadmeApiRefs = async (readmePath: string): Promise<ReadmeApiRef[]> => {
  const content = await fs.readFile(readmePath, 'utf-8');
  const lines = content.split('\n');
  const refs: ReadmeApiRef[] = [];
  
  const apiPattern = /[`'"]?([A-Z]+)\s+(\/api\/[^`'"<>\s]+)[`'"]?/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    
    while ((match = apiPattern.exec(line)) !== null) {
      const method = match[1].toUpperCase();
      const apiPath = match[2].replace(/[`'"]$/, '');
      refs.push({ method, path: apiPath, line: i + 1 });
    }
  }
  
  return refs;
};

const normalizePath = (p: string): string => {
  return p
    .replace(/\/+$/, '')
    .replace(/\/:[^/]+/g, '/:param');
};

const pathMatches = (actual: string, reference: string): boolean => {
  const normActual = normalizePath(actual);
  const normReference = normalizePath(reference);
  
  if (normActual === normReference) return true;
  
  const actualParts = normActual.split('/');
  const refParts = normReference.split('/');
  
  if (actualParts.length !== refParts.length) return false;
  
  for (let i = 0; i < actualParts.length; i++) {
    if (actualParts[i].startsWith(':')) {
      continue;
    }
    if (actualParts[i] !== refParts[i]) {
      if (refParts[i].startsWith(':') || /^[a-f0-9-]+$/.test(refParts[i])) {
        continue;
      }
      return false;
    }
  }
  
  return true;
};

const checkReadmeApiRefs = async () => {
  log('API 路径防回归检查');
  
  const routeFiles = [
    { file: 'api/routes/import.ts', prefix: '/import' },
    { file: 'api/routes/mapping.ts', prefix: '/mapping' },
    { file: 'api/routes/rules.ts', prefix: '/rules' },
    { file: 'api/routes/analyze.ts', prefix: '/analyze' },
    { file: 'api/routes/export.ts', prefix: '/export' },
    { file: 'api/routes/auth.ts', prefix: '/auth' },
  ];
  
  info('从路由文件提取真实 API 路径...');
  const allRoutes: RouteInfo[] = [];
  for (const rf of routeFiles) {
    const routes = await extractRoutesFromFile(path.join(projectRoot, rf.file), rf.prefix);
    allRoutes.push(...routes);
  }
  
  info(`共找到 ${allRoutes.length} 个真实 API 路径:`);
  allRoutes.forEach(r => info(`  ${r.method} ${r.fullPath} (${r.file})`));
  
  info('\n从 README 提取 API 引用...');
  const readmePath = path.join(projectRoot, 'README.md');
  const readmeRefs = await extractReadmeApiRefs(readmePath);
  
  info(`共找到 ${readmeRefs.length} 个 README API 引用:`);
  readmeRefs.forEach(r => info(`  ${r.method} ${r.path} (第 ${r.line} 行)`));
  
  info('\n检查 README API 引用是否存在...');
  const errors: string[] = [];
  
  for (const ref of readmeRefs) {
    const matched = allRoutes.some(r => 
      r.method === ref.method && pathMatches(r.fullPath, ref.path)
    );
    
    if (!matched) {
      const error = `README 第 ${ref.line} 行引用的 API 不存在: ${ref.method} ${ref.path}`;
      errors.push(error);
      fail(error);
    } else {
      pass(`README 第 ${ref.line} 行: ${ref.method} ${ref.path} ✓`);
    }
  }
  
  if (errors.length > 0) {
    console.log(`\n❌ 发现 ${errors.length} 个问题:`);
    errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('\n🎉 所有 README API 引用均有效！');
  }
  
  const unlistedRoutes = allRoutes.filter(r => 
    !readmeRefs.some(ref => 
      ref.method === r.method && pathMatches(r.fullPath, ref.path)
    )
  );
  
  if (unlistedRoutes.length > 0) {
    warn(`\n⚠️  以下 ${unlistedRoutes.length} 个 API 未在 README 中列出:`);
    unlistedRoutes.forEach(r => warn(`  ${r.method} ${r.fullPath}`));
  }
  
  return errors.length === 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkReadmeApiRefs().catch(console.error);
}

export { checkReadmeApiRefs };
