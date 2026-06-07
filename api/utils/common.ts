import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

export const generateId = (): string => randomUUID();

export const now = (): string => new Date().toISOString();

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}\/\d{2}\/\d{2}$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{8}$/,
  ];
  
  const matched = formats.some(f => f.test(trimmed));
  if (!matched) return null;
  
  let normalized = trimmed;
  
  if (/^\d{2}-\d{2}-\d{4}$/.test(normalized)) {
    const [d, m, y] = normalized.split('-');
    normalized = `${y}-${m}-${d}`;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
    const [d, m, y] = normalized.split('/');
    normalized = `${y}-${m}-${d}`;
  } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) {
    normalized = normalized.replace(/\//g, '-');
  } else if (/^\d{8}$/.test(normalized)) {
    normalized = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
  }
  
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return null;
  
  return date;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const daysBetween = (date1: Date, date2: Date): number => {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diff / msPerDay);
};

export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

export const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

export const writeJsonFile = async (filePath: string, data: any): Promise<void> => {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

export const readCsvFile = async (filePath: string): Promise<{ columns: string[]; data: any[] }> => {
  const content = await fs.readFile(filePath, 'utf-8');
  const result = Papa.parse<any>(content, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = result.meta.fields || [];
  const trimmedFields = fields.map(f => f.trim());
  return {
    columns: trimmedFields,
    data: result.data,
  };
};

export const writeCsvFile = async (filePath: string, data: any[], columns?: string[]): Promise<void> => {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const csv = Papa.unparse(data, { columns });
  await fs.writeFile(filePath, csv, 'utf-8');
};

export const listFiles = async (dirPath: string, pattern?: string): Promise<string[]> => {
  try {
    const files = await fs.readdir(dirPath);
    if (pattern) {
      return files.filter(f => f.endsWith(pattern));
    }
    return files;
  } catch {
    return [];
  }
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const getFileNameFromPath = (filePath: string): string => {
  return path.basename(filePath);
};

export const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-_.]/g, '_');
};
