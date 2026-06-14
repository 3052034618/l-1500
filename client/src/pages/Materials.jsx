import { useEffect, useState } from 'react';
import useStore from '../store.js';

function Materials() {
  const materials = useStore(state => state.materials);
  const fetchMaterials = useStore(state => state.fetchMaterials);
  const tasks = useStore(state => state.tasks);

  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryLabels = {
    semiconductor: '半导体',
    dielectric: '电介质',
    polymer: '聚合物',
    metamaterial: '超材料',
    biomaterial: '生物材料'
  };

  const categoryColors = {
    semiconductor: 'bg-blue-100 text-blue-700',
    dielectric: 'bg-green-100 text-green-700',
    polymer: 'bg-purple-100 text-purple-700',
    metamaterial: 'bg-amber-100 text-amber-700',
    biomaterial: 'bg-pink-100 text-pink-700'
  };

  const getMaterialTasks = (materialId) => {
    return tasks.filter(t => t.materialId === materialId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">材料数据库</h2>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm">📤 导出数据</button>
          <button className="btn-primary text-sm">+ 新材料</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-4">
            <input
              type="text"
              placeholder="搜索材料..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field mb-4"
            />
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredMaterials.map(material => (
                <div
                  key={material.id}
                  onClick={() => setSelectedMaterial(material)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedMaterial?.id === material.id
                      ? 'bg-primary-50 border-2 border-primary-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white">
                      🧪
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-800 truncate">{material.name}</h4>
                      <p className="text-xs text-gray-500">{material.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[material.category] || 'bg-gray-100 text-gray-700'}`}>
                      {categoryLabels[material.category] || material.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getMaterialTasks(material.id).length} 条记录
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredMaterials.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  暂无材料数据
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedMaterial ? (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{selectedMaterial.name}</h3>
                    <p className="text-sm text-gray-500">{selectedMaterial.id}</p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full ${categoryColors[selectedMaterial.category]}`}>
                    {categoryLabels[selectedMaterial.category]}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-primary-600">
                      {getMaterialTasks(selectedMaterial.id).length}
                    </p>
                    <p className="text-sm text-gray-500">分析记录</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {selectedMaterial.records?.length || 0}
                    </p>
                    <p className="text-sm text-gray-500">已归档</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">--</p>
                    <p className="text-sm text-gray-500">平均偏差</p>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <h4 className="font-semibold text-gray-800 mb-4">分析记录</h4>
                
                <div className="space-y-3">
                  {(selectedMaterial.records || []).slice().reverse().map((record, index) => (
                    <div 
                      key={index}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">
                            {record.batchNumber || `记录 #${index + 1}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            温度: {record.temperature}K · 湿度: {record.humidity}%
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(record.timestamp).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      
                      {record.extractedParams && (
                        <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                          <div>
                            <span className="text-gray-500">ε∞: </span>
                            <span className="text-gray-800 font-mono">
                              {record.extractedParams.epsilonInf?.toFixed(3)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">χ²: </span>
                            <span className="text-gray-800 font-mono">
                              {record.extractedParams.chiSquare?.toFixed(4)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">模型: </span>
                            <span className="text-gray-800">{record.fittingModel}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(!selectedMaterial.records || selectedMaterial.records.length === 0) && (
                    <div className="text-center py-8 text-gray-400">
                      暂无归档记录
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <h4 className="font-semibold text-gray-800 mb-4">参数趋势</h4>
                <div className="h-48 flex items-center justify-center text-gray-400">
                  趋势图表
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <div className="text-6xl mb-4">🔬</div>
              <h3 className="text-lg font-medium text-gray-700">选择材料查看详情</h3>
              <p className="text-sm text-gray-500 mt-1">
                从左侧列表中选择一个材料，查看详细信息和分析记录
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4">材料统计概览</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(categoryLabels).map(([key, label]) => {
            const count = materials.filter(m => m.category === key).length;
            return (
              <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-800">{count}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Materials;
