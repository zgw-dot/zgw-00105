import { Router, Request, Response } from 'express';
import { saveRules, getRulesVersions, getRules } from '../services/storage';
import type { AnalysisRules } from '../../shared';

const router = Router();

const DEFAULT_RULES: AnalysisRules = {
  overdueDays: 15,
  duplicateReturnWindow: 30,
  qualityConflictTypes: ['性能故障', '外观瑕疵', '包装问题'],
  enableAutoIsolate: true,
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const versions = await getRulesVersions();
    const currentRules = versions.length > 0 ? versions[0].rules : DEFAULT_RULES;

    res.json({
      success: true,
      currentRules,
      history: versions,
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ success: false, error: '获取规则失败' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const version = await getRules(id);

    if (!version) {
      return res.status(404).json({ success: false, error: '规则版本不存在' });
    }

    res.json({
      success: true,
      rules: version.rules,
      createdAt: version.createdAt,
    });
  } catch (error) {
    console.error('Get rules version error:', error);
    res.status(500).json({ success: false, error: '获取规则失败' });
  }
});

router.post('/save', async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;

    if (!rules) {
      return res.status(400).json({ success: false, error: '缺少规则参数' });
    }

    if (typeof rules.overdueDays !== 'number' || rules.overdueDays <= 0) {
      return res.status(400).json({ success: false, error: '超期天数必须为正整数' });
    }

    if (typeof rules.duplicateReturnWindow !== 'number' || rules.duplicateReturnWindow <= 0) {
      return res.status(400).json({ success: false, error: '重复退货窗口必须为正整数' });
    }

    if (!Array.isArray(rules.qualityConflictTypes) || rules.qualityConflictTypes.length === 0) {
      return res.status(400).json({ success: false, error: '质检冲突类型不能为空' });
    }

    const rulesId = await saveRules(rules);

    res.json({
      success: true,
      rulesId,
    });
  } catch (error) {
    console.error('Save rules error:', error);
    res.status(500).json({ success: false, error: '保存规则失败' });
  }
});

router.get('/default', async (req: Request, res: Response) => {
  res.json({
    success: true,
    rules: DEFAULT_RULES,
  });
});

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;
    const errors: string[] = [];

    if (!rules) {
      return res.json({ success: false, errors: ['规则参数不能为空'] });
    }

    if (typeof rules.overdueDays !== 'number') {
      errors.push('超期天数必须为数字');
    } else if (rules.overdueDays <= 0) {
      errors.push('超期天数必须大于0');
    } else if (rules.overdueDays > 365) {
      errors.push('超期天数不能超过365天');
    }

    if (typeof rules.duplicateReturnWindow !== 'number') {
      errors.push('重复退货窗口必须为数字');
    } else if (rules.duplicateReturnWindow <= 0) {
      errors.push('重复退货窗口必须大于0');
    } else if (rules.duplicateReturnWindow > 365) {
      errors.push('重复退货窗口不能超过365天');
    }

    if (!Array.isArray(rules.qualityConflictTypes)) {
      errors.push('质检冲突类型必须为数组');
    } else if (rules.qualityConflictTypes.length === 0) {
      errors.push('质检冲突类型不能为空');
    }

    res.json({
      success: errors.length === 0,
      errors,
    });
  } catch (error) {
    console.error('Validate rules error:', error);
    res.status(500).json({ success: false, error: '规则校验失败' });
  }
});

export default router;
