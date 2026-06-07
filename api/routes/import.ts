import { Router, Request, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import {
  saveRawFile,
  getRawFile,
  getSampleData,
} from '../services/storage';
import { generateSampleData, getSampleDataAll } from '../services/sampleData';
import {
  validateRowData,
  checkRejectAllCondition,
} from '../services/validation';
import type { FileType, UploadResponse, ValidationError } from '../../shared';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { fileType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: '未上传文件' });
      }

      if (!['order', 'return', 'quality'].includes(fileType)) {
        return res.status(400).json({ success: false, error: '无效的文件类型' });
      }

      const content = file.buffer.toString('utf-8');
      const result = Papa.parse<any>(content, {
        header: true,
        skipEmptyLines: true,
      });

      const fields = result.meta.fields || [];
      const columns = fields.map(f => f.trim());
      const data = result.data;

      if (columns.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'CSV 文件格式错误，无法识别列名',
        });
      }

      const preview = data.slice(0, 10);

      res.json({
        success: true,
        fileType,
        fileName: file.originalname,
        columns,
        preview,
        rowCount: data.length,
        data,
      } as UploadResponse & { data: any[] });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ success: false, error: '文件上传失败' });
    }
  }
);

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { fileType, data, mapping, enableAutoIsolate } = req.body;

    if (!fileType || !data || !mapping) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const validation = validateRowData(
      fileType as FileType,
      data,
      mapping,
      enableAutoIsolate ?? true
    );

    const rejectCheck = checkRejectAllCondition(data.length, validation.badRows.length);

    if (rejectCheck.rejectAll) {
      return res.json({
        success: false,
        rejectAll: true,
        rejectReason: rejectCheck.reason,
        errors: validation.errors,
        badRowCount: validation.badRows.length,
      });
    }

    res.json({
      success: true,
      rejectAll: false,
      errors: validation.errors,
      badRows: validation.badRows,
      validData: validation.validData,
      badRowCount: validation.badRows.length,
      validRowCount: validation.validData.length,
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, error: '数据校验失败' });
  }
});

router.post('/save', async (req: Request, res: Response) => {
  try {
    const { fileType, fileName, data, columns } = req.body;

    if (!fileType || !data || !columns) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const fileId = await saveRawFile(
      fileType as FileType,
      fileName,
      data,
      columns
    );

    res.json({
      success: true,
      fileId,
      fileType,
      fileName,
      columns,
      rowCount: data.length,
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, error: '文件保存失败' });
  }
});

router.get('/sample', async (req: Request, res: Response) => {
  try {
    let orderData = await getSampleData('order');
    let returnData = await getSampleData('return');
    let qualityData = await getSampleData('quality');

    if (!orderData || !returnData || !qualityData) {
      await generateSampleData();
      orderData = await getSampleData('order');
      returnData = await getSampleData('return');
      qualityData = await getSampleData('quality');
    }

    res.json({
      success: true,
      order: {
        columns: orderData!.columns,
        data: orderData!.data,
        preview: orderData!.data.slice(0, 10),
      },
      return: {
        columns: returnData!.columns,
        data: returnData!.data,
        preview: returnData!.data.slice(0, 10),
      },
      quality: {
        columns: qualityData!.columns,
        data: qualityData!.data,
        preview: qualityData!.data.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Sample data error:', error);
    res.status(500).json({ success: false, error: '获取示例数据失败' });
  }
});

router.get('/raw/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const result = await getRawFile(fileId);

    if (!result) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    res.json({
      success: true,
      data: result.data,
      columns: result.columns,
      meta: result.meta,
    });
  } catch (error) {
    console.error('Get raw file error:', error);
    res.status(500).json({ success: false, error: '获取文件失败' });
  }
});

export default router;
