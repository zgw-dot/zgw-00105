import { validateRowData } from '../api/services/validation.js';

const columns = ['下单日期', '客户ID', '商品名称', '金额'];
const data = [
  { 下单日期: '2024-01-15', 客户ID: 'C001', 商品名称: '手机', 金额: '3999' },
];
const mapping = {
  '不存在的列': 'orderId',
  '下单日期': 'orderDate',
  '客户ID': 'customerId',
  '商品名称': 'productId',
  '金额': 'amount'
};

console.log('测试 validateRowData:');
console.log('columns:', columns);
console.log('mapping:', mapping);

const result = validateRowData('order', data, mapping, true, columns);
console.log('\nResult:');
console.log('success:', result.valid);
console.log('rejectAll:', result.rejectAll);
console.log('rejectReason:', result.rejectReason);
console.log('validData:', result.validData?.length);
console.log('badRows:', result.badRows?.length);
