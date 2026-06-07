import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, FileText, CheckCircle, Clock, AlertTriangle,
  ChevronRight, ArrowRight, Database, BarChart3, FileJson, FileSpreadsheet,
  ExternalLink, Trash2
} from 'lucide-react';
import { useAppStore } from '../store';
import { exportApi, analyzeApi } from '../utils/api';
import { 
  ANOMALY_TYPE_COLORS, 
  ANOMALY_TYPE_LABELS,
  type ExportFormat,
  type AnomalyType,
  type ExportRecord,
  type RunHistory
} from '../../shared';

const FORMAT_CONFIG: Record<ExportFormat, { label: string; icon: any; color: string; bgColor: string }> = {
  csv: {
    label: 'CSV',
    icon: FileSpreadsheet,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  html: {
    label: 'HTML',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  json: {
    label: 'JSON',
    icon: FileJson,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
};

export default function ExportPage() {
  const navigate = useNavigate();
  const { 
    currentRun, 
    exportHistory, 
    runHistory,
    setExportHistory,
    setLoading,
    showNotification,
  } = useAppStore();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedTypes, setSelectedTypes] = useState<AnomalyType[]>(['overdue', 'duplicate', 'conflict']);
  const [includeBadRows, setIncludeBadRows] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentRun) {
      setSelectedRunId(currentRun.id);
    }
  }, [currentRun]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exportResult, runResult] = await Promise.all([
        exportApi.getHistory(),
        analyzeApi.getHistory(),
      ]);
      
      if (exportResult.success) {
        setExportHistory(exportResult.exports);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeToggle = (type: AnomalyType) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleExport = async () => {
    if (!selectedRunId) {
      showNotification('请选择要导出的运行批次', 'error');
      return;
    }

    if (selectedTypes.length === 0) {
      showNotification('请至少选择一种异常类型', 'error');
      return;
    }

    setExporting(true);
    try {
      const result = await exportApi.createExport({
        runId: selectedRunId,
        format: selectedFormat,
        includeTypes: selectedTypes,
        includeBadRows,
      });

      if (result.success) {
        exportApi.download(result.metadata.fileName);
        showNotification(`${selectedFormat.toUpperCase()} 报告导出成功`, 'success');
        loadData();
      }
    } catch (error) {
      showNotification('导出失败: ' + (error as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = (fileName: string) => {
    exportApi.download(fileName);
  };

  const selectedRun = runHistory.find(r => r.id === selectedRunId);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">报告导出</h2>
            <p className="text-purple-100">导出异常分析报告，支持多种格式，包含完整元数据追溯</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">导出配置</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择运行批次
                </label>
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">-- 请选择运行批次 --</option>
                  {runHistory.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.id.slice(0, 12)} - {new Date(run.createdAt).toLocaleString()} - {run.summary.totalAnomalies}个异常
                    </option>
                  ))}
                </select>
                {selectedRun && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-gray-500">订单数:</span>
                        <span className="ml-1 font-medium">{selectedRun.files.order.rowCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">退货数:</span>
                        <span className="ml-1 font-medium">{selectedRun.files.return.rowCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">质检数:</span>
                        <span className="ml-1 font-medium">{selectedRun.files.quality.rowCount}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  导出格式
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(FORMAT_CONFIG) as ExportFormat[]).map((format) => {
                    const config = FORMAT_CONFIG[format];
                    const Icon = config.icon;
                    return (
                      <button
                        key={format}
                        onClick={() => setSelectedFormat(format)}
                        className={`p-4 rounded-xl border-2 transition-all text-center ${
                          selectedFormat === format
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <Icon className={`w-8 h-8 mx-auto mb-2 ${config.color}`} />
                        <div className={`font-semibold ${
                          selectedFormat === format ? 'text-purple-700' : 'text-gray-700'
                        }`}>
                          {config.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  异常类型
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['overdue', 'duplicate', 'conflict'] as AnomalyType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeToggle(type)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedTypes.includes(type)
                          ? 'bg-opacity-10'
                          : 'border-gray-200 opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: selectedTypes.includes(type) ? ANOMALY_TYPE_COLORS[type] : undefined,
                        backgroundColor: selectedTypes.includes(type) 
                          ? `${ANOMALY_TYPE_COLORS[type]}15` 
                          : undefined,
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ANOMALY_TYPE_COLORS[type] }}
                        />
                        <span className={`font-medium ${
                          selectedTypes.includes(type) ? 'text-gray-800' : 'text-gray-500'
                        }`}>
                          {ANOMALY_TYPE_LABELS[type]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-800">包含坏行数据</h4>
                  <p className="text-sm text-gray-500">导出时包含隔离的坏行记录及其错误信息</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBadRows}
                    onChange={(e) => setIncludeBadRows(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  元数据追溯信息
                </h4>
                <p className="text-sm text-purple-700 mb-3">
                  导出文件将包含完整的元数据，可追溯到源数据批次、字段映射和规则配置
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-2">
                    <span className="text-gray-500">运行ID:</span>
                    <code className="ml-1 font-mono">{selectedRunId.slice(0, 12) || '-'}</code>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <span className="text-gray-500">映射ID:</span>
                    <code className="ml-1 font-mono">{selectedRun?.mappingId.slice(0, 12) || '-'}</code>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <span className="text-gray-500">规则ID:</span>
                    <code className="ml-1 font-mono">{selectedRun?.rulesId.slice(0, 12) || '-'}</code>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <span className="text-gray-500">导出时间:</span>
                    <span className="ml-1">{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={!selectedRunId || selectedTypes.length === 0 || exporting}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    正在生成报告...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    导出 {selectedFormat.toUpperCase()} 报告
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">格式说明</h3>
            <div className="space-y-4">
              {(Object.keys(FORMAT_CONFIG) as ExportFormat[]).map((format) => {
                const config = FORMAT_CONFIG[format];
                const Icon = config.icon;
                return (
                  <div key={format} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{config.label}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {format === 'csv' && '适合导入Excel进行数据分析'}
                        {format === 'html' && '适合在浏览器中直接查看，包含样式'}
                        {format === 'json' && '适合程序解析和数据交换'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <h4 className="font-medium mb-1">数据隐私提示</h4>
                <p>导出的报告中可能包含敏感业务数据，请妥善保管，遵守数据安全规范。</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
          <h3 className="text-lg font-semibold text-gray-800">导出历史</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">文件名</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">格式</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">记录数</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">关联运行</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">导出时间</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exportHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无导出记录</p>
                    <p className="text-sm mt-1">配置好导出选项后点击上方按钮开始导出</p>
                  </td>
                </tr>
              ) : (
                exportHistory.map((record: ExportRecord) => {
                  const formatConfig = FORMAT_CONFIG[record.metadata.format];
                  const FormatIcon = formatConfig.icon;
                  
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">{record.metadata.fileName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          映射ID: {record.metadata.mappingId.slice(0, 10)} | 
                          规则ID: {record.metadata.rulesId.slice(0, 10)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${formatConfig.bgColor} ${formatConfig.color}`}>
                          <FormatIcon className="w-3.5 h-3.5" />
                          {formatConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-800">{record.metadata.recordCount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="font-mono text-sm text-gray-600">
                          {record.metadata.runId.slice(0, 12)}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="text-gray-800">
                            {new Date(record.metadata.exportedAt).toLocaleDateString()}
                          </div>
                          <div className="text-gray-500">
                            {new Date(record.metadata.exportedAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownload(record.metadata.fileName)}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                          >
                            <Download className="w-4 h-4" />
                            下载
                          </button>
                          <button
                            className="px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="w-4 h-4" />
                            查看
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/history')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← 返回运行历史
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
        >
          返回看板
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


