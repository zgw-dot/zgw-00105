import { Router, Request, Response } from 'express';
import {
  saveFieldMapping,
  getFieldMappings,
  getFieldMapping,
} from '../services/storage';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const mappings = await getFieldMappings();
    res.json({
      success: true,
      savedMappings: mappings,
      currentMapping: mappings[0] || null,
    });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ success: false, error: '获取字段映射失败' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mapping = await getFieldMapping(id);

    if (!mapping) {
      return res.status(404).json({ success: false, error: '映射方案不存在' });
    }

    res.json({
      success: true,
      mapping,
    });
  } catch (error) {
    console.error('Get mapping error:', error);
    res.status(500).json({ success: false, error: '获取字段映射失败' });
  }
});

router.post('/save', async (req: Request, res: Response) => {
  try {
    const { name, mapping } = req.body;

    if (!name || !mapping) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    if (!mapping.order || !mapping.return || !mapping.quality) {
      return res.status(400).json({ success: false, error: '映射配置不完整' });
    }

    const mappingId = await saveFieldMapping(name, mapping);

    res.json({
      success: true,
      mappingId,
    });
  } catch (error) {
    console.error('Save mapping error:', error);
    res.status(500).json({ success: false, error: '保存字段映射失败' });
  }
});

router.post('/auto-map', async (req: Request, res: Response) => {
  try {
    const { orderColumns, returnColumns, qualityColumns } = req.body;

    const autoMapping = {
      order: {} as Record<string, string>,
      return: {} as Record<string, string>,
      quality: {} as Record<string, string>,
    };

    const orderFieldMap: Record<string, string> = {
      '订单编号': 'orderId',
      '订单号': 'orderId',
      'order_id': 'orderId',
      'orderId': 'orderId',
      '下单日期': 'orderDate',
      '订单日期': 'orderDate',
      'order_date': 'orderDate',
      'orderDate': 'orderDate',
      '客户ID': 'customerId',
      '客户编号': 'customerId',
      'customer_id': 'customerId',
      'customerId': 'customerId',
      '商品名称': 'productId',
      '商品ID': 'productId',
      'product_id': 'productId',
      'productId': 'productId',
      '金额': 'amount',
      '订单金额': 'amount',
      'price': 'amount',
      'amount': 'amount',
    };

    const returnFieldMap: Record<string, string> = {
      '退货单号': 'returnId',
      '退货编号': 'returnId',
      'return_id': 'returnId',
      'returnId': 'returnId',
      '订单编号': 'orderId',
      '订单号': 'orderId',
      'order_id': 'orderId',
      'orderId': 'orderId',
      '退货日期': 'returnDate',
      'return_date': 'returnDate',
      'returnDate': 'returnDate',
      '退货原因': 'reason',
      '原因': 'reason',
      'reason': 'reason',
      '状态': 'status',
      '退货状态': 'status',
      'status': 'status',
    };

    const qualityFieldMap: Record<string, string> = {
      '质检单号': 'qualityId',
      '质检编号': 'qualityId',
      'quality_id': 'qualityId',
      'qualityId': 'qualityId',
      '订单编号': 'orderId',
      '订单号': 'orderId',
      'order_id': 'orderId',
      'orderId': 'orderId',
      '质检日期': 'inspectDate',
      '检验日期': 'inspectDate',
      'inspect_date': 'inspectDate',
      'inspectDate': 'inspectDate',
      '质检结果': 'result',
      '检验结果': 'result',
      'result': 'result',
      '缺陷类型': 'defectType',
      '问题类型': 'defectType',
      'defect_type': 'defectType',
      'defectType': 'defectType',
    };

    for (const col of orderColumns || []) {
      const mapped = orderFieldMap[col] || orderFieldMap[col.toLowerCase()];
      if (mapped) {
        autoMapping.order[col] = mapped;
      }
    }

    for (const col of returnColumns || []) {
      const mapped = returnFieldMap[col] || returnFieldMap[col.toLowerCase()];
      if (mapped) {
        autoMapping.return[col] = mapped;
      }
    }

    for (const col of qualityColumns || []) {
      const mapped = qualityFieldMap[col] || qualityFieldMap[col.toLowerCase()];
      if (mapped) {
        autoMapping.quality[col] = mapped;
      }
    }

    res.json({
      success: true,
      mapping: autoMapping,
    });
  } catch (error) {
    console.error('Auto map error:', error);
    res.status(500).json({ success: false, error: '自动映射失败' });
  }
});

export default router;
