import Papa from 'papaparse';
import { generateId, now, sanitizeFileName } from '../utils/common';
import { saveExport, saveExportFile } from './storage';
import {
  ANOMALY_TYPE_LABELS,
  ERROR_TYPE_LABELS,
  SEVERITY_LABELS,
} from '../../shared';
import type {
  AnomalyGroup,
  AnomalyItem,
  BadRow,
  ExportFormat,
  ExportMetadata,
  ExportRecord,
  AnomalyType,
} from '../../shared';

interface ExportContext {
  runId: string;
  mappingId: string;
  rulesId: string;
  anomalies: AnomalyGroup[];
  badRows: BadRow[];
  includeTypes: AnomalyType[];
  includeBadRows: boolean;
}

const generateCsv = (context: ExportContext): string => {
  const { anomalies, badRows, includeTypes, includeBadRows } = context;
  
  const anomalyRows: any[] = [];
  
  for (const group of anomalies) {
    if (!includeTypes.includes(group.type)) continue;
    
    for (const item of group.items) {
      anomalyRows.push({
        异常ID: item.id,
        异常类型: ANOMALY_TYPE_LABELS[item.anomalyType],
        严重程度: SEVERITY_LABELS[item.severity],
        订单编号: item.orderId,
        退货单号: item.returnId || '',
        质检单号: item.qualityId || '',
        描述: item.description,
        超期天数: item.daysOverdue || '',
        重复次数: item.duplicateCount || '',
        冲突类型: item.conflictType || '',
        客户ID: item.rawData.order?.customerId || '',
        商品名称: item.rawData.order?.productId || '',
        订单金额: item.rawData.order?.amount || '',
        退货原因: item.rawData.return?.reason || '',
        退货状态: item.rawData.return?.status || '',
        质检结果: item.rawData.quality?.result || '',
        缺陷类型: item.rawData.quality?.defectType || '',
        检测时间: item.createdAt,
      });
    }
  }
  
  let csvContent = Papa.unparse(anomalyRows);
  
  if (includeBadRows && badRows.length > 0) {
    csvContent += '\n\n=== 坏行记录 ===\n';
    const badRowData = badRows.map(row => ({
      坏行ID: row.id,
      文件类型: row.fileType,
      行号: row.rowIndex + 1,
      错误类型: ERROR_TYPE_LABELS[row.errorType],
      错误信息: row.errorMessage,
      隔离原因: row.isolationReason,
      是否已处理: row.handled ? '是' : '否',
      处理说明: row.handleNote || '',
      原始数据: JSON.stringify(row.rowData),
    }));
    csvContent += Papa.unparse(badRowData);
  }
  
  return csvContent;
};

