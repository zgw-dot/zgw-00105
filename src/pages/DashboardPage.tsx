import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, RefreshCw, XCircle,
  ChevronRight, FileText, Database, Bug, Download, Eye, X, ExternalLink,
  CheckCircle2, AlertCircle, Info, ArrowRight
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAppStore } from '../store';
import { analyzeApi, exportApi } from '../utils/api';
import { 
  ANOMALY_TYPE_COLORS, 
  ANOMALY_TYPE_LABELS, 
  ERROR_TYPE_LABELS,
  SEVERITY_LABELS,
  type AnomalyType,
  type AnomalyItem,
  type BadRow
} from '../../shared';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    currentRun,
    currentAnomalies,
    currentBadRows,
    previousRun,
    comparison,
    setCurrentRun,
    setCurrentAnomalies,
    setCurrentBadRows,
    setPreviousRun,
    setComparison,
    setExportHistory,
    setLoading,
    showNotification,
    selectedAnomalyType,
    setSelectedAnomalyType,
    selectedAnomalyItem,
    setSelectedAnomalyItem,
    detailDrawerOpen,
    setDetailDrawerOpen,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'anomalies' | 'badRows'>('overview');
  const [drawerTab, setDrawerTab] = useState<'raw' | 'quality' | 'errors' | 'notes' | 'isolation'>('raw');

  useEffect(() => {
    loadLatestData();
  }, []);

  const loadLatestData = async () => {
    setLoading(true);
    try {
      const result = await analyzeApi.getLatest();
      if (result.success) {
        if (result.run) {
          setCurrentRun(result.run);
          setCurrentAnomalies(result.anomalies);
          setCurrentBadRows(result.badRows);
          setPreviousRun(result.previousRun);
          setComparison(result.comparison);
        }
        const exportResult = await exportApi.getHistory();
        if (exportResult.success) {
          setExportHistory(exportResult.exports);
        }
      }
    } catch (error) {
      console.error('加载最新数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiffIcon = (diff: number) => {
    if (diff > 0) return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (diff < 0) return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getDiffColor = (diff: number) => {
    if (diff > 0) return 'text-red-600';
    if (diff < 0) return 'text-green-600';
    return 'text-gray-500';
  };

  const getDiffText = (diff: number) => {
    if (diff > 0) return `+${diff}`;
    return `${diff}`;
  };

  const handleGroupClick = (type: AnomalyType) => {
    setSelectedAnomalyType(type);
    const group = currentAnomalies.find(g => g.type === type);
    if (group && group.items.length > 0) {
      setSelectedAnomalyItem(group.items[0]);
      setDetailDrawerOpen(true);
    }
  };

  const handleItemClick = (item: AnomalyItem) => {
    setSelectedAnomalyItem(item);
    setDetailDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDetailDrawerOpen(false);
    setSelectedAnomalyItem(null);
  };

  const handleQuickExport = async (format: 'csv' | 'html' | 'json') => {
    if (!currentRun) {
      showNotification('请先执行异常分析', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await exportApi.createExport({
        runId: currentRun.id,
        format,
        includeTypes: ['overdue', 'duplicate', 'conflict'],
        includeBadRows: true,
      });
      if (result.success) {
        exportApi.download(result.metadata.fileName);
        showNotification(`${format.toUpperCase()} 报告导出成功`, 'success');
        const exportResult = await exportApi.getHistory();
        if (exportResult.success) {
          setExportHistory(exportResult.exports);
        }
      }
    } catch (error) {
      showNotification('导出失败: ' + (error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const pieData = currentAnomalies.map(group => ({
    name: ANOMALY_TYPE_LABELS[group.type],
    value: group.count,
    type: group.type,
  }));

  const trendData = previousRun && currentRun ? [
    {
      name: '上一轮',
      超期退货: previousRun.summary.anomalyByType.overdue,
      重复退货: previousRun.summary.anomalyByType.duplicate,
      质检冲突: previousRun.summary.anomalyByType.conflict,
    },
    {
      name: '本轮',
      超期退货: currentRun.summary.anomalyByType.overdue,
      重复退货: currentRun.summary.anomalyByType.duplicate,
      质检冲突: currentRun.summary.anomalyByType.conflict,
    },
  ] : [];

  const selectedGroup = selectedAnomalyType 
    ? currentAnomalies.find(g => g.type === selectedAnomalyType) 
    : null;

  if (!currentRun) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-12 h-12 text-blue-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">暂无分析数据</h2>
          <p className="text-gray-500 mb-6">请先导入数据并执行异常分析</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/import')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
            >
              <Database className="w-5 h-5" />
              导入数据
            </button>
            <button
              onClick={loadLatestData}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              刷新数据
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">异常分析看板</h2>
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                运行ID: {currentRun.id.slice(0, 8)}
              </span>
            </div>
            <p className="text-slate-300">
              分析时间: {new Date(currentRun.completedAt).toLocaleString()}
              {previousRun && (
                <span className="ml-4">
                  对比上轮: {new Date(previousRun.completedAt).toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadLatestData}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <div className="relative group">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2">
                <Download className="w-4 h-4" />
                导出报告
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={() => handleQuickExport('csv')}
                  className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-t-lg flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-green-600" />
                  导出 CSV
                </button>
                <button
                  onClick={() => handleQuickExport('html')}
                  className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  导出 HTML
                </button>
                <button
                  onClick={() => handleQuickExport('json')}
                  className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-b-lg flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-purple-600" />
                  导出 JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 text-sm">总异常数</span>
            {comparison && (
              <div className={`flex items-center gap-1 text-sm ${getDiffColor(comparison.totalAnomalies)}`}>
                {getDiffIcon(comparison.totalAnomalies)}
                {getDiffText(comparison.totalAnomalies)}
              </div>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-800">{currentRun.summary.totalAnomalies}</div>
          <div className="mt-2 text-sm text-gray-500">
            共 {currentRun.summary.totalOrders + currentRun.summary.totalReturns + currentRun.summary.totalQuality} 条记录
          </div>
        </div>

        {(['overdue', 'duplicate', 'conflict'] as AnomalyType[]).map((type) => {
          const count = currentRun.summary.anomalyByType[type];
          const diff = comparison?.anomalyByType[type] || 0;
          return (
            <div 
              key={type}
              className="bg-white rounded-xl shadow-sm border-l-4 p-5 cursor-pointer hover:shadow-md transition-all"
              style={{ borderLeftColor: ANOMALY_TYPE_COLORS[type] }}
              onClick={() => handleGroupClick(type)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500 text-sm">{ANOMALY_TYPE_LABELS[type]}</span>
                {comparison && (
                  <div className={`flex items-center gap-1 text-sm ${getDiffColor(diff)}`}>
                    {getDiffIcon(diff)}
                    {getDiffText(diff)}
                  </div>
                )}
              </div>
              <div className="text-3xl font-bold text-gray-800">{count}</div>
              <div className="mt-2 flex items-center text-sm text-blue-600">
                <Eye className="w-4 h-4 mr-1" />
                查看详情
                <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-800">坏行隔离摘要</h3>
          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-sm rounded-full">
            {currentRun.summary.badRowCount} 条
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(
            currentBadRows.reduce((acc, row) => {
              acc[row.errorType] = (acc[row.errorType] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([errorType, count]) => (
            <div key={errorType} className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">{ERROR_TYPE_LABELS[errorType as keyof typeof ERROR_TYPE_LABELS]}</div>
              <div className="text-2xl font-bold text-red-600">{count}</div>
            </div>
          ))}
          {Object.keys(currentBadRows.reduce((acc, row) => {
            acc[row.errorType] = true;
            return acc;
          }, {} as Record<string, boolean>)).length === 0 && (
            <div className="col-span-4 text-center text-gray-500 py-4">
              无坏行数据
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">异常类型分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ANOMALY_TYPE_COLORS[entry.type]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">轮次对比趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="超期退货" fill={ANOMALY_TYPE_COLORS.overdue} />
              <Bar dataKey="重复退货" fill={ANOMALY_TYPE_COLORS.duplicate} />
              <Bar dataKey="质检冲突" fill={ANOMALY_TYPE_COLORS.conflict} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { key: 'overview', label: '异常分组', icon: AlertTriangle },
              { key: 'anomalies', label: '异常明细', icon: FileText },
              { key: 'badRows', label: '坏行清单', icon: Bug },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {currentAnomalies.map((group) => (
                <div
                  key={group.type}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleGroupClick(group.type)}
                  style={{ borderLeftWidth: '4px', borderLeftColor: ANOMALY_TYPE_COLORS[group.type] }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${ANOMALY_TYPE_COLORS[group.type]}20` }}
                      >
                        {group.type === 'overdue' && <Clock className="w-6 h-6" style={{ color: ANOMALY_TYPE_COLORS[group.type] }} />}
                        {group.type === 'duplicate' && <RefreshCw className="w-6 h-6" style={{ color: ANOMALY_TYPE_COLORS[group.type] }} />}
                        {group.type === 'conflict' && <XCircle className="w-6 h-6" style={{ color: ANOMALY_TYPE_COLORS[group.type] }} />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 text-lg">
                          {ANOMALY_TYPE_LABELS[group.type]}
                        </h4>
                        <p className="text-sm text-gray-500">{group.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-800">{group.count}</div>
                        <div className="text-xs text-gray-500">条异常</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'anomalies' && selectedGroup && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-800">
                  {ANOMALY_TYPE_LABELS[selectedGroup.type]} - 共 {selectedGroup.count} 条
                </h4>
                <div className="flex gap-2">
                  {currentAnomalies.map((g) => (
                    <button
                      key={g.type}
                      onClick={() => setSelectedAnomalyType(g.type)}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        selectedAnomalyType === g.type
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={{
                        backgroundColor: selectedAnomalyType === g.type
                          ? ANOMALY_TYPE_COLORS[g.type]
                          : undefined,
                      }}
                    >
                      {ANOMALY_TYPE_LABELS[g.type]} ({g.count})
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">订单编号</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">严重程度</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">详情</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedGroup.items.slice(0, 20).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-sm">{item.orderId}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.description}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.severity === 'high' ? 'bg-red-100 text-red-700' :
                            item.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {SEVERITY_LABELS[item.severity]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.daysOverdue && `超期 ${item.daysOverdue} 天`}
                          {item.duplicateCount && `重复 ${item.duplicateCount} 次`}
                          {item.conflictType && `冲突类型: ${item.conflictType}`}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleItemClick(item)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            查看
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedGroup.items.length > 20 && (
                <div className="text-center py-4 text-gray-500">
                  仅显示前 20 条，共 {selectedGroup.items.length} 条
                </div>
              )}
            </div>
          )}

          {activeTab === 'anomalies' && !selectedGroup && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>请点击上方异常分组查看明细</p>
            </div>
          )}

          {activeTab === 'badRows' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">文件类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">行号</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">错误类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">错误信息</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">隔离原因</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentBadRows.map((row) => (
                    <tr key={row.id} className="hover:bg-red-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {row.fileType === 'order' ? '订单表' : row.fileType === 'return' ? '退货表' : '质检表'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{row.rowIndex}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                          {ERROR_TYPE_LABELS[row.errorType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.errorMessage}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.isolationReason}</td>
                      <td className="px-4 py-3">
                        {row.handled ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            已处理
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 text-sm">
                            <Clock className="w-4 h-4" />
                            待处理
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {currentBadRows.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>无坏行数据，所有记录均有效</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {detailDrawerOpen && selectedAnomalyItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseDrawer} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">异常详情</h3>
                <p className="text-sm text-gray-500">订单号: {selectedAnomalyItem.orderId}</p>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="border-b border-gray-200">
              <div className="flex">
                {[
                  { key: 'raw', label: '原始行数据', icon: Database },
                  { key: 'quality', label: '质检记录', icon: FileText },
                  { key: 'errors', label: '错误清单', icon: Bug },
                  { key: 'notes', label: '处理说明', icon: Info },
                  { key: 'isolation', label: '隔离原因', icon: AlertTriangle },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDrawerTab(tab.key as any)}
                    className={`flex items-center gap-1 px-4 py-3 border-b-2 text-sm transition-all ${
                      drawerTab === tab.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: `${ANOMALY_TYPE_COLORS[selectedAnomalyItem.anomalyType]}10` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ANOMALY_TYPE_COLORS[selectedAnomalyItem.anomalyType] }}
                  />
                  <span className="font-medium" style={{ color: ANOMALY_TYPE_COLORS[selectedAnomalyItem.anomalyType] }}>
                    {ANOMALY_TYPE_LABELS[selectedAnomalyItem.anomalyType]}
                  </span>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    selectedAnomalyItem.severity === 'high' ? 'bg-red-100 text-red-700' :
                    selectedAnomalyItem.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {SEVERITY_LABELS[selectedAnomalyItem.severity]}
                  </span>
                </div>
                <p className="text-gray-700">{selectedAnomalyItem.description}</p>
              </div>

              {drawerTab === 'raw' && (
                <div className="space-y-4">
                  {selectedAnomalyItem.rawData.order && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        订单原始数据
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                        <pre>{JSON.stringify(selectedAnomalyItem.rawData.order, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                  {selectedAnomalyItem.rawData.return && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                        <Database className="w-4 h-4 text-green-600" />
                        退货原始数据
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                        <pre>{JSON.stringify(selectedAnomalyItem.rawData.return, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'quality' && (
                <div>
                  {selectedAnomalyItem.rawData.quality ? (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        质检记录详情
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                        <pre>{JSON.stringify(selectedAnomalyItem.rawData.quality, null, 2)}</pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p>暂无质检记录</p>
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'errors' && (
                <div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-2">错误信息</h4>
                    <p className="text-red-700">{selectedAnomalyItem.description}</p>
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {selectedAnomalyItem.daysOverdue && (
                          <div>
                            <span className="text-gray-500">超期天数:</span>
                            <span className="ml-2 font-semibold text-red-600">{selectedAnomalyItem.daysOverdue} 天</span>
                          </div>
                        )}
                        {selectedAnomalyItem.duplicateCount && (
                          <div>
                            <span className="text-gray-500">重复次数:</span>
                            <span className="ml-2 font-semibold text-red-600">{selectedAnomalyItem.duplicateCount} 次</span>
                          </div>
                        )}
                        {selectedAnomalyItem.conflictType && (
                          <div>
                            <span className="text-gray-500">冲突类型:</span>
                            <span className="ml-2 font-semibold text-red-600">{selectedAnomalyItem.conflictType}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">检测时间:</span>
                          <span className="ml-2">{new Date(selectedAnomalyItem.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'notes' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">处理建议</h4>
                    {selectedAnomalyItem.anomalyType === 'overdue' && (
                      <ul className="text-blue-700 space-y-2 text-sm">
                        <li>• 核实退货申请时间是否准确，是否存在系统延迟</li>
                        <li>• 检查客户是否有特殊延迟申请记录</li>
                        <li>• 评估是否需要调整超期天数阈值</li>
                        <li>• 联系客户确认退货原因，记录异常原因</li>
                      </ul>
                    )}
                    {selectedAnomalyItem.anomalyType === 'duplicate' && (
                      <ul className="text-blue-700 space-y-2 text-sm">
                        <li>• 核实是否为同一商品多次退货</li>
                        <li>• 检查是否存在客户恶意退货行为</li>
                        <li>• 联系客户了解重复退货的真实原因</li>
                        <li>• 评估产品质量是否存在系统性问题</li>
                      </ul>
                    )}
                    {selectedAnomalyItem.anomalyType === 'conflict' && (
                      <ul className="text-blue-700 space-y-2 text-sm">
                        <li>• 核实质检结果与退货原因是否真的存在冲突</li>
                        <li>• 检查质检流程是否存在疏漏</li>
                        <li>• 必要时安排重新质检</li>
                        <li>• 与质检部门沟通确认缺陷类型判定标准</li>
                      </ul>
                    )}
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>此处可添加自定义处理备注</p>
                  </div>
                </div>
              )}

              {drawerTab === 'isolation' && (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-medium text-amber-800 mb-2">隔离原因</h4>
                    <p className="text-amber-700">
                      该记录因存在"{ANOMALY_TYPE_LABELS[selectedAnomalyItem.anomalyType]}"异常，
                      已从正常数据中隔离，等待进一步处理确认。
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500">异常ID</div>
                        <div className="font-mono font-semibold">{selectedAnomalyItem.id}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500">关联订单</div>
                        <div className="font-mono font-semibold">{selectedAnomalyItem.orderId}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500">运行批次</div>
                        <div className="font-mono font-semibold">{currentRun?.id}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-gray-500">发现时间</div>
                        <div className="font-mono font-semibold">
                          {new Date(selectedAnomalyItem.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
              <button
                onClick={handleCloseDrawer}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
              >
                关闭
              </button>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  查看完整记录
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  标记已处理
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/export')}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
        >
          前往报告导出
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


