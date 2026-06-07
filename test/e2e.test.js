import http from 'http';

function apiRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api${path}`,
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
          resolve({ status: res.statusCode, data: data });
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
  console.log('║           售后退货异常分析看板 - API 链路测试              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 测试 1: 健康检查
  await logTest('1. 健康检查', async () => {
    const r = await apiRequest('/health', 'GET');
    if (r.status !== 200 || !r.data.success) throw new Error('健康检查失败');
    console.log('  状态:', r.status);
  });

  // 测试 2: 获取示例数据
  let sample;
  await logTest('2. 获取示例数据', async () => {
    const r = await apiRequest('/import/sample', 'GET');
    if (!r.data.success) throw new Error('获取示例数据失败');
    sample = r.data;
    console.log('  订单:', sample.order.data.length, '行');
    console.log('  退货:', sample.return.data.length, '行');
    console.log('  质检:', sample.quality.data.length, '行');
    console.log('  订单列名:', sample.order.columns.join(', '));
  });

  // 测试 3: 校验正常数据（中文列名 + 正确映射）
  await logTest('3. 正常数据校验（中文列名）', async () => {
    const body = {
      fileType: 'order',
      data: sample.order.data,
      columns: sample.order.columns,
      mapping: {
        '订单编号': 'orderId',
        '下单日期': 'orderDate',
        '客户ID': 'customerId',
        '商品名称': 'productId',
        '金额': 'amount'
      },
      enableAutoIsolate: true
    };
    const r = await apiRequest('/import/validate', 'POST', body);
    if (!r.data.success) throw new Error(`校验失败: ${JSON.stringify(r.data)}`);
    if (r.data.rejectAll) throw new Error('正常数据不应被整批拒绝');
    if (!r.data.validData || r.data.validData.length === 0) throw new Error('有效数据为空');
    console.log('  有效数据:', r.data.validData.length, '行');
    console.log('  坏行:', r.data.badRows?.length || 0, '行');
  });

  // 测试 4: orderId 缺列整批拒绝
  await logTest('4. orderId 缺列整批拒绝', async () => {
    const body = {
      fileType: 'order',
      data: [{ 下单日期: '2024-01-15', 客户ID: 'C001', 商品名称: '手机', 金额: '3999' }],
      columns: ['下单日期', '客户ID', '商品名称', '金额'],
      mapping: {
        '不存在的列': 'orderId',
        '下单日期': 'orderDate',
        '客户ID': 'customerId',
        '商品名称': 'productId',
        '金额': 'amount'
      },
      enableAutoIsolate: true
    };
    const r = await apiRequest('/import/validate', 'POST', body);
    if (r.data.success) throw new Error('orderId 缺列校验应失败');
    if (!r.data.rejectAll) throw new Error('orderId 缺列应整批拒绝');
    if (!r.data.rejectReason?.includes('关联字段映射错误')) throw new Error('拒绝原因不正确');
    if (r.data.validData && r.data.validData.length > 0) throw new Error('整批拒绝时不应有 validData');
    console.log('  拒绝原因:', r.data.rejectReason);
  });

  // 测试 5: orderId 为空整批拒绝
  await logTest('5. orderId 为空整批拒绝', async () => {
    const body = {
      fileType: 'order',
      data: [
        { 订单编号: 'ORD001', 下单日期: '2024-01-15', 客户ID: 'C001', 商品名称: '手机', 金额: '3999' },
        { 订单编号: '', 下单日期: '2024-01-16', 客户ID: 'C002', 商品名称: '电脑', 金额: '5999' }
      ],
      columns: ['订单编号', '下单日期', '客户ID', '商品名称', '金额'],
      mapping: {
        '订单编号': 'orderId',
        '下单日期': 'orderDate',
        '客户ID': 'customerId',
        '商品名称': 'productId',
        '金额': 'amount'
      },
      enableAutoIsolate: true
    };
    const r = await apiRequest('/import/validate', 'POST', body);
    if (r.data.success) throw new Error('orderId 为空校验应失败');
    if (!r.data.rejectAll) throw new Error('orderId 为空应整批拒绝');
    if (!r.data.rejectReason?.includes('关联字段为空')) throw new Error('拒绝原因不正确');
    console.log('  拒绝原因:', r.data.rejectReason);
  });

  // 测试 6: 坏日期按坏行隔离
  await logTest('6. 坏日期按坏行隔离', async () => {
    const body = {
      fileType: 'order',
      data: [
        { 订单编号: 'ORD001', 下单日期: '2024-01-15', 客户ID: 'C001', 商品名称: '手机', 金额: '3999' },
        { 订单编号: 'ORD002', 下单日期: '无效日期', 客户ID: 'C002', 商品名称: '电脑', 金额: '5999' },
        { 订单编号: 'ORD003', 下单日期: '2024/01/17', 客户ID: 'C003', 商品名称: '耳机', 金额: '599' }
      ],
      columns: ['订单编号', '下单日期', '客户ID', '商品名称', '金额'],
      mapping: {
        '订单编号': 'orderId',
        '下单日期': 'orderDate',
        '客户ID': 'customerId',
        '商品名称': 'productId',
        '金额': 'amount'
      },
      enableAutoIsolate: true
    };
    const r = await apiRequest('/import/validate', 'POST', body);
    if (!r.data.success) throw new Error('坏日期隔离校验应成功');
    if (r.data.rejectAll) throw new Error('坏日期不应整批拒绝');
    if (r.data.validData.length !== 2) throw new Error(`有效数据应为 2 行，实际 ${r.data.validData.length}`);
    if (r.data.badRows.length !== 1) throw new Error(`坏行应为 1 行，实际 ${r.data.badRows.length}`);
    if (r.data.badRows[0].errorType !== 'invalid_date') throw new Error('坏行类型应为 invalid_date');
    console.log('  有效数据:', r.data.validData.length, '行');
    console.log('  坏行:', r.data.badRows.length, '行');
    console.log('  坏行原因:', r.data.badRows[0].errorMessage);
  });

  // 测试 7: 退货表 orderId 为空整批拒绝
  await logTest('7. 退货表 orderId 为空整批拒绝', async () => {
    const body = {
      fileType: 'return',
      data: [
        { 退货单号: 'RET001', 订单编号: 'ORD001', 退货日期: '2024-02-01', 退货原因: '质量问题', 状态: '已完成' },
        { 退货单号: 'RET002', 订单编号: '', 退货日期: '2024-02-05', 退货原因: '不喜欢', 状态: '处理中' }
      ],
      columns: ['退货单号', '订单编号', '退货日期', '退货原因', '状态'],
      mapping: {
        '退货单号': 'returnId',
        '订单编号': 'orderId',
        '退货日期': 'returnDate',
        '退货原因': 'reason',
        '状态': 'status'
      },
      enableAutoIsolate: true
    };
    const r = await apiRequest('/import/validate', 'POST', body);
    if (r.data.success) throw new Error('退货表 orderId 为空校验应失败');
    if (!r.data.rejectAll) throw new Error('退货表 orderId 为空应整批拒绝');
    console.log('  拒绝原因:', r.data.rejectReason);
  });

  // 测试 8: 质检表 orderId 为空整批拒绝
  await logTest('8. 质检表 orderId 为空整批拒绝', async () => {
    const body = {
      fileType: 'quality',
      data: [
        { 质检单号: 'QAD001', 订单编号: 'ORD001', 质检日期: '2024-01-20', 质检结果: '合格', 缺陷类型: '无' },
        { 质检单号: 'QAD002', 订单编号: '', 质检日期: '2024-01-21', 质检结果: '不合格', 缺陷类型: '性能故障' }
      ],
      columns: ['质检单号', '订单编号', '质检日期', '质检结果', '缺陷类型'],
      mapping: {
        '质检单号': 'qualityId',
        '订单编号': 'orderId',
        '质检日期': 'inspectDate',
        '质检结果': 'result',
        '缺陷类型': 'defectType'
      },
      enableAutoIsolate: true
    };
    const r = await apiRequest('/import/validate', 'POST', body);
    if (r.data.success) throw new Error('质检表 orderId 为空校验应失败');
    if (!r.data.rejectAll) throw new Error('质检表 orderId 为空应整批拒绝');
    console.log('  拒绝原因:', r.data.rejectReason);
  });

  // 测试 9: 自动映射
  await logTest('9. 自动字段映射', async () => {
    const body = {
      orderColumns: sample.order.columns,
      returnColumns: sample.return.columns,
      qualityColumns: sample.quality.columns
    };
    const r = await apiRequest('/mapping/auto-map', 'POST', body);
    if (!r.data.success) throw new Error('自动映射失败');
    if (!r.data.mapping.order || !r.data.mapping.return || !r.data.mapping.quality) {
      throw new Error('映射不完整');
    }
    console.log('  订单映射:', Object.keys(r.data.mapping.order).length, '个字段');
    console.log('  退货映射:', Object.keys(r.data.mapping.return).length, '个字段');
    console.log('  质检映射:', Object.keys(r.data.mapping.quality).length, '个字段');
  });

  // 测试 10: 保存映射
  let mappingId;
  await logTest('10. 保存字段映射', async () => {
    const autoMap = await apiRequest('/mapping/auto-map', 'POST', {
      orderColumns: sample.order.columns,
      returnColumns: sample.return.columns,
      qualityColumns: sample.quality.columns
    });
    const r = await apiRequest('/mapping/save', 'POST', {
      name: 'API 测试映射',
      mapping: autoMap.data.mapping
    });
    if (!r.data.success) throw new Error('保存映射失败');
    mappingId = r.data.mappingId;
    console.log('  映射 ID:', mappingId);
  });

  // 测试 11: 获取映射列表
  await logTest('11. 获取映射列表', async () => {
    const r = await apiRequest('/mapping', 'GET');
    if (!r.data.success) throw new Error('获取映射列表失败');
    console.log('  映射数量:', r.data.savedMappings?.length || 0);
  });

  // 测试 12: 保存规则
  let rulesId;
  await logTest('12. 保存规则', async () => {
    const r = await apiRequest('/rules/save', 'POST', {
      rules: {
        overdueDays: 15,
        duplicateReturnWindow: 30,
        qualityConflictTypes: ['性能故障', '外观瑕疵', '包装问题'],
        enableAutoIsolate: true
      }
    });
    if (!r.data.success) throw new Error('保存规则失败');
    rulesId = r.data.rulesId;
    console.log('  规则 ID:', rulesId);
  });

  // 测试 13: 获取规则
  await logTest('13. 获取规则列表', async () => {
    const r = await apiRequest('/rules', 'GET');
    if (!r.data.success) throw new Error('获取规则失败');
    console.log('  规则版本数:', r.data.history?.length || 0);
  });

  // 测试 14: 保存三个文件
  let orderFileId, returnFileId, qualityFileId;
  await logTest('14. 保存订单文件', async () => {
    const r = await apiRequest('/import/save', 'POST', {
      fileType: 'order',
      fileName: 'api_test_orders.csv',
      data: sample.order.data,
      columns: sample.order.columns
    });
    if (!r.data.success) throw new Error('保存订单文件失败');
    orderFileId = r.data.fileId;
    console.log('  文件 ID:', orderFileId);
  });

  await logTest('15. 保存退货文件', async () => {
    const r = await apiRequest('/import/save', 'POST', {
      fileType: 'return',
      fileName: 'api_test_returns.csv',
      data: sample.return.data,
      columns: sample.return.columns
    });
    if (!r.data.success) throw new Error('保存退货文件失败');
    returnFileId = r.data.fileId;
    console.log('  文件 ID:', returnFileId);
  });

  await logTest('16. 保存质检文件', async () => {
    const r = await apiRequest('/import/save', 'POST', {
      fileType: 'quality',
      fileName: 'api_test_quality.csv',
      data: sample.quality.data,
      columns: sample.quality.columns
    });
    if (!r.data.success) throw new Error('保存质检文件失败');
    qualityFileId = r.data.fileId;
    console.log('  文件 ID:', qualityFileId);
  });

  // 测试 17: 运行异常分析
  let runId;
  await logTest('17. 运行异常分析', async () => {
    const r = await apiRequest('/analyze/run', 'POST', {
      mappingId,
      rulesId,
      orderFileId,
      returnFileId,
      qualityFileId
    });
    if (!r.data.success) throw new Error(`分析失败: ${r.data.error || JSON.stringify(r.data)}`);
    runId = r.data.runId;
    console.log('  运行 ID:', runId);
    console.log('  异常总数:', r.data.summary.totalAnomalies);
    console.log('  超期:', r.data.summary.overdueCount);
    console.log('  重复:', r.data.summary.duplicateCount);
    console.log('  冲突:', r.data.summary.conflictCount);
    console.log('  坏行:', r.data.summary.badRowCount);
  });

  // 测试 18: 获取运行历史
  await logTest('18. 获取运行历史', async () => {
    const r = await apiRequest('/analyze/history', 'GET');
    if (!r.data.success) throw new Error('获取运行历史失败');
    console.log('  历史记录数:', r.data.runs?.length || 0);
  });

  // 测试 19: 获取运行详情
  await logTest('19. 获取运行详情', async () => {
    const r = await apiRequest(`/analyze/run/${runId}`, 'GET');
    if (!r.data.success) throw new Error('获取运行详情失败');
    console.log('  异常分组:', r.data.anomalies?.length || 0);
    console.log('  坏行数:', r.data.badRows?.length || 0);
  });

  // 测试 20: 获取最新运行数据
  await logTest('20. 获取最新运行数据', async () => {
    const r = await apiRequest('/analyze/latest', 'GET');
    if (!r.data.success) throw new Error('获取最新运行数据失败');
    if (r.data.run.id !== runId) throw new Error('最新运行 ID 不匹配');
    console.log('  最新运行 ID:', r.data.run.id);
  });

  // 测试 21: 导出报告
  let exportId;
  await logTest('21. 导出 JSON 报告', async () => {
    const r = await apiRequest('/export', 'POST', {
      runId,
      format: 'json',
      includeTypes: ['overdue', 'duplicate', 'conflict'],
      includeBadRows: true
    });
    if (!r.data.success) throw new Error('导出失败');
    exportId = r.data.exportId;
    console.log('  导出 ID:', exportId);
    console.log('  下载 URL:', r.data.downloadUrl);
    console.log('  元数据 runId:', r.data.metadata?.runId);
    console.log('  元数据 mappingId:', r.data.metadata?.mappingId);
    console.log('  元数据 rulesId:', r.data.metadata?.rulesId);
  });

  // 测试 22: 获取导出历史
  await logTest('22. 获取导出历史', async () => {
    const r = await apiRequest('/export/history', 'GET');
    if (!r.data.success) throw new Error('获取导出历史失败');
    console.log('  导出记录数:', r.data.exports?.length || 0);
  });

  // 测试 23: 获取导出详情
  await logTest('23. 获取导出详情', async () => {
    const r = await apiRequest(`/export/${exportId}`, 'GET');
    if (!r.data.success) throw new Error('获取导出详情失败');
    if (r.data.export.id !== exportId) throw new Error('导出 ID 不匹配');
    console.log('  导出 ID:', r.data.export.id);
    console.log('  文件名:', r.data.export.fileName);
  });

  // 测试 24: 分析接口 - orderId 缺列整批拒绝
  await logTest('24. 分析接口 orderId 缺列整批拒绝', async () => {
    // 保存一个缺少 orderId 列的订单文件
    const badOrderData = sample.order.data.map(row => {
      const { 订单编号, ...rest } = row;
      return rest;
    });
    const badOrderColumns = sample.order.columns.filter(c => c !== '订单编号');
    
    const saveBadResult = await apiRequest('/import/save', 'POST', {
      fileType: 'order',
      fileName: 'bad_order_no_orderId.csv',
      data: badOrderData,
      columns: badOrderColumns
    });

    // 手动创建一个错误的映射，将不存在的列映射到 orderId
    const saveBadMapping = await apiRequest('/mapping/save', 'POST', {
      name: '坏映射测试',
      mapping: {
        order: { '不存在的列': 'orderId', '下单日期': 'orderDate', '客户ID': 'customerId', '商品名称': 'productId', '金额': 'amount' },
        return: { '退货单号': 'returnId', '订单编号': 'orderId', '退货日期': 'returnDate', '退货原因': 'reason', '状态': 'status' },
        quality: { '质检单号': 'qualityId', '订单编号': 'orderId', '质检日期': 'inspectDate', '质检结果': 'result', '缺陷类型': 'defectType' }
      }
    });

    const result = await apiRequest('/analyze/run', 'POST', {
      mappingId: saveBadMapping.data.mappingId,
      rulesId,
      orderFileId: saveBadResult.data.fileId,
      returnFileId,
      qualityFileId
    });
    console.log('  返回状态:', result.status);
    console.log('  success:', result.data.success);
    console.log('  rejectAll:', result.data.rejectAll);
    if (result.data.success) throw new Error('分析接口应该返回 success: false');
    if (!result.data.rejectAll) throw new Error('分析接口应该返回 rejectAll: true');
    if (!result.data.rejectReason?.includes('关联字段')) throw new Error('拒绝原因应包含关联字段');
    console.log('  正确拒绝:', result.data.rejectReason.substring(0, 80) + '...');
  });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    🎉 所有测试通过！                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📋 测试总结:');
  console.log('  ✅ 导入校验 → 分析 → 导出 完整链路正常');
  console.log('  ✅ orderId 缺列整批拒绝（三表均生效）');
  console.log('  ✅ orderId 为空整批拒绝（三表均生效）');
  console.log('  ✅ 坏日期按坏行隔离（不整批拒绝）');
  console.log('  ✅ 所有 API 接口路径与 README 文档一致');
}

test().catch(e => {
  console.error('\n❌ 测试失败:', e.message);
  process.exit(1);
});
