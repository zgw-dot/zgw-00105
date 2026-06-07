import {
  validateStructure,
  validateRowData,
  REQUIRED_FIELDS,
  JOIN_FIELDS,
} from '../api/services/validation';
import type { FileType } from '../shared';

const log = (msg: string) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`);
const pass = (msg: string) => console.log(`✅ PASS: ${msg}`);
const fail = (msg: string) => console.log(`❌ FAIL: ${msg}`);
const info = (msg: string) => console.log(`ℹ️  ${msg}`);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

const runTest = async (name: string, testFn: () => Promise<boolean> | boolean) => {
  try {
    const passed = await testFn();
    results.push({ name, passed });
    if (passed) pass(name);
    else fail(name);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    fail(`${name} - ${error.message}`);
  }
};

log('测试 1: 缺少必需列 - 订单表没有 orderId 列');
await runTest('订单表缺少 orderId 列，应该整批拒绝', () => {
  const columns = ['orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    '不存在的列': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = validateStructure('order', columns, mapping);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段映射错误') && !result.valid) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, valid=${result.valid}, reason=${result.rejectReason}`);
  return false;
});

log('测试 2: 缺少必需列 - 退货表没有 orderId 列');
await runTest('退货表缺少 orderId 列，应该整批拒绝', () => {
  const columns = ['returnId', 'returnDate', 'reason', 'status'];
  const mapping = {
    'returnId': 'returnId',
    '不存在的列': 'orderId',
    'returnDate': 'returnDate',
    'reason': 'reason',
    'status': 'status',
  };
  
  const result = validateStructure('return', columns, mapping);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段映射错误') && !result.valid) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, valid=${result.valid}, reason=${result.rejectReason}`);
  return false;
});

log('测试 3: 缺少必需列 - 质检表没有 orderId 列');
await runTest('质检表缺少 orderId 列，应该整批拒绝', () => {
  const columns = ['qualityId', 'inspectDate', 'result', 'defectType'];
  const mapping = {
    'qualityId': 'qualityId',
    '不存在的列': 'orderId',
    'inspectDate': 'inspectDate',
    'result': 'result',
    'defectType': 'defectType',
  };
  
  const result = validateStructure('quality', columns, mapping);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段映射错误') && !result.valid) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, valid=${result.valid}, reason=${result.rejectReason}`);
  return false;
});

log('测试 4: 映射指向不存在的列');
await runTest('映射指向不存在的列，应该整批拒绝', () => {
  const columns = ['orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    '订单编号': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = validateStructure('order', columns, mapping);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段映射错误') && !result.valid) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, valid=${result.valid}, reason=${result.rejectReason}`);
  return false;
});

log('测试 5: 行级校验 - 所有行 orderId 为空');
await runTest('所有行 orderId 为空，应该整批拒绝', () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderId: '', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: '   ', orderDate: '2024-01-16', customerId: 'C002', productId: '电脑', amount: 5999 },
    { orderId: null, orderDate: '2024-01-17', customerId: 'C003', productId: '耳机', amount: 599 },
  ];
  
  const result = validateRowData('order', data, mapping, true, columns);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段为空') && result.validData.length === 0) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, validData=${result.validData.length}, reason=${result.rejectReason}`);
  return false;
});

log('测试 6: 行级校验 - 单行 orderId 为空');
await runTest('单行 orderId 为空，应该整批拒绝', () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: '', orderDate: '2024-01-16', customerId: 'C002', productId: '电脑', amount: 5999 },
    { orderId: 'ORD003', orderDate: '2024-01-17', customerId: 'C003', productId: '耳机', amount: 599 },
  ];
  
  const result = validateRowData('order', data, mapping, true, columns);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段为空') && result.validData.length === 0) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, validData=${result.validData.length}, reason=${result.rejectReason}`);
  return false;
});

