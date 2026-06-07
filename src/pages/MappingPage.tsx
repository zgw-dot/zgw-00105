import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, RefreshCw, ArrowRight, CheckCircle, Database } from 'lucide-react';
import { useAppStore } from '../store';
import { mappingApi } from '../utils/api';
import { SYSTEM_FIELDS, ANOMALY_TYPE_LABELS, type FileType } from '../../shared';
import type { FieldMapping } from '../../shared';

const FILE_TYPE_LABELS: Record<FileType, string> = {
  order: '订单表',
  return: '退货表',
  quality: '质检表',
};

const SYSTEM_FIELD_LABELS: Record<string, string> = {
  orderId: '订单编号',
  orderDate: '下单日期',
  customerId: '客户ID',
  productId: '产品ID',
  amount: '订单金额',
  returnId: '退货编号',
  returnDate: '退货日期',
  reason: '退货原因',
  status: '退货状态',
  qualityId: '质检编号',
  inspectDate: '质检日期',
  result: '质检结果',
  defectType: '缺陷类型',
};

export default function MappingPage() {
  const navigate = useNavigate();
  const { uploadedFiles, currentMappingId, setCurrentMappingId, setLoading, showNotification } = useAppStore();
  const [mappings, setMappings] = useState<FieldMapping['mapping']>({
    order: {},
    return: {},
    quality: {},
  });
  const [savedMappings, setSavedMappings] = useState<FieldMapping[]>([]);
  const [mappingName, setMappingName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMappings();
  }, []);

  useEffect(() => {
    if (uploadedFiles.order || uploadedFiles.return || uploadedFiles.quality) {
      initAutoMapping();
    }
  }, [uploadedFiles]);

  const loadMappings = async () => {
    try {
      const result = await mappingApi.getMappings();
      if (result.success) {
        setSavedMappings(result.savedMappings);
        if (result.currentMapping) {
          setMappings(result.currentMapping.mapping);
          setMappingName(result.currentMapping.name);
          setCurrentMappingId(result.currentMapping.id);
        }
      }
    } catch (error) {
      console.error('加载映射失败:', error);
    }
  };

  const initAutoMapping = async () => {
    const orderColumns = uploadedFiles.order?.columns || [];
    const returnColumns = uploadedFiles.return?.columns || [];
    const qualityColumns = uploadedFiles.quality?.columns || [];

    try {
      const result = await mappingApi.autoMap({
        orderColumns,
        returnColumns,
        qualityColumns,
      });
      if (result.success) {
        setMappings(result.mapping);
      }
    } catch (error) {
      console.error('自动映射失败:', error);
    }
  };

  const handleMappingChange = (fileType: FileType, systemField: string, csvColumn: string) => {
    setMappings((prev) => ({
      ...prev,
      [fileType]: {
        ...prev[fileType],
        [systemField]: csvColumn,
      },
    }));
  };

  const handleAutoMap = async () => {
    setLoading(true);
    try {
      await initAutoMapping();
      showNotification('自动映射完成', 'success');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!mappingName.trim()) {
      showNotification('请输入映射名称', 'error');
      return;
    }

    const requiredMappings: Record<FileType, string[]> = {
      order: ['orderId'],
      return: ['returnId', 'orderId'],
      quality: ['qualityId', 'orderId'],
    };

    for (const [fileType, fields] of Object.entries(requiredMappings) as [FileType, string[]][]) {
      for (const field of fields) {
        if (!mappings[fileType][field]) {
          showNotification(`${FILE_TYPE_LABELS[fileType]}缺少必需字段映射: ${SYSTEM_FIELD_LABELS[field]}`, 'error');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const result = await mappingApi.saveMapping({
        name: mappingName,
        mapping: mappings,
      });
      if (result.success) {
        setCurrentMappingId(result.mappingId);
        showNotification('字段映射保存成功', 'success');
        loadMappings();
      }
    } catch (error) {
      showNotification('保存失败: ' + (error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadSavedMapping = (mapping: FieldMapping) => {
    setMappings(mapping.mapping);
    setMappingName(mapping.name);
    setCurrentMappingId(mapping.id);
    showNotification(`已加载映射: ${mapping.name}`, 'info');
  };

  const canProceed = currentMappingId && 
    (uploadedFiles.order || uploadedFiles.return || uploadedFiles.quality);

  const renderMappingTable = (fileType: FileType) => {
    const systemFields = SYSTEM_FIELDS[fileType];
    const csvColumns = uploadedFiles[fileType]?.columns || [];
    const requiredFields = fileType === 'order' ? ['orderId'] : 
                          fileType === 'return' ? ['returnId', 'orderId'] : 
                          ['qualityId', 'orderId'];

    return (
      <div key={fileType} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">{FILE_TYPE_LABELS[fileType]}</h3>
            {uploadedFiles[fileType] && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                已上传 {uploadedFiles[fileType]?.rowCount} 行
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-medium w-1/3">系统字段</th>
                <th className="pb-3 font-medium w-1/3">CSV列名</th>
                <th className="pb-3 font-medium w-1/3">预览值</th>
              </tr>
            </thead>
            <tbody>
              {systemFields.map((field) => {
                const isRequired = requiredFields.includes(field);
                const mappedColumn = mappings[fileType][field];
                const previewValue = mappedColumn && uploadedFiles[fileType]?.preview?.[0]?.[mappedColumn];

                return (
                  <tr key={field} className="border-b border-gray-100 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isRequired ? 'text-gray-800' : 'text-gray-600'}`}>
                          {SYSTEM_FIELD_LABELS[field] || field}
                        </span>
                        {isRequired && (
                          <span className="text-red-500 text-xs font-bold">*</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{field}</span>
                    </td>
                    <td className="py-3">
                      <select
                        value={mappedColumn || ''}
                        onChange={(e) => handleMappingChange(fileType, field, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                        disabled={!csvColumns.length}
                      >
                        <option value="">-- 请选择 --</option>
                        {csvColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-gray-600 truncate block max-w-[200px]">
                        {previewValue || '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">字段映射配置</h2>
            <p className="text-blue-100">将CSV文件中的列名映射到系统所需字段，确保数据正确关联</p>
          </div>
          <button
            onClick={handleAutoMap}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all backdrop-blur-sm"
          >
            <RefreshCw className="w-4 h-4" />
            自动映射
          </button>
        </div>
      </div>

      {savedMappings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">已保存的映射</h3>
          <div className="flex flex-wrap gap-3">
            {savedMappings.map((mapping) => (
              <button
                key={mapping.id}
                onClick={() => loadSavedMapping(mapping)}
                className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                  currentMappingId === mapping.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                {currentMappingId === mapping.id && <CheckCircle className="w-4 h-4" />}
                <span className="font-medium">{mapping.name}</span>
                <span className="text-xs text-gray-400">
                  {new Date(mapping.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {renderMappingTable('order')}
        {renderMappingTable('return')}
        {renderMappingTable('quality')}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">保存映射配置</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              映射名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              placeholder="例如：2024年Q1映射配置"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存映射'}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => navigate('/import')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← 返回导入
        </button>
        <button
          onClick={() => navigate('/rules')}
          disabled={!canProceed}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一步：规则配置
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-medium text-amber-800 mb-2">字段映射说明</h4>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• 带 <span className="text-red-500 font-bold">*</span> 标记的字段为必需字段，必须完成映射</li>
          <li>• 订单编号(orderId)是关联三张表的关键字段，请确保映射正确</li>
          <li>• 点击"自动映射"可根据中英文列名智能匹配</li>
          <li>• 保存后的映射可在下次运行时直接加载使用</li>
        </ul>
      </div>
    </div>
  );
}


