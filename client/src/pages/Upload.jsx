import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store.js';

function Upload() {
  const navigate = useNavigate();
  const createTask = useStore(state => state.createTask);
  const uploadFile = useStore(state => state.uploadFile);
  
  const [file, setFile] = useState(null);
  const [uploadedData, setUploadedData] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    materialName: '',
    materialCategory: 'semiconductor',
    batchNumber: '',
    temperature: 298,
    humidity: 50,
    thickness: 1.0
  });

  const materialCategories = [
    { value: 'semiconductor', label: '半导体' },
    { value: 'dielectric', label: '电介质' },
    { value: 'polymer', label: '聚合物' },
    { value: 'metamaterial', label: '超材料' },
    { value: 'biomaterial', label: '生物材料' }
  ];

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    setFile(file);
    
    try {
      const result = await uploadFile(file);
      setUploadedData(result.data);
      if (!formData.name) {
        setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
      }
    } catch (error) {
      alert('文件解析失败');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const rawDataForBackend = uploadedData && uploadedData.generated ? null : uploadedData;
      const task = await createTask({
        ...formData,
        thickness: formData.thickness / 1000,
        rawData: rawDataForBackend
      });
      
      if (task) {
        navigate(`/tasks/${task.id}`);
      }
    } catch (error) {
      alert(error.message || '创建任务失败');
    }
  };

  const generateDemoData = () => {
    setFormData(prev => ({
      ...prev,
      name: '示例分析任务_' + Date.now(),
      materialName: 'GaAs 砷化镓',
      materialId: 'demo_GaAs_' + Math.floor(Math.random() * 10000),
      batchNumber: 'BATCH-2024001'
    }));
    setUploadedData({ generated: true });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">数据上传</h2>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-800 mb-4">上传时域波形数据</h3>
        
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragActive 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.json,.dat"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="text-5xl mb-4">📁</div>
          <p className="text-gray-700 font-medium mb-1">
            {file ? file.name : '拖拽文件到这里，或点击选择'}
          </p>
          <p className="text-sm text-gray-400">
            支持 CSV、TXT、JSON 格式，包含时间和信号数据
          </p>
          
          {uploadedData && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg inline-block">
              <p className="text-sm text-green-700">
                ✅ {uploadedData.generated ? '使用示例数据' : `数据已加载，共 ${uploadedData.time?.length || 0} 个点`}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <button 
            type="button"
            onClick={generateDemoData}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            或者使用示例数据快速体验 →
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <h3 className="font-semibold text-gray-800">任务信息</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-text">任务名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="请输入任务名称"
              required
            />
          </div>
          
          <div>
            <label className="label-text">材料名称</label>
            <input
              type="text"
              value={formData.materialName}
              onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
              className="input-field"
              placeholder="请输入材料名称"
              required
            />
          </div>
          
          <div>
            <label className="label-text">材料类别</label>
            <select
              value={formData.materialCategory}
              onChange={(e) => setFormData({ ...formData, materialCategory: e.target.value })}
              className="input-field"
            >
              {materialCategories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label-text">批次号</label>
            <input
              type="text"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              className="input-field"
              placeholder="请输入批次号"
            />
          </div>
          
          <div>
            <label className="label-text">温度 (K)</label>
            <input
              type="number"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="input-field"
              step="0.1"
            />
          </div>
          
          <div>
            <label className="label-text">湿度 (%)</label>
            <input
              type="number"
              value={formData.humidity}
              onChange={(e) => setFormData({ ...formData, humidity: parseFloat(e.target.value) })}
              className="input-field"
              step="0.1"
              min="0"
              max="100"
            />
          </div>
          
          <div>
            <label className="label-text">样品厚度 (mm)</label>
            <input
              type="number"
              value={formData.thickness}
              onChange={(e) => setFormData({ ...formData, thickness: parseFloat(e.target.value) })}
              className="input-field"
              step="0.001"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary">
              取消
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={!uploadedData}
            >
              开始分析
            </button>
          </div>
        </div>
      </form>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-800 mb-4">智能推荐</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-700">推荐模型</p>
            <p className="text-lg font-bold text-blue-900 mt-1">Drude-Lorentz</p>
            <p className="text-xs text-blue-600 mt-1">基于半导体材料特性</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-700">初始参数</p>
            <p className="text-lg font-bold text-green-900 mt-1">已优化</p>
            <p className="text-xs text-green-600 mt-1">根据历史数据推荐</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm font-medium text-purple-700">预计精度</p>
            <p className="text-lg font-bold text-purple-900 mt-1">χ² ≈ 0.05</p>
            <p className="text-xs text-purple-600 mt-1">基于同类材料统计</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upload;
