import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Play, ArrowRight, Settings, AlertTriangle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useAppStore } from '../store';
import { rulesApi, analyzeApi, importApi } from '../utils/api';
import type { AnalysisRules, AnomalyType } from '../../shared';
import { ANOMALY_TYPE_COLORS, ANOMALY_TYPE_LABELS, ERROR_TYPE_LABELS } from '../../shared';

const PRESET_DEFECT_TYPES = ['性能故障', '外观瑕疵', '包装问题', '功能异常', '配件缺失', '描述不符'];

export default function RulesPage() {
  const navigate = useNavigate();
  const { 
    uploadedFiles, 
    currentMappingId, 
    currentRules, 
    setCurrentRules,
    setCurrentRun,
    setCurrentAnomalies,
    setCurrentBadRows,
    setRunHistory,
    setPreviousRun,
    setComparison,
    setLoading, 
    showNotification 
  } = useAppStore();
  
  const [rules, setRules] = useState<AnalysisRules>({
    overdueDays: 15,
    duplicateReturnWindow: 30,
    qualityConflictTypes: ['性能故障', '外观瑕疵', '包装问题'],
    enableAutoIsolate: true,
  });
  const [rulesVersions, setRulesVersions] = useState<{ id: string; rules: AnalysisRules; createdAt: string }[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentRulesId, setCurrentRulesId] = useState<string>('');

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (currentRules) {
      setRules(currentRules);
    }
  }, [currentRules]);

  const loadRules = async () => {
    try {
      const result = await rulesApi.getRules();
      if (result.success) {
        setRules(result.currentRules);
        setCurrentRules(result.currentRules);
        setRulesVersions(result.history);
      }
    } catch (error) {
      console.error('加载规则失败:', error);
    }
  };

  const handleRuleChange = <K extends keyof AnalysisRules>(key: K, value: AnalysisRules[K]) => {
    setRules((prev) => ({ ...prev, [key]: value }));
    setValidationErrors([]);
  };

  const handleDefectTypeToggle = (type: string) => {
    setRules((prev) => ({
      ...prev,
      qualityConflictTypes: prev.qualityConflictTypes.includes(type)
        ? prev.qualityConflictTypes.filter((t) => t !== type)
        : [...prev.qualityConflictTypes, type],
    }));
  };

  const validateRules = async (): Promise<boolean> => {
    try {
      const result = await rulesApi.validateRules({ rules });
      setValidationErrors(result.errors);
      return result.success;
    } catch (error) {
      setValidationErrors(['规则验证失败，请检查参数']);
      return false;
    }
  };

  const handleSave = async () => {
    const isValid = await validateRules();
    if (!isValid) {
      showNotification('规则配置有误，请检查', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await rulesApi.saveRules({ rules });
      if (result.success) {
        setCurrentRulesId(result.rulesId);
        setCurrentRules(rules);
        showNotification('规则保存成功', 'success');
        loadRules();
      }
    } catch (error) {
      showNotification('保存失败: ' + (error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!currentMappingId) {
      showNotification('请先保存字段映射', 'error');
      return;
    }

    if (!uploadedFiles.order || !uploadedFiles.return || !uploadedFiles.quality) {
      showNotification('请先上传完整的三份数据文件', 'error');
      return;
    }

    const isValid = await validateRules();
    if (!isValid) {
      showNotification('规则配置有误，请检查', 'error');
      return;
    }

    setAnalyzing(true);
    setLoading(true);

    try {
      const rulesResult = await rulesApi.saveRules({ rules });
      if (!rulesResult.success) {
        throw new Error('规则保存失败');
      }
      setCurrentRulesId(rulesResult.rulesId);

      let orderFileId = uploadedFiles.order?.fileId;
      let returnFileId = uploadedFiles.return?.fileId;
      let qualityFileId = uploadedFiles.quality?.fileId;

      if (!orderFileId && uploadedFiles.order) {
        const saveResult = await importApi.saveFile({
          fileType: 'order',
          fileName: uploadedFiles.order.fileName,
          data: uploadedFiles.order.data,
          columns: uploadedFiles.order.columns,
        });
        orderFileId = saveResult.fileId;
      }

      if (!returnFileId && uploadedFiles.return) {
        const saveResult = await importApi.saveFile({
          fileType: 'return',
          fileName: uploadedFiles.return.fileName,
          data: uploadedFiles.return.data,
          columns: uploadedFiles.return.columns,
        });
        returnFileId = saveResult.fileId;
      }

      if (!qualityFileId && uploadedFiles.quality) {
        const saveResult = await importApi.saveFile({
          fileType: 'quality',
          fileName: uploadedFiles.quality.fileName,
          data: uploadedFiles.quality.data,
          columns: uploadedFiles.quality.columns,
        });
        qualityFileId = saveResult.fileId;
      }

      if (!orderFileId || !returnFileId || !qualityFileId) {
        throw new Error('文件ID获取失败');
      }

      const result = await analyzeApi.runAnalysis({
        mappingId: currentMappingId,
        rulesId: rulesResult.rulesId,
        orderFileId,
        returnFileId,
        qualityFileId,
      });

      if (result.success) {
        setCurrentRun({
          id: result.runId,
          mappingId: currentMappingId,
          rulesId: rulesResult.rulesId,
          files: {
            order: { fileId: orderFileId, fileName: uploadedFiles.order!.fileName, rowCount: uploadedFiles.order!.rowCount },
            return: { fileId: returnFileId, fileName: uploadedFiles.return!.fileName, rowCount: uploadedFiles.return!.rowCount },
            quality: { fileId: qualityFileId, fileName: uploadedFiles.quality!.fileName, rowCount: uploadedFiles.quality!.rowCount },
          },
          summary: result.summary,
          status: result.badRows.length > 0 ? 'partial' : 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
        setCurrentAnomalies(result.anomalies);
        setCurrentBadRows(result.badRows);

        const historyResult = await analyzeApi.getHistory();
        if (historyResult.success) {
          setRunHistory(historyResult.runs);
          if (historyResult.runs.length >= 2) {
            const compareResult = await analyzeApi.compareRuns(
              historyResult.runs[0].id,
              historyResult.runs[1].id
            );
            if (compareResult.success) {
              setPreviousRun(compareResult.run2);
              setComparison(compareResult.diff);
            }
          }
        }

        showNotification('异常分析完成！', 'success');
        navigate('/');
      }
    } catch (error) {
      showNotification('分析失败: ' + (error as Error).message, 'error');
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const loadRulesVersion = (version: { id: string; rules: AnalysisRules; createdAt: string }) => {
    setRules(version.rules);
    showNotification(`已加载规则版本: ${new Date(version.createdAt).toLocaleString()}`, 'info');
  };

  const canProceed = currentMappingId && 
    uploadedFiles.order && uploadedFiles.return && uploadedFiles.quality;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">规则配置</h2>
            <p className="text-indigo-100">配置异常检测规则参数，定义超期、重复和冲突的判断标准</p>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={!canProceed || analyzing}
            className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            {analyzing ? '分析中...' : '执行分析'}
          </button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 mb-2">规则验证错误</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>• {err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {rulesVersions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">历史规则版本</h3>
          <div className="flex flex-wrap gap-3">
            {rulesVersions.slice(0, 5).map((version) => (
              <button
                key={version.id}
                onClick={() => loadRulesVersion(version)}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-sm"
              >
                <div className="font-medium text-gray-700">
                  {new Date(version.createdAt).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  超期{version.rules.overdueDays}天 / 重复窗口{version.rules.duplicateReturnWindow}天
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: ANOMALY_TYPE_COLORS.overdue }} />
              <h3 className="text-lg font-semibold text-gray-800">超期退货规则</h3>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                超期天数阈值
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={rules.overdueDays}
                  onChange={(e) => handleRuleChange('overdueDays', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={rules.overdueDays}
                    onChange={(e) => handleRuleChange('overdueDays', parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold text-lg"
                  />
                  <span className="text-gray-600">天</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                退货申请日期超过下单日期此天数，判定为超期退货
              </p>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">规则说明</p>
                  <p>退货日期 - 下单日期 {'>'} {rules.overdueDays} 天 → 标记为异常</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" style={{ color: ANOMALY_TYPE_COLORS.duplicate }} />
              <h3 className="text-lg font-semibold text-gray-800">重复退货规则</h3>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                重复检测时间窗口
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="7"
                  max="180"
                  value={rules.duplicateReturnWindow}
                  onChange={(e) => handleRuleChange('duplicateReturnWindow', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="7"
                    max="180"
                    value={rules.duplicateReturnWindow}
                    onChange={(e) => handleRuleChange('duplicateReturnWindow', parseInt(e.target.value) || 7)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold text-lg"
                  />
                  <span className="text-gray-600">天</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                同一客户在此时段内对同一产品申请多次退货，判定为重复退货
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">规则说明</p>
                  <p>相同客户ID + 相同产品ID + {rules.duplicateReturnWindow}天内 ≥2次退货 → 标记为异常</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-rose-50">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5" style={{ color: ANOMALY_TYPE_COLORS.conflict }} />
            <h3 className="text-lg font-semibold text-gray-800">质检冲突规则</h3>
          </div>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            需关注的缺陷类型（勾选后将视为质检冲突）
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {PRESET_DEFECT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleDefectTypeToggle(type)}
                className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  rules.qualityConflictTypes.includes(type)
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-red-300 text-gray-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">规则说明</p>
                <p>退货原因与质检结果存在明显冲突，且缺陷类型属于已勾选类型 → 标记为异常</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">数据处理选项</h3>
            <p className="text-sm text-gray-500">启用后将自动隔离不符合格式要求的数据行</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={rules.enableAutoIsolate}
              onChange={(e) => handleRuleChange('enableAutoIsolate', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-700">
              {rules.enableAutoIsolate ? '已启用' : '已禁用'} 自动坏行隔离
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => navigate('/mapping')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← 返回字段映射
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存规则'}
          </button>
          <button
            onClick={handleRunAnalysis}
            disabled={!canProceed || analyzing}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {analyzing ? '分析中...' : '执行异常分析'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 mb-2">当前配置预览</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-3">
            <div className="text-gray-500 mb-1">超期退货</div>
            <div className="font-semibold text-gray-800">
              <span className="text-amber-600">{rules.overdueDays}</span> 天
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-gray-500 mb-1">重复退货窗口</div>
            <div className="font-semibold text-gray-800">
              <span className="text-blue-600">{rules.duplicateReturnWindow}</span> 天
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="text-gray-500 mb-1">质检冲突类型</div>
            <div className="font-semibold text-gray-800">
              <span className="text-red-600">{rules.qualityConflictTypes.length}</span> 种
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


