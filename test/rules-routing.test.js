import http from 'http';

const API_BASE = '/api';
const HOST = 'localhost';
const PORT = 3001;

function apiRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
      port: PORT,
      path: `${API_BASE}${path}`,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          reject(new Error(`API ${path} parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function logTest(name, fn) {
  console.log(`\n=== ${name} ===`);
  return fn().then(r => { console.log('✅ PASS'); return r; })
    .catch(e => { console.log('❌ FAIL:', e.message); throw e; });
}

async function test() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Rules 路由顺序回归测试（运行时）                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 测试 1: /default 接口应该返回默认规则，不能被 /:id 匹配
  await logTest('1. /api/rules/default 返回默认规则', async () => {
    const r = await apiRequest('/rules/default', 'GET');
    if (r.status !== 200) throw new Error(`状态码应为 200，实际 ${r.status}`);
    if (!r.data.success) throw new Error('success 应为 true');
    if (!r.data.rules) throw new Error('缺少 rules 字段');
    if (r.data.rules.overdueDays !== 15) throw new Error(`默认 overdueDays 应为 15，实际 ${r.data.rules.overdueDays}`);
    if (r.data.rules.duplicateReturnWindow !== 30) throw new Error(`默认 duplicateReturnWindow 应为 30`);
    console.log('  overdueDays:', r.data.rules.overdueDays);
    console.log('  duplicateReturnWindow:', r.data.rules.duplicateReturnWindow);
  });

  // 测试 2: 保存规则，获取真实 id
  let testRulesId;
  await logTest('2. 保存规则获取测试 id', async () => {
    const r = await apiRequest('/rules/save', 'POST', {
      rules: {
        overdueDays: 25,
        duplicateReturnWindow: 45,
        qualityConflictTypes: ['性能故障', '外观瑕疵'],
        enableAutoIsolate: true
      }
    });
    if (r.status !== 200) throw new Error(`状态码应为 200，实际 ${r.status}`);
    if (!r.data.success) throw new Error('保存失败');
    testRulesId = r.data.rulesId;
    console.log('  规则 id:', testRulesId);
  });

  // 测试 3: 正常 id 查询应该返回规则详情
  await logTest('3. 正常 id 查询返回规则详情', async () => {
    const r = await apiRequest(`/rules/${testRulesId}`, 'GET');
    if (r.status !== 200) throw new Error(`状态码应为 200，实际 ${r.status}`);
    if (!r.data.success) throw new Error('success 应为 true');
    if (r.data.rules.overdueDays !== 25) throw new Error(`overdueDays 应为 25，实际 ${r.data.rules.overdueDays}`);
    console.log('  规则存在，overdueDays:', r.data.rules.overdueDays);
  });

  // 测试 4: 不存在 id 查询应该返回 404
  await logTest('4. 不存在 id 查询返回 404', async () => {
    const r = await apiRequest('/rules/not-exist-id-12345', 'GET');
    if (r.status !== 404) throw new Error(`状态码应为 404，实际 ${r.status}`);
    if (r.data.success) throw new Error('success 应为 false');
    if (r.data.error !== '规则版本不存在') throw new Error(`错误信息应为 '规则版本不存在'，实际 '${r.data.error}'`);
    console.log('  正确返回 404:', r.data.error);
  });

  // 测试 5: 规则校验接口应该正常工作
  await logTest('5. 规则校验接口正常', async () => {
    const r = await apiRequest('/rules/validate', 'POST', {
      rules: {
        overdueDays: 10,
        duplicateReturnWindow: 20,
        qualityConflictTypes: ['性能故障']
      }
    });
    if (r.status !== 200) throw new Error(`状态码应为 200，实际 ${r.status}`);
    if (!r.data.success) throw new Error('校验应该通过');
    console.log('  校验通过');
  });

  // 测试 6: 再次验证 /default 没有被破坏（确保路由顺序稳定）
  await logTest('6. 再次验证 /default 接口稳定性', async () => {
    const r = await apiRequest('/rules/default', 'GET');
    if (r.status !== 200) throw new Error(`状态码应为 200，实际 ${r.status}`);
    if (r.data.rules.overdueDays !== 15) throw new Error('默认规则被破坏');
    console.log('  /default 稳定返回默认规则');
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    🎉 所有测试通过！                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n📊 测试总结:');
  console.log('  ✅ /api/rules/default 稳定返回默认规则');
  console.log('  ✅ /api/rules/:id 正常 id 查询正常');
  console.log('  ✅ /api/rules/:id 不存在 id 返回 404');
  console.log('  ✅ 路由顺序正确，/default 不会被 /:id 先匹配');
}

test().catch(e => {
  console.error('\n❌ 测试失败:', e.message);
  process.exit(1);
});
