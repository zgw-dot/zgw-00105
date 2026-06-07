import { generateId, now, parseDate, daysBetween } from '../utils/common';
import type {
  AnalysisRules,
  AnomalyType,
  AnomalyGroup,
  AnomalyItem,
  Severity,
  AnalysisSummary,
  ANOMALY_TYPE_LABELS,
} from '../../shared';

interface MappedData {
  orders: any[];
  returns: any[];
  quality: any[];
}

interface DetectionContext {
  rules: AnalysisRules;
  data: MappedData;
}

interface DetectionStrategy {
  type: AnomalyType;
  detect: (context: DetectionContext) => AnomalyItem[];
}

const getSeverity = (type: AnomalyType, value: number): Severity => {
  if (type === 'overdue') {
    if (value >= 30) return 'high';
    if (value >= 15) return 'medium';
    return 'low';
  }
  if (type === 'duplicate') {
    if (value >= 3) return 'high';
    if (value >= 2) return 'medium';
    return 'low';
  }
  if (type === 'conflict') {
    return 'high';
  }
  return 'low';
};

const overdueStrategy: DetectionStrategy = {
  type: 'overdue',
  detect: ({ rules, data }) => {
    const anomalies: AnomalyItem[] = [];
    const { overdueDays } = rules;
    
    const orderMap = new Map(data.orders.map(o => [o.orderId, o]));
    
    for (const ret of data.returns) {
      const order = orderMap.get(ret.orderId);
      if (!order) continue;
      
      const returnDate = parseDate(ret.returnDate);
      const orderDate = parseDate(order.orderDate);
      
      if (!returnDate || !orderDate) continue;
      
      const days = daysBetween(returnDate, orderDate);
      if (days > overdueDays) {
        anomalies.push({
          id: generateId(),
          orderId: ret.orderId,
          returnId: ret.returnId,
          anomalyType: 'overdue',
          description: `退货超期 ${days} 天（阈值：${overdueDays} 天）`,
          severity: getSeverity('overdue', days),
          daysOverdue: days,
          rawData: {
            order,
            return: ret,
          },
          createdAt: now(),
        });
      }
    }
    
    return anomalies;
  },
};

const duplicateStrategy: DetectionStrategy = {
  type: 'duplicate',
  detect: ({ rules, data }) => {
    const anomalies: AnomalyItem[] = [];
    const { duplicateReturnWindow } = rules;
    
    const returnsByOrder = new Map<string, any[]>();
    for (const ret of data.returns) {
      if (!returnsByOrder.has(ret.orderId)) {
        returnsByOrder.set(ret.orderId, []);
      }
      returnsByOrder.get(ret.orderId)!.push(ret);
    }
    
    const orderMap = new Map(data.orders.map(o => [o.orderId, o]));
    
    for (const [orderId, returns] of returnsByOrder) {
      if (returns.length < 2) continue;
      
      returns.sort((a, b) => {
        const da = parseDate(a.returnDate)?.getTime() || 0;
        const db = parseDate(b.returnDate)?.getTime() || 0;
        return da - db;
      });
      
      const windowReturns: any[] = [];
      
      for (let i = 0; i < returns.length; i++) {
        const current = returns[i];
        const currentDate = parseDate(current.returnDate);
        if (!currentDate) continue;
        
        windowReturns.length = 0;
        windowReturns.push(current);
        
        for (let j = i + 1; j < returns.length; j++) {
          const next = returns[j];
          const nextDate = parseDate(next.returnDate);
          if (!nextDate) continue;
          
          const diff = daysBetween(currentDate, nextDate);
          if (diff <= duplicateReturnWindow) {
            windowReturns.push(next);
          }
        }
        
        if (windowReturns.length >= 2) {
          const count = windowReturns.length;
          anomalies.push({
            id: generateId(),
            orderId,
            returnId: windowReturns[0].returnId,
            anomalyType: 'duplicate',
            description: `${duplicateReturnWindow} 天内重复退货 ${count} 次`,
            severity: getSeverity('duplicate', count),
            duplicateCount: count,
            rawData: {
              order: orderMap.get(orderId),
              return: windowReturns[0],
            },
            createdAt: now(),
          });
          
          i += windowReturns.length - 1;
        }
      }
    }
    
    return anomalies;
  },
};

