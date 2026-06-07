import assert from 'assert';
import http from 'http';

const API_BASE = 'http://localhost:3001/api';

const log = (msg: string) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`);
const pass = (msg: string) => console.log(`✅ PASS: ${msg}`);
const fail = (msg: string) => { console.log(`❌ FAIL: ${msg}`); process.exit(1); };
const info = (msg: string) => console.log(`ℹ️  ${msg}`);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

const runTest = async (name: string, testFn: () => Promise<void>) => {
  try {
    await testFn();
    results.push({ name, passed: true });
    pass(name);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    results.push({ name, passed: false, error: errorMsg });
    fail(`${name} - ${errorMsg}`);
  }
};

const apiRequest = async (path: string, options: any = {}): Promise<any> => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API ${path} failed: ${parsed.error || res.statusMessage}`));
          }
        } catch (e) {
          reject(new Error(`API ${path} parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
};

let orderFileId: string;
let returnFileId: string;
let qualityFileId: string;
let mappingId: string;
let rulesId: string;
let runId: string;
let exportId: string;
let exportFileName: string;

log('端到端链路测试');

log('步骤 0: 检查服务健康状态');
await runTest('健康检查', async () => {
  const result = await apiRequest('/health');
  assert(result.success === true, '健康检查失败');
  info('服务运行正常');
});

log('步骤 1: 获取示例数据');
await runTest('获取示例数据', async () => {
  const result = await apiRequest('/import/sample');
  assert(result.success === true, '获取示例数据失败');
  assert(result.order.data.length > 0, '订单数据为空');
  assert(result.return.data.length > 0, '退货数据为空');
  assert(result.quality.data.length > 0, '质检数据为空');
  info(`订单: ${result.order.data.length} 行, 退货: ${result.return.data.length} 行, 质检: ${result.quality.data.length} 行`);
});

log('步骤 2: 数据校验 - 正常数据');
await runTest('校验正常订单数据', async () => {
  const sample = await apiRequest('/import/sample');
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = await apiRequest('/import/validate', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'order',
      data: sample.order.data,
      columns: sample.order.columns,
      mapping,
      enableAutoIsolate: true,
    }),
  });
  
  assert(result.success === true, '正常数据校验失败');
  assert(result.rejectAll !== true, '正常数据不应被整批拒绝');
  assert(result.validData.length > 0, '有效数据为空');
  info(`有效数据: ${result.validData.length} 行, 坏行: ${result.badRows?.length || 0} 行`);
});

log('步骤 3: 数据校验 - orderId 缺列整批拒绝');
await runTest('orderId 缺列应整批拒绝', async () => {
  const columns = ['orderDate', 'customerId', 'productId', 'amount'];
  const data = [
    { orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
  ];
  const mapping = {
    '不存在的列': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = await apiRequest('/import/validate', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'order',
      data,
      columns,
      mapping,
      enableAutoIsolate: true,
    }),
  });
  
  assert(result.success === false, 'orderId 缺列校验应失败');
  assert(result.rejectAll === true, 'orderId 缺列应整批拒绝');
  assert(result.rejectReason?.includes('关联字段映射错误'), '拒绝原因应包含关联字段映射错误');
  assert(!result.validData || result.validData.length === 0, '整批拒绝时不应有 validData');
  info(`拒绝原因: ${result.rejectReason}`);
});

log('步骤 4: 数据校验 - orderId 为空整批拒绝');
await runTest('orderId 为空应整批拒绝', async () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: '', orderDate: '2024-01-16', customerId: 'C002', productId: '电脑', amount: 5999 },
  ];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = await apiRequest('/import/validate', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'order',
      data,
      columns,
      mapping,
      enableAutoIsolate: true,
    }),
  });
  
  assert(result.success === false, 'orderId 为空校验应失败');
  assert(result.rejectAll === true, 'orderId 为空应整批拒绝');
  assert(result.rejectReason?.includes('关联字段为空'), '拒绝原因应包含关联字段为空');
  info(`拒绝原因: ${result.rejectReason}`);
});

log('步骤 5: 数据校验 - 坏日期按坏行隔离');
await runTest('坏日期应按坏行隔离', async () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: 'ORD002', orderDate: '无效日期', customerId: 'C002', productId: '电脑', amount: 5999 },
    { orderId: 'ORD003', orderDate: '2024-01-17', customerId: 'C003', productId: '耳机', amount: 599 },
  ];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = await apiRequest('/import/validate', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'order',
      data,
      columns,
      mapping,
      enableAutoIsolate: true,
    }),
  });
  
  assert(result.success === true, '坏日期隔离校验应成功');
  assert(result.rejectAll !== true, '坏日期不应整批拒绝');
  assert(result.validData.length === 2, '有效数据应为 2 行');
  assert(result.badRows.length === 1, '坏行应为 1 行');
  assert(result.badRows[0].errorType === 'invalid_date', '坏行类型应为 invalid_date');
  info(`有效数据: ${result.validData.length} 行, 坏行: ${result.badRows.length} 行`);
  info(`坏行原因: ${result.badRows[0].errorMessage}`);
});

log('步骤 6: 保存三个文件');
await runTest('保存订单文件', async () => {
  const sample = await apiRequest('/import/sample');
  const result = await apiRequest('/import/save', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'order',
      fileName: 'test_orders.csv',
      data: sample.order.data,
      columns: sample.order.columns,
    }),
  });
  
  assert(result.success === true, '保存订单文件失败');
  orderFileId = result.fileId;
  info(`订单文件 ID: ${orderFileId}`);
});

await runTest('保存退货文件', async () => {
  const sample = await apiRequest('/import/sample');
  const result = await apiRequest('/import/save', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'return',
      fileName: 'test_returns.csv',
      data: sample.return.data,
      columns: sample.return.columns,
    }),
  });
  
  assert(result.success === true, '保存退货文件失败');
  returnFileId = result.fileId;
  info(`退货文件 ID: ${returnFileId}`);
});

await runTest('保存质检文件', async () => {
  const sample = await apiRequest('/import/sample');
  const result = await apiRequest('/import/save', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'quality',
      fileName: 'test_quality.csv',
      data: sample.quality.data,
      columns: sample.quality.columns,
    }),
  });
  
  assert(result.success === true, '保存质检文件失败');
  qualityFileId = result.fileId;
  info(`质检文件 ID: ${qualityFileId}`);
});

log('步骤 7: 自动字段映射');
await runTest('自动字段映射', async () => {
  const sample = await apiRequest('/import/sample');
  const result = await apiRequest('/mapping/auto-map', {
    method: 'POST',
    body: JSON.stringify({
      orderColumns: sample.order.columns,
      returnColumns: sample.return.columns,
      qualityColumns: sample.quality.columns,
    }),
  });
  
  assert(result.success === true, '自动映射失败');
  assert(result.mapping.order, '缺少订单映射');
  assert(result.mapping.return, '缺少退货映射');
  assert(result.mapping.quality, '缺少质检映射');
  info('自动映射成功');
});

log('步骤 8: 保存字段映射');
await runTest('保存字段映射', async () => {
  const sample = await apiRequest('/import/sample');
  const autoMapResult = await apiRequest('/mapping/auto-map', {
    method: 'POST',
    body: JSON.stringify({
      orderColumns: sample.order.columns,
      returnColumns: sample.return.columns,
      qualityColumns: sample.quality.columns,
    }),
  });
  
  const result = await apiRequest('/mapping/save', {
    method: 'POST',
    body: JSON.stringify({
      name: 'E2E 测试映射',
      mapping: autoMapResult.mapping,
    }),
  });
  
  assert(result.success === true, '保存映射失败');
  mappingId = result.mappingId;
  info(`映射 ID: ${mappingId}`);
});

log('步骤 9: 保存规则');
await runTest('保存规则', async () => {
  const result = await apiRequest('/rules/save', {
    method: 'POST',
    body: JSON.stringify({
      rules: {
        overdueDays: 15,
        duplicateReturnWindow: 30,
        qualityConflictTypes: ['性能故障', '外观瑕疵', '包装问题'],
        enableAutoIsolate: true,
      },
    }),
  });
  
  assert(result.success === true, '保存规则失败');
  rulesId = result.rulesId;
  info(`规则 ID: ${rulesId}`);
});

log('步骤 10: 运行异常分析');
await runTest('运行异常分析', async () => {
  const result = await apiRequest('/analyze/run', {
    method: 'POST',
    body: JSON.stringify({
      mappingId,
      rulesId,
      orderFileId,
      returnFileId,
      qualityFileId,
    }),
  });
  
  assert(result.success === true, '分析运行失败');
  runId = result.runId;
  info(`运行 ID: ${runId}`);
  info(`异常总数: ${result.summary.totalAnomalies}`);
  info(`超期: ${result.summary.overdueCount}, 重复: ${result.summary.duplicateCount}, 冲突: ${result.summary.conflictCount}`);
});

log('步骤 11: 获取运行历史');
await runTest('获取运行历史', async () => {
  const result = await apiRequest('/analyze/history');
  assert(result.success === true, '获取运行历史失败');
  assert(result.runs.length > 0, '运行历史为空');
  const latestRun = result.runs[0];
  assert(latestRun.id === runId, '最新运行 ID 不匹配');
  info(`历史记录数: ${result.runs.length}`);
});

log('步骤 12: 获取运行详情');
await runTest('获取运行详情', async () => {
  const result = await apiRequest(`/analyze/run/${runId}`);
  assert(result.success === true, '获取运行详情失败');
  assert(result.run.id === runId, '运行 ID 不匹配');
  assert(result.anomalies.length > 0, '异常列表为空');
  info(`异常分组数: ${result.anomalies.length}, 坏行数: ${result.badRows?.length || 0}`);
});

log('步骤 13: 获取最新运行数据');
await runTest('获取最新运行数据', async () => {
  const result = await apiRequest('/analyze/latest');
  assert(result.success === true, '获取最新运行数据失败');
  assert(result.run.id === runId, '最新运行 ID 不匹配');
  info('最新运行数据获取成功');
});

log('步骤 14: 导出报告');
await runTest('导出 JSON 报告', async () => {
  const result = await apiRequest('/export', {
    method: 'POST',
    body: JSON.stringify({
      runId,
      format: 'json',
      includeTypes: ['overdue', 'duplicate', 'conflict'],
      includeBadRows: true,
    }),
  });
  
  assert(result.success === true, '导出失败');
  exportId = result.exportId;
  assert(result.downloadUrl, '缺少下载链接');
  exportFileName = result.downloadUrl.split('/').pop();
  info(`导出 ID: ${exportId}`);
  info(`下载文件名: ${exportFileName}`);
  info(`元数据: ${JSON.stringify(result.metadata)}`);
});

log('步骤 15: 获取导出历史');
await runTest('获取导出历史', async () => {
  const result = await apiRequest('/export/history');
  assert(result.success === true, '获取导出历史失败');
  assert(result.exports.length > 0, '导出历史为空');
  const latestExport = result.exports[0];
  assert(latestExport.id === exportId, '最新导出 ID 不匹配');
  info(`导出历史记录数: ${result.exports.length}`);
});

log('步骤 16: 获取导出记录详情');
await runTest('获取导出记录详情', async () => {
  const result = await apiRequest(`/export/${exportId}`);
  assert(result.success === true, '获取导出详情失败');
  assert(result.export.id === exportId, '导出 ID 不匹配');
  assert(result.export.metadata.runId === runId, '导出元数据 runId 不匹配');
  info('导出详情获取成功');
});

log('步骤 17: 分析接口 - orderId 缺列整批拒绝');
await runTest('分析接口 orderId 缺列应整批拒绝', async () => {
  const sample = await apiRequest('/import/sample');
  
  const badOrderData = sample.order.data.map((row: any) => ({ ...row, orderId: undefined }));
  const badOrderColumns = sample.order.columns.filter((c: string) => c !== 'orderId');
  
  const saveResult = await apiRequest('/import/save', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'order',
      fileName: 'bad_order_no_orderId.csv',
      data: badOrderData,
      columns: badOrderColumns,
    }),
  });
  
  const badMapping = { ...sample };
  const autoMapResult = await apiRequest('/mapping/auto-map', {
    method: 'POST',
    body: JSON.stringify({
      orderColumns: badOrderColumns,
      returnColumns: sample.return.columns,
      qualityColumns: sample.quality.columns,
    }),
  });
  
  const saveMappingResult = await apiRequest('/mapping/save', {
    method: 'POST',
    body: JSON.stringify({
      name: '坏映射测试',
      mapping: autoMapResult.mapping,
    }),
  });
  
  try {
    await apiRequest('/analyze/run', {
      method: 'POST',
      body: JSON.stringify({
        mappingId: saveMappingResult.mappingId,
        rulesId,
        orderFileId: saveResult.fileId,
        returnFileId,
        qualityFileId,
      }),
    });
    assert.fail('分析接口应该返回 400 错误');
  } catch (error: any) {
    assert(error.message.includes('校验失败'), '错误信息应包含校验失败');
    assert(error.message.includes('关联字段映射错误') || error.message.includes('关联字段为空'), '应包含关联字段错误');
    info(`正确拒绝: ${error.message}`);
  }
});

log('步骤 18: 校验接口 - 退货表 orderId 为空整批拒绝');
await runTest('退货表 orderId 为空应整批拒绝', async () => {
  const columns = ['returnId', 'orderId', 'returnDate', 'reason', 'status'];
  const data = [
    { returnId: 'RET001', orderId: 'ORD001', returnDate: '2024-02-01', reason: '质量问题', status: '已完成' },
    { returnId: 'RET002', orderId: '', returnDate: '2024-02-05', reason: '不喜欢', status: '处理中' },
  ];
  const mapping = {
    'returnId': 'returnId',
    'orderId': 'orderId',
    'returnDate': 'returnDate',
    'reason': 'reason',
    'status': 'status',
  };
  
  const result = await apiRequest('/import/validate', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'return',
      data,
      columns,
      mapping,
      enableAutoIsolate: true,
    }),
  });
  
  assert(result.success === false, '退货表 orderId 为空校验应失败');
  assert(result.rejectAll === true, '退货表 orderId 为空应整批拒绝');
  assert(result.rejectReason?.includes('关联字段为空'), '拒绝原因应包含关联字段为空');
  info(`拒绝原因: ${result.rejectReason}`);
});

log('步骤 19: 校验接口 - 质检表 orderId 为空整批拒绝');
await runTest('质检表 orderId 为空应整批拒绝', async () => {
  const columns = ['qualityId', 'orderId', 'inspectDate', 'result', 'defectType'];
  const data = [
    { qualityId: 'QAD001', orderId: 'ORD001', inspectDate: '2024-01-20', result: '合格', defectType: '无' },
    { qualityId: 'QAD002', orderId: '', inspectDate: '2024-01-21', result: '不合格', defectType: '性能故障' },
  ];
  const mapping = {
    'qualityId': 'qualityId',
    'orderId': 'orderId',
    'inspectDate': 'inspectDate',
    'result': 'result',
    'defectType': 'defectType',
  };
  
  const result = await apiRequest('/import/validate', {
    method: 'POST',
    body: JSON.stringify({
      fileType: 'quality',
      data,
      columns,
      mapping,
      enableAutoIsolate: true,
    }),
  });
  
  assert(result.success === false, '质检表 orderId 为空校验应失败');
  assert(result.rejectAll === true, '质检表 orderId 为空应整批拒绝');
  assert(result.rejectReason?.includes('关联字段为空'), '拒绝原因应包含关联字段为空');
  info(`拒绝原因: ${result.rejectReason}`);
});

log('\n' + '='.repeat(60));
console.log('\n📊 测试结果汇总:');
const passed = results.filter(r => r.passed).length;
const total = results.length;
console.log(`通过: ${passed}/${total}`);

if (passed === total) {
  console.log('\n🎉 所有端到端测试通过！');
} else {
  console.log('\n❌ 部分测试失败:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}`);
    if (r.error) console.log(`    错误: ${r.error}`);
  });
  process.exit(1);
}
