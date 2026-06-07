import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import {
  getRun,
  getAnomalies,
  getBadRows,
  getExports,
  getExport,
  getExportFilePath,
} from '../services/storage';
import { generateExport } from '../services/export';
import type { ExportFormat, AnomalyType } from '../../shared';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { runId, format, includeTypes, includeBadRows } = req.body;

    if (!runId || !format) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    if (!['csv', 'html', 'json'].includes(format)) {
      return res.status(400).json({ success: false, error: '无效的导出格式' });
    }

    const [run, anomalies, badRows] = await Promise.all([
      getRun(runId),
      getAnomalies(runId),
      getBadRows(runId),
    ]);

    if (!run) {
      return res.status(404).json({ success: false, error: '运行记录不存在' });
    }

    const typesToInclude: AnomalyType[] = includeTypes || ['overdue', 'duplicate', 'conflict'];

    const record = await generateExport(
      {
        runId,
        mappingId: run.mappingId,
        rulesId: run.rulesId,
        anomalies: anomalies || [],
        badRows: badRows || [],
        includeTypes: typesToInclude,
        includeBadRows: includeBadRows ?? true,
      },
      format as ExportFormat
    );

    res.json({
      success: true,
      exportId: record.id,
      downloadUrl: record.downloadUrl,
      metadata: record.metadata,
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: '导出失败' });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const exports = await getExports();
    res.json({
      success: true,
      exports,
    });
  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({ success: false, error: '获取导出历史失败' });
  }
});

router.get('/:exportId', async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    const record = await getExport(exportId);

    if (!record) {
      return res.status(404).json({ success: false, error: '导出记录不存在' });
    }

    res.json({
      success: true,
      export: record,
    });
  } catch (error) {
    console.error('Get export error:', error);
    res.status(500).json({ success: false, error: '获取导出记录失败' });
  }
});

router.get('/download/:fileName', async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const filePath = getExportFilePath(fileName);

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      csv: 'text/csv; charset=utf-8',
      html: 'text/html; charset=utf-8',
      json: 'application/json; charset=utf-8',
    };

    res.setHeader('Content-Type', contentTypeMap[ext || ''] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileContent = await fs.readFile(filePath);
    res.send(fileContent);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: '下载失败' });
  }
});

export default router;