const conflictStrategy: DetectionStrategy = {
  type: 'conflict',
  detect: ({ rules, data }) => {
    const anomalies: AnomalyItem[] = [];
    const { qualityConflictTypes } = rules;
    
    const returnsByOrder = new Map(data.returns.map(r => [r.orderId, r]));
    const orderMap = new Map(data.orders.map(o => [o.orderId, o]));
    
    for (const q of data.quality) {
      if (!q.result || q.result !== '不合格') continue;
      
      const defectType = q.defectType || '';
      if (!qualityConflictTypes.includes(defectType)) continue;
      
      const ret = returnsByOrder.get(q.orderId);
      if (!ret) continue;
      
      if (ret.status === '已拒绝') continue;
      
      anomalies.push({
        id: generateId(),
        orderId: q.orderId,
        returnId: ret.returnId,
        qualityId: q.qualityId,
        anomalyType: 'conflict',
        description: `质检冲突：${defectType}，但退货状态为 ${ret.status}`,
        severity: getSeverity('conflict', 1),
        conflictType: defectType,
        rawData: {
          order: orderMap.get(q.orderId),
          return: ret,
          quality: q,
        },
        createdAt: now(),
      });
    }
    
    return anomalies;
  },
};

const strategies: DetectionStrategy[] = [
  overdueStrategy,
  duplicateStrategy,
  conflictStrategy,
];

export const detectAnomalies = (
  rules: AnalysisRules,
  orders: any[],
  returns: any[],
  quality: any[]
): {
  groups: AnomalyGroup[];
  summary: AnalysisSummary;
} => {
  const context: DetectionContext = {
    rules,
    data: { orders, returns, quality },
  };
  
  const allAnomalies: AnomalyItem[] = [];
  const groups: AnomalyGroup[] = [];
  
  for (const strategy of strategies) {
    const items = strategy.detect(context);
    allAnomalies.push(...items);
    
    groups.push({
      type: strategy.type,
      count: items.length,
      description: getGroupDescription(strategy.type, rules),
      items,
    });
  }
  
  const summary: AnalysisSummary = {
    totalOrders: orders.length,
    totalReturns: returns.length,
    totalQuality: quality.length,
    totalAnomalies: allAnomalies.length,
    anomalyByType: {
      overdue: groups.find(g => g.type === 'overdue')?.count || 0,
      duplicate: groups.find(g => g.type === 'duplicate')?.count || 0,
      conflict: groups.find(g => g.type === 'conflict')?.count || 0,
    },
    badRowCount: 0,
    processedAt: now(),
  };
  
  return { groups, summary };
};

const getGroupDescription = (type: AnomalyType, rules: AnalysisRules): string => {
  switch (type) {
    case 'overdue':
      return `退货周期超过 ${rules.overdueDays} 天的异常订单`;
    case 'duplicate':
      return `${rules.duplicateReturnWindow} 天内同一订单多次退货`;
    case 'conflict':
      return `质检结果为 ${rules.qualityConflictTypes.join('/')} 但退货未被拒绝`;
    default:
      return '';
  }
};

export const compareRuns = (
  summary1: AnalysisSummary,
  summary2: AnalysisSummary
) => {
  return {
    run1Summary: summary1,
    run2Summary: summary2,
    diff: {
      totalAnomalies: summary1.totalAnomalies - summary2.totalAnomalies,
      anomalyByType: {
        overdue: summary1.anomalyByType.overdue - summary2.anomalyByType.overdue,
        duplicate: summary1.anomalyByType.duplicate - summary2.anomalyByType.duplicate,
        conflict: summary1.anomalyByType.conflict - summary2.anomalyByType.conflict,
      },
    },
  };
};
