import path from 'path';
import fs from 'fs/promises';
import {
  readJsonFile,
  writeJsonFile,
  readCsvFile,
  writeCsvFile,
  listFiles,
  fileExists,
  ensureDir,
  generateId,
  now,
} from '../utils/common';
import type {
  FieldMapping,
  RulesVersion,
  RunHistory,
  AnomalyGroup,
  BadRow,
  ExportRecord,
  FileType,
} from '../../shared';

const DATA_DIR = path.join(process.cwd(), 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const MAPPINGS_DIR = path.join(DATA_DIR, 'mappings');
const RULES_DIR = path.join(DATA_DIR, 'rules');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const ANOMALIES_DIR = path.join(DATA_DIR, 'anomalies');
const BADROWS_DIR = path.join(DATA_DIR, 'badrows');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
const SAMPLE_DIR = path.join(process.cwd(), 'sample-data');

export const initStorage = async (): Promise<void> => {
  await ensureDir(RAW_DIR);
  await ensureDir(MAPPINGS_DIR);
  await ensureDir(RULES_DIR);
  await ensureDir(HISTORY_DIR);
  await ensureDir(ANOMALIES_DIR);
  await ensureDir(BADROWS_DIR);
  await ensureDir(EXPORTS_DIR);
  await ensureDir(SAMPLE_DIR);
};

export const saveRawFile = async (
  fileType: FileType,
  fileName: string,
  data: any[],
  columns: string[]
): Promise<string> => {
  const fileId = generateId();
  const safeName = fileName.replace(/\.csv$/i, '');
  const filePath = path.join(RAW_DIR, `${fileType}_${safeName}_${fileId}.csv`);
  await writeCsvFile(filePath, data, columns);
  
  const metaPath = path.join(RAW_DIR, `${fileType}_${safeName}_${fileId}.meta.json`);
  await writeJsonFile(metaPath, {
    fileId,
    fileType,
    fileName,
    columns,
    rowCount: data.length,
    createdAt: now(),
  });
  
  return fileId;
};

export const getRawFile = async (
  fileId: string
): Promise<{ data: any[]; columns: string[]; meta: any } | null> => {
  const files = await listFiles(RAW_DIR, '.meta.json');
  for (const f of files) {
    const meta = await readJsonFile<any>(path.join(RAW_DIR, f));
    if (meta && meta.fileId === fileId) {
      const csvFile = f.replace('.meta.json', '.csv');
      const csvPath = path.join(RAW_DIR, csvFile);
      if (await fileExists(csvPath)) {
        const { data, columns } = await readCsvFile(csvPath);
        return { data, columns, meta };
      }
    }
  }
  return null;
};

export const saveFieldMapping = async (
  name: string,
  mapping: FieldMapping['mapping']
): Promise<string> => {
  const id = generateId();
  const fieldMapping: FieldMapping = {
    id,
    name,
    mapping,
    createdAt: now(),
  };
  const filePath = path.join(MAPPINGS_DIR, `${id}.json`);
  await writeJsonFile(filePath, fieldMapping);
  return id;
};

export const getFieldMappings = async (): Promise<FieldMapping[]> => {
  const files = await listFiles(MAPPINGS_DIR, '.json');
  const mappings: FieldMapping[] = [];
  for (const f of files) {
    const mapping = await readJsonFile<FieldMapping>(path.join(MAPPINGS_DIR, f));
    if (mapping) {
      mappings.push(mapping);
    }
  }
  return mappings.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getFieldMapping = async (id: string): Promise<FieldMapping | null> => {
  const filePath = path.join(MAPPINGS_DIR, `${id}.json`);
  return readJsonFile<FieldMapping>(filePath);
};

export const saveRules = async (rules: RulesVersion['rules']): Promise<string> => {
  const id = generateId();
  const version: RulesVersion = {
    id,
    rules,
    createdAt: now(),
  };
  const filePath = path.join(RULES_DIR, `${id}.json`);
  await writeJsonFile(filePath, version);
  return id;
};

export const getRulesVersions = async (): Promise<RulesVersion[]> => {
  const files = await listFiles(RULES_DIR, '.json');
  const versions: RulesVersion[] = [];
  for (const f of files) {
    const version = await readJsonFile<RulesVersion>(path.join(RULES_DIR, f));
    if (version) {
      versions.push(version);
    }
  }
  return versions.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getRules = async (id: string): Promise<RulesVersion | null> => {
  const filePath = path.join(RULES_DIR, `${id}.json`);
  return readJsonFile<RulesVersion>(filePath);
};

export const saveRunHistory = async (history: RunHistory): Promise<void> => {
  const filePath = path.join(HISTORY_DIR, `${history.id}.json`);
  await writeJsonFile(filePath, history);
};

export const getRunHistory = async (): Promise<RunHistory[]> => {
  const files = await listFiles(HISTORY_DIR, '.json');
  const history: RunHistory[] = [];
  for (const f of files) {
    const h = await readJsonFile<RunHistory>(path.join(HISTORY_DIR, f));
    if (h) {
      history.push(h);
    }
  }
  return history.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getRun = async (id: string): Promise<RunHistory | null> => {
  const filePath = path.join(HISTORY_DIR, `${id}.json`);
  return readJsonFile<RunHistory>(filePath);
};

export const saveAnomalies = async (
  runId: string,
  anomalies: AnomalyGroup[]
): Promise<void> => {
  const filePath = path.join(ANOMALIES_DIR, `${runId}.json`);
  await writeJsonFile(filePath, anomalies);
};

export const getAnomalies = async (runId: string): Promise<AnomalyGroup[] | null> => {
  const filePath = path.join(ANOMALIES_DIR, `${runId}.json`);
  return readJsonFile<AnomalyGroup[]>(filePath);
};

export const saveBadRows = async (runId: string, badRows: BadRow[]): Promise<void> => {
  const filePath = path.join(BADROWS_DIR, `${runId}.json`);
  await writeJsonFile(filePath, badRows);
};

export const getBadRows = async (runId: string): Promise<BadRow[] | null> => {
  const filePath = path.join(BADROWS_DIR, `${runId}.json`);
  return readJsonFile<BadRow[]>(filePath);
};

export const saveExport = async (record: ExportRecord): Promise<void> => {
  const filePath = path.join(EXPORTS_DIR, `${record.id}.json`);
  await writeJsonFile(filePath, record);
};

export const getExports = async (): Promise<ExportRecord[]> => {
  const files = await listFiles(EXPORTS_DIR, '.json');
  const exports: ExportRecord[] = [];
  for (const f of files) {
    const e = await readJsonFile<ExportRecord>(path.join(EXPORTS_DIR, f));
    if (e) {
      exports.push(e);
    }
  }
  return exports.sort((a, b) => 
    new Date(b.metadata.exportedAt).getTime() - new Date(a.metadata.exportedAt).getTime()
  );
};

export const getExport = async (id: string): Promise<ExportRecord | null> => {
  const filePath = path.join(EXPORTS_DIR, `${id}.json`);
  return readJsonFile<ExportRecord>(filePath);
};

export const saveExportFile = async (
  fileName: string,
  content: string,
  format: string
): Promise<string> => {
  const filePath = path.join(EXPORTS_DIR, fileName);
  await ensureDir(EXPORTS_DIR);
  await fs.writeFile(filePath, content, 'utf-8');
  return `/api/export/download/${fileName}`;
};

export const getExportFilePath = (fileName: string): string => {
  return path.join(EXPORTS_DIR, fileName);
};

export const saveSampleData = async (
  fileType: FileType,
  data: any[],
  columns: string[]
): Promise<void> => {
  const filePath = path.join(SAMPLE_DIR, `${fileType}.csv`);
  await writeCsvFile(filePath, data, columns);
};

export const getSampleData = async (
  fileType: FileType
): Promise<{ data: any[]; columns: string[] } | null> => {
  const filePath = path.join(SAMPLE_DIR, `${fileType}.csv`);
  if (await fileExists(filePath)) {
    return readCsvFile(filePath);
  }
  return null;
};
