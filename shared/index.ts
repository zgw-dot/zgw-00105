export type FileType = 'order' | 'return' | 'quality';

export type AnomalyType = 'overdue' | 'duplicate' | 'conflict';

export type Severity = 'low' | 'medium' | 'high';

export type ErrorType = 'missing_column' | 'invalid_date' | 'invalid_value' | 'duplicate_order';

export type RunStatus = 'completed' | 'failed' | 'partial';

export type ExportFormat = 'csv' | 'html' | 'json';

export const SYSTEM_FIELDS = {
  order: ['orderId', 'orderDate', 'customerId', 'productId', 'amount'],
  return: ['returnId', 'orderId', 'returnDate', 'reason', 'status'],
  quality: ['qualityId', 'orderId', 'inspectDate', 'result', 'defectType'],
} as const;

export type SystemFieldOrder = typeof SYSTEM_FIELDS.order[number];
export type SystemFieldReturn = typeof SYSTEM_FIELDS.return[number];
export type SystemFieldQuality = typeof SYSTEM_FIELDS.quality[number];

export interface FieldMapping {
  id: string;
  name: string;
  mapping: {
    order: Record<string, string>;
    return: Record<string, string>;
    quality: Record<string, string>;
  };
  createdAt: string;
}

export interface AnalysisRules {
  overdueDays: number;
  duplicateReturnWindow: number;
  qualityConflictTypes: string[];
  enableAutoIsolate: boolean;
}

export interface RulesVersion {
  id: string;
  rules: AnalysisRules;
  createdAt: string;
}

export interface ValidationError {
  rowIndex?: number;
  errorType: ErrorType;
  errorMessage: string;
  column?: string;
  value?: string;
}

export interface UploadResponse {
  success: boolean;
  fileId: string;
  fileName: string;
  fileType: FileType;
  columns: string[];
  preview: any[];
  rowCount: number;
  errors?: ValidationError[];
  rejectAll?: boolean;
  rejectReason?: string;
}

export interface AnomalyItem {
  id: string;
  orderId: string;
  returnId?: string;
  qualityId?: string;
  anomalyType: AnomalyType;
  description: string;
  severity: Severity;
  daysOverdue?: number;
  duplicateCount?: number;
  conflictType?: string;
  rawData: {
    order?: any;
    return?: any;
    quality?: any;
  };
  createdAt: string;
}

export interface AnomalyGroup {
  type: AnomalyType;
  count: number;
  description: string;
  items: AnomalyItem[];
}

export interface BadRow {
  id: string;
  fileType: FileType;
  rowIndex: number;
  rowData: any;
  errorType: ErrorType;
  errorMessage: string;
  isolationReason: string;
  handled: boolean;
  handleNote?: string;
}

export interface AnalysisSummary {
  totalOrders: number;
  totalReturns: number;
  totalQuality: number;
  totalAnomalies: number;
  anomalyByType: Record<AnomalyType, number>;
  badRowCount: number;
  processedAt: string;
}

export interface AnalysisSummaryDiff {
  totalAnomalies: number;
  anomalyByType: Record<AnomalyType, number>;
}

export interface ComparisonDiff {
  run1Summary: AnalysisSummary;
  run2Summary: AnalysisSummary;
  diff: AnalysisSummaryDiff;
}

export interface RunHistory {
  id: string;
  mappingId: string;
  rulesId: string;
  files: {
    order: { fileId: string; fileName: string; rowCount: number };
    return: { fileId: string; fileName: string; rowCount: number };
    quality: { fileId: string; fileName: string; rowCount: number };
  };
  summary: AnalysisSummary;
  status: RunStatus;
  createdAt: string;
  completedAt: string;
}

export interface ExportMetadata {
  exportId: string;
  runId: string;
  mappingId: string;
  rulesId: string;
  format: ExportFormat;
  exportedAt: string;
  includedTypes: AnomalyType[];
  includeBadRows: boolean;
  recordCount: number;
  fileName: string;
}

export interface ExportRecord {
  id: string;
  metadata: ExportMetadata;
  downloadUrl: string;
}

export interface AnalyzeResult {
  success: boolean;
  runId: string;
  summary: AnalysisSummary;
  anomalies: AnomalyGroup[];
  badRows: BadRow[];
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  overdue: '超期退货',
  duplicate: '重复退货',
  conflict: '质检冲突',
};

export const ANOMALY_TYPE_COLORS: Record<AnomalyType, string> = {
  overdue: '#f59e0b',
  duplicate: '#3b82f6',
  conflict: '#ef4444',
};

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  missing_column: '缺少必需列',
  invalid_date: '日期格式错误',
  invalid_value: '非法规则值',
  duplicate_order: '重复订单号',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: '低',
  medium: '中',
  high: '高',
};
