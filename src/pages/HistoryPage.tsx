import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, Eye, Download,
  ChevronRight, ArrowRight, Database, FileText, BarChart3
} from 'lucide-react';
import { useAppStore } from '../store';
import { analyzeApi } from '../utils/api';
import { 
  ANOMALY_TYPE_COLORS, 
  ANOMALY_TYPE_LABELS,
  type RunHistory,
  type RunStatus
} from '../../shared';

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; bgColor: string; icon: any }> = {
  completed: {
    label: '已完成',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
  },
  partial: {
    label: '部分完成',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: AlertTriangle,
  },
  failed: {
    label: '失败',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { 
    runHistory, 
    setRunHistory,
    setCurrentRun,
    setCurrentAnomalies,
    setCurrentBadRows,
    setPreviousRun,
    setComparison,
    setLoading,
    showNotification,
  } = useAppStore();
  
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await analyzeApi.getHistory();
      if (result.success) {
        setRunHistory(result.runs);
      }
    } catch (error) {
      showNotification('加载历史记录失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRunDetail = async (runId: string) => {
    setLoadingRunId(runId);
    try {
      const result = await analyzeApi.getRun(runId);
      if (result.success) {
        setCurrentRun(result.run);
        setCurrentAnomalies(result.anomalies);
        setCurrentBadRows(result.badRows);

        const historyResult = await analyzeApi.getHistory();
        if (historyResult.success && historyResult.runs.length >= 2) {
          const currentIndex = historyResult.runs.findIndex(r => r.id === runId);
          if (currentIndex < historyResult.runs.length - 1) {
            const compareResult = await analyzeApi.compareRuns(
              runId,
              historyResult.runs[currentIndex + 1].id
            );
            if (compareResult.success) {
              setPreviousRun(compareResult.run2);
              setComparison(compareResult.diff);
            }
          } else {
            setPreviousRun(null);
            setComparison(null);
          }
        }

        setSelectedRun(runId);
        showNotification('已加载该次运行数据', 'success');
      }
    } catch (error) {
      showNotification('加载运行详情失败', 'error');
    } finally {
      setLoadingRunId(null);
    }
  };

  const handleViewDashboard = (runId: string) => {
    loadRunDetail(runId);
    navigate('/');
  };

  const handleCompare = async (runId: string) => {
    if (runHistory.length < 2) {
      showNotification('需要至少两次运行才能进行对比', 'info');
      return;
    }

    const otherRuns = runHistory.filter(r => r.id !== runId);
    if (otherRuns.length === 0) {
      showNotification('没有可对比的运行记录', 'info');
      return;
    }

    try {
      const result = await analyzeApi.compareRuns(runId, otherRuns[0].id);
      if (result.success) {
        setCurrentRun(result.run1);
        setPreviousRun(result.run2);
        setComparison(result.diff);
        showNotification('对比数据已加载', 'success');
        navigate('/');
      }
    } catch (error) {
      showNotification('对比失败', 'error');
    }
  };

  if (runHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
          <Clock className="w-12 h-12 text-blue-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">暂无运行历史</h2>
          <p className="text-gray-500 mb-6">执行异常分析后，运行记录将显示在此处</p>
          <button
            onClick={() => navigate('/import')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
          >
            <Database className="w-5 h-5" />
            开始导入数据
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">运行历史</h2>
            <p className="text-slate-300">查看所有历史分析记录，支持加载和对比</p>
          </div>
          <button
            onClick={loadHistory}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">运行ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">状态</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">数据量</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">异常统计</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">坏行数</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">运行时间</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runHistory.map((run, index) => {
                const statusConfig = STATUS_CONFIG[run.status];
                const StatusIcon = statusConfig.icon;

                return (
                  <tr 
                    key={run.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedRun === run.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            最新
                          </span>
                        )}
                        <code className="font-mono text-sm text-gray-700">{run.id.slice(0, 12)}</code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">订单:</span>
                          <span className="font-medium">{run.files.order.rowCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">退货:</span>
                          <span className="font-medium">{run.files.return.rowCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500">质检:</span>
                          <span className="font-medium">{run.files.quality.rowCount}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-gray-800">
                          {run.summary.totalAnomalies}
                        </div>
                        <div className="flex flex-col gap-1">
                          {(['overdue', 'duplicate', 'conflict'] as const).map((type) => (
                            <div key={type} className="flex items-center gap-1.5">
                              <span 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: ANOMALY_TYPE_COLORS[type] }}
                              />
                              <span className="text-xs text-gray-600">
                                {ANOMALY_TYPE_LABELS[type]}: {run.summary.anomalyByType[type]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${
                        run.summary.badRowCount > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {run.summary.badRowCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-gray-800">
                          {new Date(run.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-gray-500">
                          {new Date(run.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDashboard(run.id)}
                          disabled={loadingRunId === run.id}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {loadingRunId === run.id ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          查看
                        </button>
                        <button
                          onClick={() => handleCompare(run.id)}
                          className="px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
                        >
                          <BarChart3 className="w-4 h-4" />
                          对比
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">运行详情</h3>
        {selectedRun ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {runHistory.find(r => r.id === selectedRun) && (
              <>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">数据文件</span>
                  </div>
                  <div className="space-y-1 text-sm text-blue-700">
                    <div>订单: {runHistory.find(r => r.id === selectedRun)?.files.order.fileName}</div>
                    <div>退货: {runHistory.find(r => r.id === selectedRun)?.files.return.fileName}</div>
                    <div>质检: {runHistory.find(r => r.id === selectedRun)?.files.quality.fileName}</div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">关联配置</span>
                  </div>
                  <div className="space-y-1 text-sm text-green-700">
                    <div>映射ID: {runHistory.find(r => r.id === selectedRun)?.mappingId.slice(0, 12)}</div>
                    <div>规则ID: {runHistory.find(r => r.id === selectedRun)?.rulesId.slice(0, 12)}</div>
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-purple-800">处理耗时</span>
                  </div>
                  <div className="text-sm text-purple-700">
                    {(new Date(runHistory.find(r => r.id === selectedRun)!.completedAt).getTime() - 
                      new Date(runHistory.find(r => r.id === selectedRun)!.createdAt).getTime()) / 1000} 秒
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>点击"查看"按钮查看某次运行的详细信息</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← 返回看板
        </button>
        <button
          onClick={() => navigate('/export')}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
        >
          查看导出记录
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