log('测试 7: 行级校验 - 退货表单行 orderId 为空');
await runTest('退货表单行 orderId 为空，应该整批拒绝', () => {
  const columns = ['returnId', 'orderId', 'returnDate', 'reason', 'status'];
  const mapping = {
    'returnId': 'returnId',
    'orderId': 'orderId',
    'returnDate': 'returnDate',
    'reason': 'reason',
    'status': 'status',
  };
  const data = [
    { returnId: 'RET001', orderId: 'ORD001', returnDate: '2024-02-01', reason: '质量问题', status: '已完成' },
    { returnId: 'RET002', orderId: '', returnDate: '2024-02-05', reason: '不喜欢', status: '处理中' },
  ];
  
  const result = validateRowData('return', data, mapping, true, columns);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段为空') && result.validData.length === 0) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, validData=${result.validData.length}, reason=${result.rejectReason}`);
  return false;
});

log('测试 8: 坏日期隔离 - 日期格式错误应该按坏行隔离，不整批拒绝');
await runTest('日期格式错误应该按坏行隔离，不整批拒绝', () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: 'ORD002', orderDate: '无效日期', customerId: 'C002', productId: '电脑', amount: 5999 },
    { orderId: 'ORD003', orderDate: '2024/01/17', customerId: 'C003', productId: '耳机', amount: 599 },
  ];
  
  const result = validateRowData('order', data, mapping, true, columns);
  
  if (!result.rejectAll && result.validData.length === 2 && result.badRows.length === 1) {
    info(`有效数据: ${result.validData.length} 行, 坏行: ${result.badRows.length} 行`);
    info(`坏行原因: ${result.badRows[0].errorMessage}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, validData=${result.validData.length}, badRows=${result.badRows.length}`);
  return false;
});

log('测试 9: 正常数据 - 所有校验应该通过');
await runTest('正常数据应该通过校验，不产生坏行', () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: 'ORD002', orderDate: '2024-01-16', customerId: 'C002', productId: '电脑', amount: 5999 },
    { orderId: 'ORD003', orderDate: '2024/01/17', customerId: 'C003', productId: '耳机', amount: 599 },
  ];
  
  const result = validateRowData('order', data, mapping, true, columns);
  
  if (!result.rejectAll && result.validData.length === 3 && result.badRows.length === 0) {
    info(`有效数据: ${result.validData.length} 行, 坏行: ${result.badRows.length} 行`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, validData=${result.validData.length}, badRows=${result.badRows.length}`);
  return false;
});

log('测试 10: 结构校验 - 正常列和映射应该通过');
await runTest('正常列和映射应该通过结构校验', () => {
  const columns = ['订单编号', '下单日期', '客户ID', '商品名称', '金额'];
  const mapping = {
    '订单编号': 'orderId',
    '下单日期': 'orderDate',
    '客户ID': 'customerId',
    '商品名称': 'productId',
    '金额': 'amount',
  };
  
  const result = validateStructure('order', columns, mapping);
  
  if (!result.rejectAll && result.valid && result.errors.length === 0) {
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, valid=${result.valid}, errors=${result.errors.length}`);
  return false;
});

log('测试 11: 重复订单号 - 应该按坏行隔离，不整批拒绝');
await runTest('重复订单号应该按坏行隔离，不整批拒绝', () => {
  const columns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: 'ORD001', orderDate: '2024-01-16', customerId: 'C002', productId: '电脑', amount: 5999 },
    { orderId: 'ORD003', orderDate: '2024-01-17', customerId: 'C003', productId: '耳机', amount: 599 },
  ];
  
  const result = validateRowData('order', data, mapping, true, columns);
  
  if (!result.rejectAll && result.validData.length === 2 && result.badRows.length === 1 && result.badRows[0].errorType === 'duplicate_order') {
    info(`有效数据: ${result.validData.length} 行, 坏行: ${result.badRows.length} 行`);
    info(`坏行原因: ${result.badRows[0].errorMessage}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, validData=${result.validData.length}, badRows=${result.badRows.length}`);
  return false;
});

