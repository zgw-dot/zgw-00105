import { Router, Request, Response } from 'express';
import {
  getRawFile,
  getFieldMapping,
  getRules,
  saveRunHistory,
  getRunHistory,
  getRun,
  saveAnomalies,
  saveBadRows,
  getAnomalies,
  getBadRows,
} from '../services/storage';
import { detectAnomalies, compareRuns } from '../services/anomalyDetector';
import { validateAndMapData, validateRowData } from '../services/validation';
import { generateId, now } from '../utils/common';
import type { RunHistory, AnalyzeResult, BadRow } from '../../shared';

const router = Router();

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { mappingId, rulesId, orderFileId, returnFileId, qualityFileId } = req.body;

    if (!mappingId || !rulesId || !orderFileId || !returnFileId || !qualityFileId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const [orderData, returnData, qualityData, mapping, rulesVersion] = await Promise.all([
      getRawFile(orderFileId),
      getRawFile(returnFileId),
      getRawFile(qualityFileId),
      getFieldMapping(mappingId),
      getRules(rulesId),
    ]);

    if (!orderData || !returnData || !qualityData) {
      return res.status(404).json({ success: false, error: '数据文件不存在' });
    }

    if (!mapping) {
      return res.status(404).json({ success: false, error: '映射方案不存在' });
    }

    if (!rulesVersion) {
      return res.status(404).json({ success: false, error: '规则版本不存在' });
    }

    const orderValidation = validateRowData('order', orderData.data, mapping.mapping.order, true, orderData.columns);
    if (orderValidation.rejectAll) {
      return res.status(400).json({
        success: false,
        error: `订单表校验失败: ${orderValidation.rejectReason}`,
        rejectAll: true,
        rejectReason: orderValidation.rejectReason,
        errors: orderValidation.errors,
      });
    }

    const returnValidation = validateRowData('return', returnData.data, mapping.mapping.return, true, returnData.columns);
    if (returnValidation.rejectAll) {
      return res.status(400).json({
        success: false,
        error: `退货表校验失败: ${returnValidation.rejectReason}`,
        rejectAll: true,
        rejectReason: returnValidation.rejectReason,
        errors: returnValidation.errors,
      });
    }

    const qualityValidation = validateRowData('quality', qualityData.data, mapping.mapping.quality, true, qualityData.columns);
    if (qualityValidation.rejectAll) {
      return res.status(400).json({
        success: false,
        error: `质检表校验失败: ${qualityValidation.rejectReason}`,
        rejectAll: true,
        rejectReason: qualityValidation.rejectReason,
        errors: qualityValidation.errors,
      });
    }

    const mappedOrders = validateAndMapData('order', orderValidation.validData, mapping.mapping.order);
    const mappedReturns = validateAndMapData('return', returnValidation.validData, mapping.mapping.return);
    const mappedQuality = validateAndMapData('quality', qualityValidation.validData, mapping.mapping.quality);

    const allBadRows: BadRow[] = [...orderValidation.badRows, ...returnValidation.badRows, ...qualityValidation.badRows];

    const { groups, summary } = detectAnomalies(
      rulesVersion.rules,
      mappedOrders.mappedData,
      mappedReturns.mappedData,
      mappedQuality.mappedData
    );

    summary.badRowCount = allBadRows.length;

    const runId = generateId();

    const runHistory: RunHistory = {
      id: runId,
      mappingId,
      rulesId,
      files: {
        order: {
          fileId: orderFileId,
          fileName: orderData.meta.fileName,
          rowCount: orderData.data.length,
        },
        return: {
          fileId: returnFileId,
          fileName: returnData.meta.fileName,
          rowCount: returnData.data.length,
        },
        quality: {
          fileId: qualityFileId,
          fileName: qualityData.meta.fileName,
          rowCount: qualityData.data.length,
        },
      },
      summary,
      status: allBadRows.length > 0 ? 'partial' : 'completed',
      createdAt: now(),
      completedAt: now(),
    };

    await Promise.all([
      saveRunHistory(runHistory),
      saveAnomalies(runId, groups),
      saveBadRows(runId, allBadRows),
    ]);

    const result: AnalyzeResult = {
      success: true,
      runId,
      summary,
      anomalies: groups,
      badRows: allBadRows,
    };

    res.json(result);
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ success: false, error: '分析执行失败' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const runs = await getRunHistory();
    res.json({
      success: true,
      runs,
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: '获取运行历史失败' });
  }
});

router.get('/run/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const [run, anomalies, badRows] = await Promise.all([
      getRun(runId),
      getAnomalies(runId),
      getBadRows(runId),
    ]);

    if (!run) {
      return res.status(404).json({ success: false, error: '运行记录不存在' });
    }

    res.json({
      success: true,
      run,
      anomalies: anomalies || [],
      badRows: badRows || [],
    });
  } catch (error) {
    console.error('Get run error:', error);
    res.status(500).json({ success: false, error: '获取运行详情失败' });
  }
});

router.get('/compare/:runId1/:runId2', async (req: Request, res: Response) => {
  try {
    const { runId1, runId2 } = req.params;

    const [run1, run2] = await Promise.all([
      getRun(runId1),
      getRun(runId2),
    ]);

    if (!run1 || !run2) {
      return res.status(404).json({ success: false, error: '运行记录不存在' });
    }

    const comparison = compareRuns(run1.summary, run2.summary);

    res.json({
      success: true,
      run1,
      run2,
      diff: comparison.diff,
    });
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ success: false, error: '对比分析失败' });
  }
});

router.get('/latest', async (req: Request, res: Response) => {
  try {
    const runs = await getRunHistory();
    if (runs.length === 0) {
      return res.json({
        success: true,
        run: null,
        anomalies: [],
        badRows: [],
        previousRun: null,
        comparison: null,
      });
    }

    const latestRun = runs[0];
    const previousRun = runs.length > 1 ? runs[1] : null;

    const [anomalies, badRows] = await Promise.all([
      getAnomalies(latestRun.id),
      getBadRows(latestRun.id),
    ]);

    let comparison = null;
    if (previousRun) {
      comparison = compareRuns(latestRun.summary, previousRun.summary);
    }

    res.json({
      success: true,
      run: latestRun,
      anomalies: anomalies || [],
      badRows: badRows || [],
      previousRun,
      comparison: comparison?.diff || null,
    });
  } catch (error) {
    console.error('Get latest error:', error);
    res.status(500).json({ success: false, error: '获取最新运行数据失败' });
  }
});

export default router;
