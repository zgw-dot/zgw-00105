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

async function test() {
  console.log('=== 测试 1: 健康检查 ===');
  let r = await apiRequest('/health', 'GET');
  console.log('Status:', r.status, 'Success:', r.data.success);

  console.log('\n=== 测试 2: 获取示例数据 ===');
  r = await apiRequest('/import/sample', 'GET');
  console.log('Status:', r.status, 'Success:', r.data.success);
  console.log('订单行数:', r.data.order?.data?.length);

  console.log('\n=== 测试 3: 校验正常数据 ===');
  const sample = r.data;
  const validateBody = {
    fileType: 'order',
    data: sample.order.data,
    columns: sample.order.columns,
    mapping: { 'orderId': 'orderId', 'orderDate': 'orderDate', 'customerId': 'customerId', 'productId': 'productId', 'amount': 'amount' },
    enableAutoIsolate: true
  };
  r = await apiRequest('/import/validate', 'POST', validateBody);
  console.log('Status:', r.status);
  console.log('Success:', r.data.success);
  console.log('RejectAll:', r.data.rejectAll);
  console.log('ValidData:', r.data.validData?.length);
  console.log('BadRows:', r.data.badRows?.length);

  console.log('\n=== 测试 4: orderId 缺列整批拒绝 ===');
  const badBody = {
    fileType: 'order',
    data: [{ orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 }],
    columns: ['orderDate', 'customerId', 'productId', 'amount'],
    mapping: { '不存在的列': 'orderId', 'orderDate': 'orderDate', 'customerId': 'customerId', 'productId': 'productId', 'amount': 'amount' },
    enableAutoIsolate: true
  };
  r = await apiRequest('/import/validate', 'POST', badBody);
  console.log('Status:', r.status);
  console.log('Success:', r.data.success);
  console.log('RejectAll:', r.data.rejectAll);
  console.log('RejectReason:', r.data.rejectReason);

  console.log('\n=== 测试 5: 坏日期隔离 ===');
  const badDateBody = {
    fileType: 'order',
    data: [
      { orderId: 'ORD001', orderDate: '2024-01-15', customerId: 'C001', productId: '手机', amount: 3999 },
      { orderId: 'ORD002', orderDate: '无效日期', customerId: 'C002', productId: '电脑', amount: 5999 }
    ],
    columns: ['orderId', 'orderDate', 'customerId', 'productId', 'amount'],
    mapping: { 'orderId': 'orderId', 'orderDate': 'orderDate', 'customerId': 'customerId', 'productId': 'productId', 'amount': 'amount' },
    enableAutoIsolate: true
  };
  r = await apiRequest('/import/validate', 'POST', badDateBody);
  console.log('Status:', r.status);
  console.log('Success:', r.data.success);
  console.log('RejectAll:', r.data.rejectAll);
  console.log('ValidData:', r.data.validData?.length);
  console.log('BadRows:', r.data.badRows?.length);
  if (r.data.badRows?.[0]) {
    console.log('BadRow error:', r.data.badRows[0].errorMessage);
  }
}

test().catch(console.error);
