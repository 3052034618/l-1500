import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { TrendChart, BarChartSimple } from '../components/Charts.jsx';

function Dashboard() {
  const dashboard = useStore(state => state.dashboard);
  const fetchDashboard = useStore(state => state.fetchDashboard);
  const tasks = useStore(state => state.tasks);
  const fetchTasks = useStore(state => state.fetchTasks);

  useEffect(() => {
    fetchDashboard();
    fetchTasks();
  }, []);

  const stats = dashboard?.stats || {};
  const dailyStats = dashboard?.dailyStats || [];

  const statusDistribution = stats.statusCounts
    ? Object.entries(stats.statusCounts).map(([status, count]) => ({
        label: status,
        count
      }))
    : [];

  const StatCard = ({ title, value, subtitle, icon, color, trend }) => (
    <div className="card p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={trend.positive ? 'text-green-600' : 'text-red-600'}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-gray-400">较昨日</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总任务数"
          value={stats.totalTasks || 0}
          subtitle="累计分析任务"
          icon="📊"
          color="bg-blue-100"
        />
        <StatCard
          title="完成率"
          value={`${((stats.completionRate || 0) * 100).toFixed(1)}%`}
          subtitle={`已完成 ${stats.completedTasks || 0} 个`}
          icon="✅"
          color="bg-green-100"
        />
        <StatCard
          title="平均卡方值"
          value={(stats.avgChiSquare || 0).toFixed(4)}
          subtitle="拟合优度"
          icon="📈"
          color="bg-amber-100"
        />
        <StatCard
          title="待审批"
          value={stats.pendingApproval || 0}
          subtitle="等待审批的任务"
          icon="📝"
          color="bg-purple-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">近7天性能趋势</h3>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-green-500"></span> 完成数
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-amber-500"></span> 平均卡方
              </span>
            </div>
          </div>
          {dailyStats.length > 0 ? (
            <TrendChart data={dailyStats} height={280} />
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400">
              暂无数据
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">任务状态分布</h3>
          {statusDistribution.length > 0 ? (
            <BarChartSimple 
              data={statusDistribution.map(s => ({
                ...s,
                label: s.label.replace(/_/g, '\n').substring(0, 8)
              }))}
              dataKey="count"
              name="任务数"
              color="#0ea5e9"
              height={280}
            />
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-400">
              暂无数据
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">最近任务</h3>
            <Link to="/tasks" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-3">
            {tasks.slice(0, 5).map(task => (
              <div 
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-lg">
                    🧪
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{task.name}</p>
                    <p className="text-xs text-gray-500">{task.materialName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={task.status} />
                  <Link 
                    to={`/tasks/${task.id}`}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    详情 →
                  </Link>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                暂无任务
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">预警信息</h3>
            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
              {stats.needsReview || 0} 条待复核
            </span>
          </div>
          <div className="space-y-2">
            {tasks.filter(t => t.needsReview).slice(0, 5).map(task => (
              <div key={task.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{task.name}</p>
                    <p className="text-xs text-amber-600">
                      {(task.warnings || []).length} 个预警，需要复核
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {tasks.filter(t => t.needsReview).length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                ✅ 暂无预警
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5 text-center">
          <div className="text-3xl mb-2">⚡</div>
          <p className="font-semibold text-gray-800">实时处理</p>
          <p className="text-xs text-gray-500 mt-1">FFT快速傅里叶变换</p>
        </div>
        <div className="card p-5 text-center">
          <div className="text-3xl mb-2">🎯</div>
          <p className="font-semibold text-gray-800">高精度拟合</p>
          <p className="text-xs text-gray-500 mt-1">Levenberg-Marquardt算法</p>
        </div>
        <div className="card p-5 text-center">
          <div className="text-3xl mb-2">🤖</div>
          <p className="font-semibold text-gray-800">智能推荐</p>
          <p className="text-xs text-gray-500 mt-1">基于历史数据的模型推荐</p>
        </div>
        <div className="card p-5 text-center">
          <div className="text-3xl mb-2">🔒</div>
          <p className="font-semibold text-gray-800">两级审批</p>
          <p className="text-xs text-gray-500 mt-1">博士后+负责人双重审核</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
