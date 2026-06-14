import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useStore from '../store.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { 
  TimeDomainChart, 
  FrequencyDomainChart, 
  DielectricChart,
  ResidualChart 
} from '../components/Charts.jsx';

const FIT_MODEL_LABELS = {
  drude_lorentz: 'Drude-Lorentz模型',
  cole_cole: 'Cole-Cole模型',
  debye: 'Debye模型',
  maxwell_garnett: 'Maxwell-Garnett模型'
};

function TaskDetail() {
  const { id } = useParams();
  const task = useStore(state => state.currentTask);
  const fetchTask = useStore(state => state.fetchTask);
  const retryTask = useStore(state => state.retryTask);
  const submitApproval = useStore(state => state.submitApproval);
  const exportData = useStore(state => state.exportData);
  const downloadReport = useStore(state => state.downloadReport);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedModel, setSelectedModel] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    fetchTask(id);
    
    const interval = setInterval(() => {
      fetchTask(id);
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  const latestFitting = task.fittingResults?.[task.fittingResults?.length - 1];

  const tabs = [
    { id: 'overview', label: '总览' },
    { id: 'timedomain', label: '时域分析' },
    { id: 'frequency', label: '频域分析' },
    { id: 'dielectric', label: '介电函数' },
    { id: 'fitting', label: '模型拟合' },
    { id: 'approval', label: '审批记录' }
  ];

  const handleRetry = () => {
    if (selectedModel) {
      retryTask(task.id, selectedModel);
      setShowReviewModal(false);
    }
  };

  const handleSubmitApproval = () => {
    submitApproval(task.id);
  };

  const formatValue = (value, unit = '') => {
    if (value === undefined || value === null) return '-';
    if (Math.abs(value) < 0.001 || Math.abs(value) > 10000) {
      return `${value.toExponential(4)} ${unit}`;
    }
    return `${value.toFixed(4)} ${unit}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/tasks" className="text-gray-500 hover:text-gray-700">
            ← 返回
          </Link>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{task.name}</h2>
            <p className="text-sm text-gray-500">
              {task.materialName} · 批次 {task.batchNumber || '未知'}
            </p>
          </div>
          <StatusBadge status={task.status} />
          {task.needsReview && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
              ⚠️ 待复核
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => exportData(task.id, 'json')}
            className="btn-secondary text-sm"
          >
            📤 导出数据
          </button>
          <button 
            onClick={() => downloadReport(task.id)}
            className="btn-primary text-sm"
          >
            📄 生成报告
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">任务信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">任务ID</span>
                  <span className="text-gray-800 font-mono text-xs">{task.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">材料名称</span>
                  <span className="text-gray-800">{task.materialName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">材料类别</span>
                  <span className="text-gray-800">{task.materialCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">批次号</span>
                  <span className="text-gray-800">{task.batchNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">温度</span>
                  <span className="text-gray-800">{task.temperature} K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">湿度</span>
                  <span className="text-gray-800">{task.humidity} %</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">样品厚度</span>
                  <span className="text-gray-800">{(task.thickness * 1000).toFixed(3)} mm</span>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">处理状态</h3>
              <div className="space-y-3">
                {[
                  { step: '数据校验', status: task.status !== 'pending_validation' ? 'done' : 'current' },
                  { step: '信号预处理', status: ['preprocessing', 'fft', 'model_fitting', 'parameter_extraction', 'completed', 'approval_1', 'approval_2', 'archived'].includes(task.status) ? 'done' : task.status === 'preprocessing' ? 'current' : 'pending' },
                  { step: '傅里叶变换', status: ['fft', 'model_fitting', 'parameter_extraction', 'completed', 'approval_1', 'approval_2', 'archived'].includes(task.status) ? 'done' : task.status === 'fft' ? 'current' : 'pending' },
                  { step: '模型拟合', status: ['model_fitting', 'parameter_extraction', 'completed', 'approval_1', 'approval_2', 'archived'].includes(task.status) ? 'done' : task.status === 'model_fitting' ? 'current' : 'pending' },
                  { step: '参数提取', status: ['parameter_extraction', 'completed', 'approval_1', 'approval_2', 'archived'].includes(task.status) ? 'done' : task.status === 'parameter_extraction' ? 'current' : 'pending' },
                  { step: '完成', status: ['completed', 'approval_1', 'approval_2', 'archived'].includes(task.status) ? 'done' : 'pending' }
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      item.status === 'done' ? 'bg-green-500 text-white' :
                      item.status === 'current' ? 'bg-primary-500 text-white animate-pulse' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {item.status === 'done' ? '✓' : index + 1}
                    </div>
                    <span className={`text-sm ${
                      item.status === 'done' ? 'text-green-700' :
                      item.status === 'current' ? 'text-primary-700 font-medium' :
                      'text-gray-400'
                    }`}>
                      {item.step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">拟合结果摘要</h3>
              {task.extractedParams ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">拟合模型</span>
                    <span className="text-gray-800">{FIT_MODEL_LABELS[task.currentModel] || task.currentModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">卡方值</span>
                    <span className={`font-medium ${
                      task.extractedParams.chiSquare < 1 ? 'text-green-600' :
                      task.extractedParams.chiSquare < 5 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {task.extractedParams.chiSquare?.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">R² (实部)</span>
                    <span className="text-green-600 font-medium">
                      {task.extractedParams.rSquaredReal?.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">R² (虚部)</span>
                    <span className="text-green-600 font-medium">
                      {task.extractedParams.rSquaredImag?.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">拟合耗时</span>
                    <span className="text-gray-800">{(task.fittingTime / 1000).toFixed(2)} s</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">ε∞</span>
                    <span className="text-gray-800 font-medium">
                      {task.extractedParams.epsilonInf?.toFixed(4)}
                    </span>
                  </div>
                  {task.extractedParams.carrierConcentration !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">载流子浓度</span>
                      <span className="text-gray-800">
                        {formatValue(task.extractedParams.carrierConcentration, 'cm⁻³')}
                      </span>
                    </div>
                  )}
                  {task.extractedParams.mobility !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">迁移率</span>
                      <span className="text-gray-800">
                        {formatValue(task.extractedParams.mobility, 'cm²/Vs')}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  暂无拟合结果
                </div>
              )}
            </div>
          </div>

          {task.warnings && task.warnings.length > 0 && (
            <div className="card p-5 border-l-4 border-amber-500">
              <h3 className="font-semibold text-amber-700 mb-3">⚠️ 预警信息</h3>
              <div className="space-y-2">
                {task.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                    <span className="text-lg">
                      {warning.level === 'error' ? '🔴' : warning.level === 'warning' ? '🟡' : '🔵'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{warning.type}</p>
                      <p className="text-xs text-gray-600">{warning.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button 
                  onClick={() => setShowReviewModal(true)}
                  className="btn-warning text-sm"
                >
                  🔄 切换模型重新计算
                </button>
                <button 
                  onClick={handleSubmitApproval}
                  className="btn-success text-sm"
                  disabled={task.status !== 'completed'}
                >
                  ✅ 提交审批
                </button>
              </div>
            </div>
          )}

          {task.adjustmentLog && task.adjustmentLog.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">调整日志</h3>
              <div className="space-y-2">
                {task.adjustmentLog.map((log, index) => (
                  <div key={index} className="text-sm p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-gray-700">
                        模型变更: {FIT_MODEL_LABELS[log.fromModel]} → {FIT_MODEL_LABELS[log.toModel]}
                      </span>
                      <span className="text-gray-400 text-xs">
                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">原因: {log.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timedomain' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">时域波形</h3>
            {task.preprocessedData ? (
              <TimeDomainChart 
                time={task.preprocessedData.time}
                signal={task.preprocessedData.denoisedSignal}
                reference={task.preprocessedData.denoisedReference}
                height={400}
              />
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-400">
                暂无时域数据
              </div>
            )}
          </div>
          {task.preprocessedData && (
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <p className="text-sm text-gray-500">数据点数</p>
                <p className="text-2xl font-bold text-gray-800">{task.preprocessedData.time?.length}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-sm text-gray-500">时间范围</p>
                <p className="text-lg font-bold text-gray-800">
                  {task.preprocessedData.time?.[0]?.toFixed(2)} - {task.preprocessedData.time?.[task.preprocessedData.time.length - 1]?.toFixed(2)} ps
                </p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-sm text-gray-500">信噪比改善</p>
                <p className="text-2xl font-bold text-green-600">
                  {task.preprocessedData.noiseReduction?.toFixed(2)} dB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'frequency' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">频域幅值谱</h3>
            {task.fftData ? (
              <FrequencyDomainChart 
                frequency={task.fftData.frequency}
                magnitude={task.fftData.magnitude}
                phase={task.fftData.phase}
                height={400}
              />
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-400">
                暂无频域数据
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dielectric' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">复介电函数频谱</h3>
            {task.fftData?.epsilonReal ? (
              <DielectricChart 
                frequency={task.fftData.frequency}
                epsilonReal={task.fftData.epsilonReal}
                epsilonImag={task.fftData.epsilonImag}
                modelReal={latestFitting?.modelResult?.epsilonReal}
                modelImag={latestFitting?.modelResult?.epsilonImag}
                height={400}
              />
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-400">
                暂无介电函数数据
              </div>
            )}
          </div>
          {latestFitting?.residuals && task.fftData && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">拟合残差</h3>
              <ResidualChart 
                frequency={task.fftData.frequency}
                residuals={latestFitting.residuals}
                height={200}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'fitting' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">拟合模型</h3>
              <div className="space-y-3">
                {task.fittingResults?.map((result, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border-2 ${
                      index === task.fittingResults.length - 1
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">
                          {FIT_MODEL_LABELS[result.model]}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(result.timestamp).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      {index === task.fittingResults.length - 1 && (
                        <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
                          当前
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>χ²: <span className="font-medium">{result.chiSquare?.toFixed(4)}</span></div>
                      <div>R²实: <span className="font-medium">{result.rSquaredReal?.toFixed(4)}</span></div>
                      <div>R²虚: <span className="font-medium">{result.rSquaredImag?.toFixed(4)}</span></div>
                      <div>迭代: <span className="font-medium">{result.iterations}次</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-4">提取的物理参数</h3>
              {task.extractedParams ? (
                <div className="space-y-3">
                  {Object.entries(task.extractedParams).map(([key, value]) => {
                    const paramNames = {
                      epsilonInf: '高频介电常数 (ε∞)',
                      omegaP_THz: '等离子体频率 (ω_p)',
                      gamma_THz: '碰撞频率 (γ)',
                      carrierConcentration: '载流子浓度',
                      mobility: '迁移率',
                      deltaEpsilon: '介电常数变化量 (Δε)',
                      relaxationTime: '弛豫时间 (τ)',
                      alpha: '色散系数 (α)',
                      relaxationFreq: '弛豫频率',
                      chiSquare: '卡方值',
                      rSquaredReal: '决定系数 (实部)',
                      rSquaredImag: '决定系数 (虚部)',
                      model: '拟合模型'
                    };
                    
                    const label = paramNames[key] || key;
                    const displayValue = key === 'model' 
                      ? FIT_MODEL_LABELS[value] || value
                      : typeof value === 'number' ? formatValue(value) : value;

                    return (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-gray-800 font-medium">{displayValue}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  暂无参数
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">审批流程</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  task.approval1?.status === 'approved' ? 'bg-green-500' :
                  task.status === 'approval_1' ? 'bg-primary-500' : 'bg-gray-200'
                } text-white`}>
                  {task.approval1?.status === 'approved' ? '✓' : '1'}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">一级审批 - 博士后验证</h4>
                  <p className="text-sm text-gray-500">验证拟合优度和数据质量</p>
                  {task.approval1?.status === 'approved' && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✅ 已通过 - {task.approval1.reviewer}
                      </p>
                      {task.approval1.comment && (
                        <p className="text-xs text-gray-600 mt-1">
                          意见: {task.approval1.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(task.approval1.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  )}
                  {task.approval1?.status === 'rejected' && (
                    <div className="mt-2 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">
                        ❌ 已驳回 - {task.approval1.reviewer}
                      </p>
                      {task.approval1.comment && (
                        <p className="text-xs text-gray-600 mt-1">
                          意见: {task.approval1.comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-0.5 h-8 bg-gray-200 ml-5"></div>

              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  task.approval2?.status === 'approved' ? 'bg-green-500' :
                  task.status === 'approval_2' ? 'bg-primary-500' : 'bg-gray-200'
                } text-white`}>
                  {task.approval2?.status === 'approved' ? '✓' : '2'}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">二级审批 - 负责人确认</h4>
                  <p className="text-sm text-gray-500">确认物理合理性</p>
                  {task.approval2?.status === 'approved' && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✅ 已通过 - {task.approval2.reviewer}
                      </p>
                      {task.approval2.comment && (
                        <p className="text-xs text-gray-600 mt-1">
                          意见: {task.approval2.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(task.approval2.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  )}
                  {task.approval2?.status === 'rejected' && (
                    <div className="mt-2 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-700">
                        ❌ 已驳回 - {task.approval2.reviewer}
                      </p>
                      {task.approval2.comment && (
                        <p className="text-xs text-gray-600 mt-1">
                          意见: {task.approval2.comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-0.5 h-8 bg-gray-200 ml-5"></div>

              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  task.status === 'archived' ? 'bg-green-500' : 'bg-gray-200'
                } text-white`}>
                  {task.status === 'archived' ? '✓' : '3'}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">归档</h4>
                  <p className="text-sm text-gray-500">数据归档至材料数据库</p>
                  {task.status === 'archived' && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✅ 已归档至材料数据库
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {task.status === 'completed' && (
            <div className="card p-5 bg-primary-50 border-primary-200">
              <h3 className="font-semibold text-primary-800 mb-2">提交审批</h3>
              <p className="text-sm text-primary-600 mb-4">
                分析已完成，确认无误后可提交审批流程
              </p>
              <button onClick={handleSubmitApproval} className="btn-primary">
                提交一级审批
              </button>
            </div>
          )}
        </div>
      )}

      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h3 className="text-lg font-bold text-gray-800 mb-4">切换拟合模型</h3>
            <p className="text-sm text-gray-600 mb-4">
              选择不同的拟合模型重新计算
            </p>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input-field mb-4"
            >
              <option value="">请选择模型</option>
              <option value="drude_lorentz">Drude-Lorentz模型</option>
              <option value="cole_cole">Cole-Cole模型</option>
              <option value="debye">Debye模型</option>
              <option value="maxwell_garnett">Maxwell-Garnett模型</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowReviewModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button 
                onClick={handleRetry}
                className="btn-primary"
                disabled={!selectedModel}
              >
                重新计算
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskDetail;
