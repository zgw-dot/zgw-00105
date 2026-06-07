import { parseDate } from '../utils/common';
import type {
  FileType,
  ValidationError,
  ErrorType,
  BadRow,
  SYSTEM_FIELDS,
} from '../../shared';
import { generateId, now } from '../utils/common';

type SystemFieldsType = typeof SYSTEM_FIELDS;

export const REQUIRED_FIELDS: Record<FileType, string[]> = {
  order: ['orderId', 'orderDate'],
  return: ['returnId', 'orderId', 'returnDate'],
  quality: ['qualityId', 'orderId', 'inspectDate'],
};

export interface ValidationResult {
  valid: boolean;
  rejectAll: boolean;
  rejectReason?: string;
  errors: ValidationError[];
  badRows: BadRow[];
  validData: any[];
}

export const validateStructure = (
  fileType: FileType,
  columns: string[],
  mapping: Record<string, string>
): { valid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const requiredFields = REQUIRED_FIELDS[fileType];
  
  const mappedColumns = Object.keys(mapping);
  const mappedSystemFields = Object.values(mapping);
  
  for (const required of requiredFields) {
    if (!mappedSystemFields.includes(required)) {
      const csvColumn = mappedColumns.find(col => mapping[col] === required);
      if (!csvColumn) {
        errors.push({
          errorType: 'missing_column',
          errorMessage: `缺少必需字段映射: ${required}`,
          column: required,
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateRowData = (
  fileType: FileType,
  data: any[],
  mapping: Record<string, string>,
  enableAutoIsolate: boolean = true
): ValidationResult => {
  const errors: ValidationError[] = [];
  const badRows: BadRow[] = [];
  const validData: any[] = [];
  const seenOrderIds = new Set<string>();
  
  const orderIdColumn = Object.keys(mapping).find(k => mapping[k] === 'orderId');
  const dateColumns: Record<FileType, string[]> = {
    order: ['orderDate'],
    return: ['returnDate'],
    quality: ['inspectDate'],
  };
  
  const amountColumn = Object.keys(mapping).find(k => mapping[k] === 'amount');
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowErrors: ValidationError[] = [];
    let isBadRow = false;
    
    if (orderIdColumn && row[orderIdColumn]) {
      const orderId = String(row[orderIdColumn]).trim();
      if (seenOrderIds.has(orderId) && fileType === 'order') {
        const error: ValidationError = {
          rowIndex: i,
          errorType: 'duplicate_order',
          errorMessage: `重复订单号: ${orderId}`,
          column: orderIdColumn,
          value: orderId,
        };
        rowErrors.push(error);
        errors.push(error);
        isBadRow = true;
      }
      seenOrderIds.add(orderId);
    }
    
    for (const systemDateField of dateColumns[fileType]) {
      const csvDateColumn = Object.keys(mapping).find(k => mapping[k] === systemDateField);
      if (csvDateColumn && row[csvDateColumn]) {
        const dateValue = String(row[csvDateColumn]).trim();
        if (dateValue && !parseDate(dateValue)) {
          const error: ValidationError = {
            rowIndex: i,
            errorType: 'invalid_date',
            errorMessage: `日期格式错误: ${dateValue}`,
            column: csvDateColumn,
            value: dateValue,
          };
          rowErrors.push(error);
          errors.push(error);
          isBadRow = true;
        }
      }
    }
    
    if (amountColumn && row[amountColumn] !== undefined && row[amountColumn] !== null) {
      const amountValue = String(row[amountColumn]).trim();
      if (amountValue && isNaN(Number(amountValue))) {
        const error: ValidationError = {
          rowIndex: i,
          errorType: 'invalid_value',
          errorMessage: `非法数值: ${amountValue}`,
          column: amountColumn,
          value: amountValue,
        };
        rowErrors.push(error);
        errors.push(error);
        isBadRow = true;
      }
    }
    
    if (isBadRow && enableAutoIsolate) {
      badRows.push({
        id: generateId(),
        fileType,
        rowIndex: i,
        rowData: { ...row },
        errorType: rowErrors[0].errorType as ErrorType,
        errorMessage: rowErrors.map(e => e.errorMessage).join('; '),
        isolationReason: '数据格式校验失败，已自动隔离',
        handled: false,
        createdAt: now(),
      } as BadRow);
    } else {
      validData.push(row);
    }
  }
  
  return {
    valid: badRows.length === 0,
    rejectAll: false,
    errors,
    badRows,
    validData,
  };
};

export const validateAndMapData = (
  fileType: FileType,
  data: any[],
  mapping: Record<string, string>
): { mappedData: any[]; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];
  const mappedData: any[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const mappedRow: any = {};
    let rowValid = true;
    
    for (const csvColumn of Object.keys(mapping)) {
      const systemField = mapping[csvColumn];
      const value = row[csvColumn];
      
      if (value === undefined || value === null || String(value).trim() === '') {
        if (REQUIRED_FIELDS[fileType].includes(systemField)) {
          errors.push({
            rowIndex: i,
            errorType: 'missing_column',
            errorMessage: `必需字段为空: ${systemField}`,
            column: csvColumn,
          });
          rowValid = false;
        }
      }
      
      if (systemField.endsWith('Date') && value) {
        const date = parseDate(String(value));
        if (date) {
          mappedRow[systemField] = date.toISOString();
        } else {
          mappedRow[systemField] = value;
        }
      } else if (systemField === 'amount' && value !== undefined && value !== null) {
        const num = Number(value);
        mappedRow[systemField] = isNaN(num) ? value : num;
      } else {
        mappedRow[systemField] = value;
      }
    }
    
    if (rowValid) {
      mappedData.push(mappedRow);
    }
  }
  
  return { mappedData, errors };
};

export const checkRejectAllCondition = (
  totalRows: number,
  badRowCount: number
): { rejectAll: boolean; reason?: string } => {
  const badRate = badRowCount / totalRows;
  if (badRate > 0.5) {
    return {
      rejectAll: true,
      reason: `坏行比例过高 (${(badRate * 100).toFixed(1)}%)，超过50%阈值，整批拒绝`,
    };
  }
  return { rejectAll: false };
};
