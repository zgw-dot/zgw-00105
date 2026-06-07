import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileUp,
  ArrowRightLeft,
  Settings,
  FileBarChart,
  History,
  Download,
} from 'lucide-react';

const navItems = [
  { path: '/', label: '主看板', icon: LayoutDashboard },
  { path: '/import', label: '数据导入', icon: FileUp },
  { path: '/mapping', label: '字段映射', icon: ArrowRightLeft },
  { path: '/rules', label: '规则配置', icon: Settings },
  { path: '/anomalies', label: '异常明细', icon: FileBarChart },
  { path: '/history', label: '运行历史', icon: History },
  { path: '/export', label: '报告导出', icon: Download },
];

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
          退货异常分析
        </h1>
        <p className="text-slate-400 text-sm mt-1">Return Anomaly Dashboard</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-slate-400 text-xs">系统状态</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-400 text-sm">服务正常</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
