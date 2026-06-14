import { useEffect, useState } from 'react';
import useStore from '../store.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { Link } from 'react-router-dom';

function Approval() {
  const tasks = useStore(state => state.tasks);
  const fetchTasks = useStore(state => state.fetchTasks);
  const approveTask = useStore(state => state.approveTask);
  const rejectTask = useStore(state => state.rejectTask);
  
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [comment, setComment] = useState('');
  const [approveLevel, setApproveLevel] = useState(1);

  useEffect(() => {
    fetchTasks();
  }, []);

  const pendingTasks = tasks.filter(t => 
    t.status === 'approval_1' || t.status === 'approval_2'
  );
  
  const approvedTasks = tasks.filter(t => t.status === 'archived');
  const rejectedTasks = tasks.filter(t => 
    t.approval1?.status === 'rejected' || t.approval2?.status === 'rejected'
  );

  const displayTasks = activeTab === 'pending' ? pendingTasks :
                       activeTab === 'approved' ? approvedTasks :
                       rejectedTasks;

  const handleApprove = () => {
    if (selectedTask) {
      approveTask(selectedTask.id, approveLevel, '审批人', comment);
      setShowApproveModal(false);
      setComment('');
      setSelectedTask(null);
    }
  };

  const handleReject = () => {
    if (selectedTask) {
      rejectTask(selectedTask.id, approveLevel, '审批人', comment);
      setShowApproveModal(false);
      setComment('');
      setSelectedTask(null);
    }
  };

  const openApproval = (task, level) => {
    setSelectedTask(task);
    setApproveLevel(level);
    setShowApproveModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">审批中心</h2>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingTasks.length}</p>
            <p className="text-xs text-gray-500">待审批</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{approvedTasks.length}</p>
            <p className="text-xs text-gray-500">已通过</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-200">
          {[
            { id: 'pending', label: '待审批', count: pendingTasks.length },
            { id: 'approved', label: '已通过', count: approvedTasks.length },
            { id: 'rejected', label: '已驳回', count: rejectedTasks.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {displayTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {activeTab === 'pending' ? '暂无待审批任务' : 
               activeTab === 'approved' ? '暂无已通过任务' : '暂无已驳回任务'}
            </div>
          ) : (
            <div className="space-y-3">
              {displayTasks.map(task => (
                <div 
                  key={task.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        📝
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">{task.name}</h4>
                        <p className="text-sm text-gray-500">{task.materialName} · {task.batchNumber}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <StatusBadge status={task.status} />
                          {task.status === 'approval_1' && (
                            <span className="text-xs text-cyan-600">一级审批</span>
                          )}
                          {task.status === 'approval_2' && (
                            <span className="text-xs text-teal-600">二级审批</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link 
                        to={`/tasks/${task.id}`}
                        className="btn-secondary text-sm py-1.5"
                      >
                        查看详情
                      </Link>
                      {(task.status === 'approval_1' || task.status === 'approval_2') && (
                        <>
                          <button 
                            onClick={() => openApproval(task, task.status === 'approval_1' ? 1 : 2)}
                            className="btn-success text-sm py-1.5"
                          >
                            审批
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {task.extractedParams && (
                    <div className="mt-4 grid grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-500">卡方值</p>
                        <p className="font-medium text-gray-800">
                          {task.extractedParams.chiSquare?.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">R² (实部)</p>
                        <p className="font-medium text-green-600">
                          {task.extractedParams.rSquaredReal?.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ε∞</p>
                        <p className="font-medium text-gray-800">
                          {task.extractedParams.epsilonInf?.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">拟合模型</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {task.currentModel}
                        </p>
                      </div>
                    </div>
                  )}

                  {task.warnings && task.warnings.length > 0 && (
                    <div className="mt-3 p-2 bg-amber-50 rounded-lg">
                      <p className="text-xs text-amber-700">
                        ⚠️ 存在 {task.warnings.length} 个预警，请注意审核
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4">审批说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-cyan-50 rounded-lg">
            <h4 className="font-medium text-cyan-800 mb-2">一级审批 (博士后)</h4>
            <ul className="text-cyan-700 space-y-1 text-xs">
              <li>• 验证拟合优度（卡方值、决定系数）</li>
              <li>• 检查残差分布是否合理</li>
              <li>• 确认数据质量和去噪效果</li>
              <li>• 评估参数物理意义</li>
            </ul>
          </div>
          <div className="p-4 bg-teal-50 rounded-lg">
            <h4 className="font-medium text-teal-800 mb-2">二级审批 (负责人)</h4>
            <ul className="text-teal-700 space-y-1 text-xs">
              <li>• 确认参数物理合理性</li>
              <li>• 与文献值对比验证</li>
              <li>• 检查实验条件一致性</li>
              <li>• 审批通过后自动归档</li>
            </ul>
          </div>
        </div>
      </div>

      {showApproveModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {approveLevel === 1 ? '一级审批' : '二级审批'} - {selectedTask.name}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">材料：</span>
                    <span className="text-gray-800">{selectedTask.materialName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">批次：</span>
                    <span className="text-gray-800">{selectedTask.batchNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">拟合模型：</span>
                    <span className="text-gray-800">{selectedTask.currentModel}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">卡方值：</span>
                    <span className="text-gray-800 font-mono">
                      {selectedTask.extractedParams?.chiSquare?.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="label-text">审批意见</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input-field h-24 resize-none"
                  placeholder="请输入审批意见..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowApproveModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button 
                onClick={handleReject}
                className="btn-danger"
              >
                驳回
              </button>
              <button 
                onClick={handleApprove}
                className="btn-success"
              >
                通过
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Approval;
