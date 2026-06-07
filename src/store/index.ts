import { create } from 'zustand';
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
  AnomalyType,
  ValidationError,
} from '../../shared';

interface UploadedFile {
  fileId: string;
  fileType: FileType;
  fileName: string;
  columns: string[];
  data: any[];
  preview: any[];
  rowCount: number;
  errors?: ValidationError[];
  badRows?: BadRow[];
  validData?: any[];
}

interface AppState {
  uploadedFiles: Record<FileType, UploadedFile | null>;
  fieldMappings: FieldMapping[];
  currentMappingId: string | null;
  currentRules: AnalysisRules | null;
  rulesVersions: { id: string; rules: AnalysisRules; createdAt: string }[];
  currentRun: RunHistory | null;
  currentAnomalies: AnomalyGroup[];
  currentBadRows: BadRow[];
  runHistory: RunHistory[];
  previousRun: RunHistory | null;
  comparison: AnalysisSummaryDiff | null;
  exportHistory: ExportRecord[];
  selectedAnomalyType: AnomalyType | null;
  selectedAnomalyItem: AnomalyGroup['items'][0] | null;
  detailDrawerOpen: boolean;
  loading: boolean;
  error: string | null;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;

  setUploadedFile: (fileType: FileType, file: UploadedFile | null) => void;
  clearUploadedFiles: () => void;
  setFieldMappings: (mappings: FieldMapping[]) => void;
  setCurrentMappingId: (id: string | null) => void;
  setCurrentRules: (rules: AnalysisRules | null) => void;
  setRulesVersions: (versions: { id: string; rules: AnalysisRules; createdAt: string }[]) => void;
  setCurrentRun: (run: RunHistory | null) => void;
  setCurrentAnomalies: (anomalies: AnomalyGroup[]) => void;
  setCurrentBadRows: (badRows: BadRow[]) => void;
  setRunHistory: (history: RunHistory[]) => void;
  setPreviousRun: (run: RunHistory | null) => void;
  setComparison: (comparison: AnalysisSummaryDiff | null) => void;
  setExportHistory: (history: ExportRecord[]) => void;
  setSelectedAnomalyType: (type: AnomalyType | null) => void;
  setSelectedAnomalyItem: (item: AnomalyGroup['items'][0] | null) => void;
  setDetailDrawerOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
  resetAnalysis: () => void;
}

const DEFAULT_RULES: AnalysisRules = {
  overdueDays: 15,
  duplicateReturnWindow: 30,
  qualityConflictTypes: ['性能故障', '外观瑕疵', '包装问题'],
  enableAutoIsolate: true,
};

export const useAppStore = create<AppState>((set) => ({
  uploadedFiles: {
    order: null,
    return: null,
    quality: null,
  },
  fieldMappings: [],
  currentMappingId: null,
  currentRules: DEFAULT_RULES,
  rulesVersions: [],
  currentRun: null,
  currentAnomalies: [],
  currentBadRows: [],
  runHistory: [],
  previousRun: null,
  comparison: null,
  exportHistory: [],
  selectedAnomalyType: null,
  selectedAnomalyItem: null,
  detailDrawerOpen: false,
  loading: false,
  error: null,
  notification: null,

  setUploadedFile: (fileType, file) =>
    set((state) => ({
      uploadedFiles: {
        ...state.uploadedFiles,
        [fileType]: file,
      },
    })),

  clearUploadedFiles: () =>
    set({
      uploadedFiles: { order: null, return: null, quality: null },
    }),

  setFieldMappings: (mappings) => set({ fieldMappings: mappings }),
  setCurrentMappingId: (id) => set({ currentMappingId: id }),
  setCurrentRules: (rules) => set({ currentRules: rules }),
  setRulesVersions: (versions) => set({ rulesVersions: versions }),
  setCurrentRun: (run) => set({ currentRun: run }),
  setCurrentAnomalies: (anomalies) => set({ currentAnomalies: anomalies }),
  setCurrentBadRows: (badRows) => set({ currentBadRows: badRows }),
  setRunHistory: (history) => set({ runHistory: history }),
  setPreviousRun: (run) => set({ previousRun: run }),
  setComparison: (comparison) => set({ comparison }),
  setExportHistory: (history) => set({ exportHistory: history }),
  setSelectedAnomalyType: (type) => set({ selectedAnomalyType: type }),
  setSelectedAnomalyItem: (item) => set({ selectedAnomalyItem: item }),
  setDetailDrawerOpen: (open) => set({ detailDrawerOpen: open }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  showNotification: (message, type) => {
    set({ notification: { message, type } });
    setTimeout(() => set({ notification: null }), 3000);
  },

  clearNotification: () => set({ notification: null }),

  resetAnalysis: () =>
    set({
      currentRun: null,
      currentAnomalies: [],
      currentBadRows: [],
      previousRun: null,
      comparison: null,
      selectedAnomalyType: null,
      selectedAnomalyItem: null,
      detailDrawerOpen: false,
    }),
}));
