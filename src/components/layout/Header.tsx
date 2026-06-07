import { useAppStore } from '@/store';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': '异常概览',
  '/import': '数据导入',
  '/mapping': '字段映射配置',
  '/rules': '分析规则配置',
  '/anomalies': '异常明细',
  '/history': '运行历史',
  '/export': '报告导出',
};

export const Header = () => {
  const location = useLocation();
  const { currentRun } = useAppStore();
  
  const title = pageTitles[location.pathname] || '售后退货异常分析';

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
          {title}
        </h2>
        {currentRun && (
          <p className="text-sm text-gray-500 mt-1">
            最后运行: {new Date(currentRun.completedAt).toLocaleString()}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {currentRun && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700 font-medium">
              运行 ID: {currentRun.id.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
