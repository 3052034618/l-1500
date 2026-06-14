const TASK_STATE_LABELS = {
  pending_validation: '待校验',
  preprocessing: '预处理中',
  fft: '傅里叶变换中',
  model_fitting: '模型拟合中',
  parameter_extraction: '参数提取中',
  completed: '已完成',
  abnormal: '异常',
  approval_1: '博士后审批',
  approval_2: '负责人审批',
  archived: '已归档',
  suspended: '已暂停'
};

const TASK_STATE_COLORS = {
  pending_validation: 'bg-gray-100 text-gray-700',
  preprocessing: 'bg-blue-100 text-blue-700',
  fft: 'bg-purple-100 text-purple-700',
  model_fitting: 'bg-amber-100 text-amber-700',
  parameter_extraction: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  abnormal: 'bg-red-100 text-red-700',
  approval_1: 'bg-cyan-100 text-cyan-700',
  approval_2: 'bg-teal-100 text-teal-700',
  archived: 'bg-gray-100 text-gray-700',
  suspended: 'bg-orange-100 text-orange-700'
};

function StatusBadge({ status }) {
  const label = TASK_STATE_LABELS[status] || status;
  const colorClass = TASK_STATE_COLORS[status] || 'bg-gray-100 text-gray-700';

  const isProcessing = ['preprocessing', 'fft', 'model_fitting', 'parameter_extraction'].includes(status);

  return (
    <span className={`status-badge ${colorClass} inline-flex items-center gap-1`}>
      {isProcessing && (
        <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot"></span>
      )}
      {label}
    </span>
  );
}

export default StatusBadge;