const generateHtml = (context: ExportContext): string => {
  const { runId, mappingId, rulesId, anomalies, badRows, includeTypes, includeBadRows } = context;
  
  const typeColors: Record<AnomalyType, string> = {
    overdue: '#f59e0b',
    duplicate: '#3b82f6',
    conflict: '#ef4444',
  };
  
  let anomalyHtml = '';
  let totalAnomalies = 0;
  
  for (const group of anomalies) {
    if (!includeTypes.includes(group.type)) continue;
    totalAnomalies += group.count;
    
    anomalyHtml += `
      <div class="mb-8">
        <h2 style="color: ${typeColors[group.type]}; border-left: 4px solid ${typeColors[group.type]}; padding-left: 12px;">
          ${ANOMALY_TYPE_LABELS[group.type]} (${group.count} 条)
        </h2>
        <p class="text-gray-600 mb-4">${group.description}</p>
        <table class="w-full border-collapse">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th class="border px-4 py-2 text-left">订单号</th>
              <th class="border px-4 py-2 text-left">严重程度</th>
              <th class="border px-4 py-2 text-left">描述</th>
              <th class="border px-4 py-2 text-left">退货单号</th>
              <th class="border px-4 py-2 text-left">质检单号</th>
              <th class="border px-4 py-2 text-left">检测时间</th>
            </tr>
          </thead>
          <tbody>
            ${group.items.map(item => `
              <tr>
                <td class="border px-4 py-2 font-mono">${item.orderId}</td>
                <td class="border px-4 py-2">
                  <span style="background-color: ${item.severity === 'high' ? '#fee2e2' : item.severity === 'medium' ? '#fef3c7' : '#dbeafe'}; 
                         color: ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#d97706' : '#2563eb'};
                         padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                    ${SEVERITY_LABELS[item.severity]}
                  </span>
                </td>
                <td class="border px-4 py-2">${item.description}</td>
                <td class="border px-4 py-2 font-mono">${item.returnId || '-'}</td>
                <td class="border px-4 py-2 font-mono">${item.qualityId || '-'}</td>
                <td class="border px-4 py-2 text-sm text-gray-500">${new Date(item.createdAt).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  let badRowsHtml = '';
  if (includeBadRows && badRows.length > 0) {
    badRowsHtml = `
      <div class="mb-8">
        <h2 style="color: #991b1b; border-left: 4px solid #991b1b; padding-left: 12px;">
          坏行记录 (${badRows.length} 条)
        </h2>
        <table class="w-full border-collapse">
          <thead>
            <tr style="background-color: #fef2f2;">
              <th class="border px-4 py-2 text-left">文件类型</th>
              <th class="border px-4 py-2 text-left">行号</th>
              <th class="border px-4 py-2 text-left">错误类型</th>
              <th class="border px-4 py-2 text-left">错误信息</th>
              <th class="border px-4 py-2 text-left">隔离原因</th>
              <th class="border px-4 py-2 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            ${badRows.map(row => `
              <tr>
                <td class="border px-4 py-2">${row.fileType === 'order' ? '订单表' : row.fileType === 'return' ? '退货表' : '质检表'}</td>
                <td class="border px-4 py-2">${row.rowIndex + 1}</td>
                <td class="border px-4 py-2">${ERROR_TYPE_LABELS[row.errorType]}</td>
                <td class="border px-4 py-2">${row.errorMessage}</td>
                <td class="border px-4 py-2">${row.isolationReason}</td>
                <td class="border px-4 py-2">
                  <span style="background-color: ${row.handled ? '#dcfce7' : '#fef3c7'}; 
                         color: ${row.handled ? '#166534' : '#92400e'};
                         padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                    ${row.handled ? '已处理' : '待处理'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>售后退货异常分析报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 24px; }
    h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; }
    .summary { background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .summary-item { background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 32px; font-weight: bold; margin: 8px 0; }
    .summary-label { opacity: 0.8; font-size: 14px; }
    .metadata { background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; }
    .metadata h3 { margin-top: 0; color: #374151; }
    .metadata-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .metadata-item span:first-child { color: #6b7280; margin-right: 8px; }
    table { font-size: 14px; }
    th { background-color: #f3f4f6; font-weight: 600; color: #374151; }
    tr:hover { background-color: #f9fafb; }
    .font-mono { font-family: 'Courier New', monospace; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    .mb-4 { margin-bottom: 16px; }
    .mb-8 { margin-bottom: 32px; }
    .w-full { width: 100%; }
  </style>
</head>
<body>
  <h1>售后退货异常分析报告</h1>
  
  <div class="summary">
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${totalAnomalies}</div>
        <div class="summary-label">异常总数</div>
      </div>
      ${anomalies.map(g => includeTypes.includes(g.type) ? `
        <div class="summary-item">
          <div class="summary-value" style="color: ${typeColors[g.type]};">${g.count}</div>
          <div class="summary-label">${ANOMALY_TYPE_LABELS[g.type]}</div>
        </div>
      ` : '').join('')}
      ${includeBadRows ? `
        <div class="summary-item">
          <div class="summary-value" style="color: #ef4444;">${badRows.length}</div>
          <div class="summary-label">坏行记录</div>
        </div>
      ` : ''}
    </div>
  </div>
  
  <div class="metadata">
    <h3>导出元数据</h3>
    <div class="metadata-grid">
      <div class="metadata-item"><span>运行ID:</span><span class="font-mono">${runId}</span></div>
      <div class="metadata-item"><span>映射方案ID:</span><span class="font-mono">${mappingId}</span></div>
      <div class="metadata-item"><span>规则版本ID:</span><span class="font-mono">${rulesId}</span></div>
      <div class="metadata-item"><span>导出时间:</span><span>${new Date().toLocaleString()}</span></div>
      <div class="metadata-item"><span>包含类型:</span><span>${includeTypes.map(t => ANOMALY_TYPE_LABELS[t]).join(', ')}</span></div>
      <div class="metadata-item"><span>包含坏行:</span><span>${includeBadRows ? '是' : '否'}</span></div>
    </div>
  </div>
  
  ${anomalyHtml}
  ${badRowsHtml}
  
  <footer style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
    售后退货异常分析系统 · 本报告由系统自动生成
  </footer>
</body>
</html>
  `;
};

const generateJson = (context: ExportContext): string => {
  const { anomalies, badRows, includeTypes, includeBadRows } = context;
  
  const filteredAnomalies = anomalies
    .filter(g => includeTypes.includes(g.type))
    .map(g => ({
      type: g.type,
      typeLabel: ANOMALY_TYPE_LABELS[g.type],
      count: g.count,
      description: g.description,
      items: g.items.map(item => ({
        id: item.id,
        orderId: item.orderId,
        returnId: item.returnId,
        qualityId: item.qualityId,
        anomalyType: item.anomalyType,
        anomalyTypeLabel: ANOMALY_TYPE_LABELS[item.anomalyType],
        description: item.description,
        severity: item.severity,
        severityLabel: SEVERITY_LABELS[item.severity],
        daysOverdue: item.daysOverdue,
        duplicateCount: item.duplicateCount,
        conflictType: item.conflictType,
        rawData: item.rawData,
        createdAt: item.createdAt,
      })),
    }));
  
  const output: any = {
    metadata: {
      runId: context.runId,
      mappingId: context.mappingId,
      rulesId: context.rulesId,
      exportedAt: now(),
      includeTypes,
      includeBadRows,
      totalAnomalies: filteredAnomalies.reduce((sum, g) => sum + g.count, 0),
    },
    anomalies: filteredAnomalies,
  };
  
  if (includeBadRows) {
    output.badRows = badRows.map(row => ({
      id: row.id,
      fileType: row.fileType,
      rowIndex: row.rowIndex,
      errorType: row.errorType,
      errorTypeLabel: ERROR_TYPE_LABELS[row.errorType],
      errorMessage: row.errorMessage,
      isolationReason: row.isolationReason,
      handled: row.handled,
      handleNote: row.handleNote,
      rowData: row.rowData,
    }));
  }
  
  return JSON.stringify(output, null, 2);
};

export const generateExport = async (
  context: ExportContext,
  format: ExportFormat
): Promise<ExportRecord> => {
  const { runId, mappingId, rulesId } = context;
  
  let content: string;
  let fileExtension: string;
  
  switch (format) {
    case 'csv':
      content = generateCsv(context);
      fileExtension = 'csv';
      break;
    case 'html':
      content = generateHtml(context);
      fileExtension = 'html';
      break;
    case 'json':
      content = generateJson(context);
      fileExtension = 'json';
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  const exportId = generateId();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = sanitizeFileName(`异常报告_${timestamp}_${exportId.slice(0, 8)}.${fileExtension}`);
  
  const downloadUrl = await saveExportFile(fileName, content, format);
  
  const recordCount = context.anomalies
    .filter(g => context.includeTypes.includes(g.type))
    .reduce((sum, g) => sum + g.count, 0) + (context.includeBadRows ? context.badRows.length : 0);
  
  const metadata: ExportMetadata = {
    exportId,
    runId,
    mappingId,
    rulesId,
    format,
    exportedAt: now(),
    includedTypes: context.includeTypes,
    includeBadRows: context.includeBadRows,
    recordCount,
    fileName,
  };
  
  const record: ExportRecord = {
    id: exportId,
    metadata,
    downloadUrl,
  };
  
  await saveExport(record);
  
  return record;
};
