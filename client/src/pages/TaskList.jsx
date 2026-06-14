import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { format } from 'date-fns';

function TaskList() {
  const tasks = useStore(state => state.tasks);
  const fetchTasks = useStore(state => state.fetchTasks);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const filters = filter === 'all' ? {} : { status: filter };
    if (filter === 'review') {
      filters.needsReview = true;
    }
    fetchTasks(filters);
  }, [filter]);

  const filteredTasks = tasks.filter(task => 
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.materialName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusFilters = [
    { value: 'all', label: '全部' },
    { value: 'pending_validation', label: '待校验' },
    { value: 'preprocessing', label: '预处理' },
    { value: 'model_fitting', label: '拟合中' },
    { value: 'completed', label: '已完成' },
    { value: 'abnormal', label: '异常' },
    { value: 'review', label: '待复核' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">任务管理</h2>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <span>+</span> 新建任务
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="搜索任务名称或材料..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filter === f.value
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">任务名称</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">材料</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">批次</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTasks.map(task => (
              <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-sm">
                      🧪
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{task.name}</p>
                      {task.needsReview && (
                        <span className="text-xs text-amber-600">⚠️ 待复核</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{task.materialName}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{task.batchNumber || '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(task.createdAt).toLocaleString('zh-CN')}
                </td>
                <td className="px-4 py-3">
                  <Link 
                    to={`/tasks/${task.id}`}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  暂无任务
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TaskList;
