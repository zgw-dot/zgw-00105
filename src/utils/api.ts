import type {
  FileType,
  FieldMapping,
  AnalysisRules,
  AnomalyGroup,
  BadRow,
  RunHistory,
  AnalysisSummary,
  AnalysisSummaryDiff,
  ExportRecord,
  ExportFormat,
  AnomalyType,
  ValidationError,
} from '../../shared';

const API_BASE = '/api';

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  
  return data as T;
}

export const importApi = {
  uploadFile: (fileType: FileType, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);
    
    return fetch(`${API_BASE}/import/upload`, {
      method: 'POST',
      body: formData,
    }).then(res => res.json());
  },

  validateData: (params: {
    fileType: FileType;
    data: any[];
    columns: string[];
    mapping: Record<string, string>;
    enableAutoIsolate?: boolean;
  }) => request<{
    success: boolean;
    rejectAll?: boolean;
    rejectReason?: string;
    errors: ValidationError[];
    badRows: BadRow[];
    validData: any[];
    badRowCount: number;
    validRowCount: number;
  }>('/import/validate', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  saveFile: (params: {
    fileType: FileType;
    fileName: string;
    data: any[];
    columns: string[];
  }) => request<{
    success: boolean;
    fileId: string;
    fileType: FileType;
    fileName: string;
    columns: string[];
    rowCount: number;
  }>('/import/save', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  getSampleData: () => request<{
    success: boolean;
    order: { columns: string[]; data: any[]; preview: any[] };
    return: { columns: string[]; data: any[]; preview: any[] };
    quality: { columns: string[]; data: any[]; preview: any[] };
  }>('/import/sample'),

  getRawFile: (fileId: string) => request<{
    success: boolean;
    data: any[];
    columns: string[];
    meta: any;
  }>(`/import/raw/${fileId}`),
};

export const mappingApi = {
  getMappings: () => request<{
    success: boolean;
    savedMappings: FieldMapping[];
    currentMapping: FieldMapping | null;
  }>('/mapping'),

  getMapping: (id: string) => request<{
    success: boolean;
    mapping: FieldMapping;
  }>(`/mapping/${id}`),

  saveMapping: (params: {
    name: string;
    mapping: FieldMapping['mapping'];
  }) => request<{
    success: boolean;
    mappingId: string;
  }>('/mapping/save', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  autoMap: (params: {
    orderColumns: string[];
    returnColumns: string[];
    qualityColumns: string[];
  }) => request<{
    success: boolean;
    mapping: FieldMapping['mapping'];
  }>('/mapping/auto-map', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
};

export const rulesApi = {
  getRules: () => request<{
    success: boolean;
    currentRules: AnalysisRules;
    history: { id: string; rules: AnalysisRules; createdAt: string }[];
  }>('/rules'),

  getRulesVersion: (id: string) => request<{
    success: boolean;
    rules: AnalysisRules;
    createdAt: string;
  }>(`/rules/${id}`),

  saveRules: (params: { rules: AnalysisRules }) => request<{
    success: boolean;
    rulesId: string;
  }>('/rules/save', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  getDefaultRules: () => request<{
    success: boolean;
    rules: AnalysisRules;
  }>('/rules/default'),

  validateRules: (params: { rules: AnalysisRules }) => request<{
    success: boolean;
    errors: string[];
  }>('/rules/validate', {
    method: 'POST',
    body: JSON.stringify(params),
  }),
};

export const analyzeApi = {
  runAnalysis: (params: {
    mappingId: string;
    rulesId: string;
    orderFileId: string;
    returnFileId: string;
    qualityFileId: string;
  }) => request<{
    success: boolean;
    runId: string;
    summary: AnalysisSummary;
    anomalies: AnomalyGroup[];
    badRows: BadRow[];
  }>('/analyze/run', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  getHistory: () => request<{
    success: boolean;
    runs: RunHistory[];
  }>('/analyze/history'),

  getRun: (runId: string) => request<{
    success: boolean;
    run: RunHistory;
    anomalies: AnomalyGroup[];
    badRows: BadRow[];
  }>(`/analyze/run/${runId}`),

  compareRuns: (runId1: string, runId2: string) => request<{
    success: boolean;
    run1: RunHistory;
    run2: RunHistory;
    diff: AnalysisSummaryDiff;
  }>(`/analyze/compare/${runId1}/${runId2}`),

  getLatest: () => request<{
    success: boolean;
    run: RunHistory | null;
    anomalies: AnomalyGroup[];
    badRows: BadRow[];
    previousRun: RunHistory | null;
    comparison: AnalysisSummaryDiff | null;
  }>('/analyze/latest'),
};

export const exportApi = {
  createExport: (params: {
    runId: string;
    format: ExportFormat;
    includeTypes: AnomalyType[];
    includeBadRows: boolean;
  }) => request<{
    success: boolean;
    exportId: string;
    downloadUrl: string;
    metadata: ExportRecord['metadata'];
  }>('/export', {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  getHistory: () => request<{
    success: boolean;
    exports: ExportRecord[];
  }>('/export/history'),

  getExport: (exportId: string) => request<{
    success: boolean;
    export: ExportRecord;
  }>(`/export/${exportId}`),

  download: (fileName: string) => {
    window.open(`${API_BASE}/export/download/${fileName}`, '_blank');
  },
};