log('测试 12: validateRowData 未传 columns 参数 - 兼容模式');
await runTest('未传 columns 参数时也能正确校验 orderId 为空', () => {
  const mapping = {
    'orderId': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
    { orderId: '', orderDate: '2024-01-16', customerId: 'C002', productId: '电脑', amount: 5999 },
  ];
  
  const result = validateRowData('order', data, mapping, true);
  
  if (result.rejectAll && result.rejectReason?.includes('关联字段为空')) {
    info(`拒绝原因: ${result.rejectReason}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, reason=${result.rejectReason}`);
  return false;
});

log('测试 13: 非关联字段缺失 - 应该只返回错误，不整批拒绝');
await runTest('非关联字段（如 orderDate）映射到不存在的列，不整批拒绝', () => {
  const columns = ['orderId', 'customerId', 'productId', 'amount'];
  const mapping = {
    'orderId': 'orderId',
    '不存在的日期列': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  
  const result = validateStructure('order', columns, mapping);
  
  if (!result.rejectAll && !result.valid && result.errors.length === 1 && result.errors[0].column === '不存在的日期列') {
    info(`错误信息: ${result.errors[0].errorMessage}`);
    return true;
  }
  info(`实际结果: rejectAll=${result.rejectAll}, valid=${result.valid}, errors=${result.errors.length}`);
  return false;
});

log('测试 14: 三表完整校验 - 订单/退货/质检表正常数据');
await runTest('三表完整校验 - 正常数据全部通过', () => {
  const orderColumns = ['orderId', 'orderDate', 'customerId', 'productId', 'amount'];
  const returnColumns = ['returnId', 'orderId', 'returnDate', 'reason', 'status'];
  const qualityColumns = ['qualityId', 'orderId', 'inspectDate', 'result', 'defectType'];
  
  const orderMapping = { 'orderId': 'orderId', 'orderDate': 'orderDate', 'customerId': 'customerId', 'productId': 'productId', 'amount': 'amount' };
  const returnMapping = { 'returnId': 'returnId', 'orderId': 'orderId', 'returnDate': 'returnDate', 'reason': 'reason', 'status': 'status' };
  const qualityMapping = { 'qualityId': 'qualityId', 'orderId': 'orderId', 'inspectDate': 'inspectDate', 'result': 'result', 'defectType': 'defectType' };
  
  const orderData = [{ orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 }];
  const returnData = [{ returnId: 'RET001', orderId: 'ORD001', returnDate: '2024-02-01', reason: '质量问题', status: '已完成' }];
  const qualityData = [{ qualityId: 'QAD001', orderId: 'ORD001', inspectDate: '2024-01-20', result: '合格', defectType: '无' }];
  
  const orderResult = validateRowData('order', orderData, orderMapping, true, orderColumns);
  const returnResult = validateRowData('return', returnData, returnMapping, true, returnColumns);
  const qualityResult = validateRowData('quality', qualityData, qualityMapping, true, qualityColumns);
  
  if (!orderResult.rejectAll && !returnResult.rejectAll && !qualityResult.rejectAll &&
      orderResult.validData.length === 1 && returnResult.validData.length === 1 && qualityResult.validData.length === 1) {
    return true;
  }
  info(`订单: rejectAll=${orderResult.rejectAll}, valid=${orderResult.validData.length}`);
  info(`退货: rejectAll=${returnResult.rejectAll}, valid=${returnResult.validData.length}`);
  info(`质检: rejectAll=${qualityResult.rejectAll}, valid=${qualityResult.validData.length}`);
  return false;
});

log('测试 15: 校验结果不应产生 validData - 整批拒绝时 validData 必须为空');
await runTest('整批拒绝时 validData 必须为空', () => {
  const columns = ['orderDate', 'customerId', 'productId', 'amount'];
  const mapping = {
    '不存在的列': 'orderId',
    'orderDate': 'orderDate',
    'customerId': 'customerId',
    'productId': 'productId',
    'amount': 'amount',
  };
  const data = [
    { orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
  ];
  
  const result = validateRowData('order', data, mapping, true, columns);
  
  if (result.rejectAll && result.validData.length === 0 && result.badRows.length === 0) {
    info(`validData 长度: ${result.validData.length}, badRows 长度: ${result.badRows.length}`);
    return true;
  }
  info(`实际结果: validData=${result.validData.length}, badRows=${result.badRows.length}`);
  return false;
});

log('\n' + '='.repeat(60));
console.log('\n📊 测试结果汇总:');
const passed = results.filter(r => r.passed).length;
const total = results.length;
console.log(`通过: ${passed}/${total}`);

if (passed === total) {
  console.log('\n🎉 所有测试通过！');
} else {
  console.log('\n❌ 部分测试失败:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}`);
    if (r.error) console.log(`    错误: ${r.error}`);
  });
  process.exit(1);
}
