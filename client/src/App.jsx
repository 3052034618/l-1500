import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import TaskList from './pages/TaskList.jsx';
import TaskDetail from './pages/TaskDetail.jsx';
import Upload from './pages/Upload.jsx';
import Materials from './pages/Materials.jsx';
import Approval from './pages/Approval.jsx';
import Notifications from './components/Notifications.jsx';
import useStore from './store.js';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fetchDashboard = useStore(state => state.fetchDashboard);
  const fetchNotifications = useStore(state => state.fetchNotifications);
  const dashboard = useStore(state => state.dashboard);

  useEffect(() => {
    fetchDashboard();
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchDashboard();
      fetchNotifications();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/', label: '综合看板', icon: '📊' },
    { path: '/tasks', label: '任务管理', icon: '📋' },
    { path: '/upload', label: '数据上传', icon: '📤' },
    { path: '/approval', label: '审批中心', icon: '✅' },
    { path: '/materials', label: '材料数据库', icon: '🧪' }
  ];

  const pendingApproval = dashboard?.pendingApproval || 0;
  const needsReview = dashboard?.needsReview || 0;

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col`}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center text-white font-bold text-lg">
                THz
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="font-bold text-gray-800 text-sm">太赫兹光谱平台</h1>
                  <p className="text-xs text-gray-500">高精度分析系统</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                end={item.path === '/'}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.label === '审批中心' && pendingApproval > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingApproval}
                  </span>
                )}
                {sidebarOpen && item.label === '任务管理' && needsReview > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {needsReview}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-gray-200">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 text-sm py-2"
            >
              {sidebarOpen ? '◀ 收起' : '▶'}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">高精度太赫兹时域光谱模拟与材料参数提取平台</h2>
                <p className="text-sm text-gray-500">
                  实时信号处理 · 智能模型拟合 · 高精度参数提取</p>
              </div>
              <div className="flex items-center gap-4">
                <Notifications />
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
                    管
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-gray-700">管理员</p>
                    <p className="text-xs text-gray-500">系统管理员</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<TaskList />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/approval" element={<Approval />} />
              <Route path="/materials" element={<Materials />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
