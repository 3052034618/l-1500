import PDFDocument from 'pdfkit';
import { FIT_MODEL_LABELS, TASK_STATE_LABELS } from './constants.js';

export function generateReportPDF(task) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `太赫兹光谱分析报告 - ${task.name}`,
        Author: '太赫兹时域光谱模拟平台',
        Subject: `材料: ${task.materialName}`
      }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    generateReportContent(doc, task);

    doc.end();
  });
}

function generateReportContent(doc, task) {
  doc.fontSize(20).fillColor('#0c4a6e').text('太赫兹时域光谱分析报告', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).fillColor('#666').text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, { align: 'center' });
  doc.moveDown(2);

  addSectionHeader(doc, '一、任务信息');
  addTaskInfo(doc, task);
  doc.moveDown();

  addSectionHeader(doc, '二、时域波形分析');
  addTimeDomainInfo(doc, task);
  doc.moveDown();

  addSectionHeader(doc, '三、频域分析结果');
  addFrequencyDomainInfo(doc, task);
  doc.moveDown();

  addSectionHeader(doc, '四、复介电函数分析');
  addDielectricInfo(doc, task);
  doc.moveDown();

  addSectionHeader(doc, '五、模型拟合结果');
  addFittingResults(doc, task);
  doc.moveDown();

  addSectionHeader(doc, '六、提取的材料参数');
  addExtractedParams(doc, task);
  doc.moveDown();

  if (task.warnings && task.warnings.length > 0) {
    addSectionHeader(doc, '七、预警信息');
    addWarnings(doc, task);
    doc.moveDown();
  }

  addSectionHeader(doc, '八、审批状态');
  addApprovalStatus(doc, task);

  doc.addPage();
  addSectionHeader(doc, '附录：数据统计摘要');
  addStatisticsSummary(doc, task);

  doc.moveDown(3);
  doc.fontSize(10).fillColor('#999').text('—— 报告结束 ——', { align: 'center' });
}

function addSectionHeader(doc, text) {
  doc.fontSize(14).fillColor('#0369a1').text(text);
  doc.moveDown(0.5);
  drawLine(doc, '#bae6fd');
  doc.moveDown(0.5);
}

function drawLine(doc, color) {
  const y = doc.y;
  doc.strokeColor(color).lineWidth(1).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.moveDown(0.3);
}

function addTaskInfo(doc, task) {
  const info = [
    ['任务名称', task.name],
    ['任务ID', task.id],
    ['材料名称', task.materialName || '未知'],
    ['材料类别', task.materialCategory || '未知'],
    ['批次号', task.batchNumber || '未知'],
    ['温度', `${task.temperature} K`],
    ['湿度', `${task.humidity} %`],
    ['样品厚度', `${(task.thickness * 1000).toFixed(3)} mm`],
    ['当前状态', TASK_STATE_LABELS[task.status] || task.status],
    ['创建时间', new Date(task.createdAt).toLocaleString('zh-CN')],
    ['完成时间', task.completedAt ? new Date(task.completedAt).toLocaleString('zh-CN') : '未完成']
  ];

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(`${label}:`, { continued: true, width: 120 })
       .fillColor('#666').text(value.toString());
  });
}

function addTimeDomainInfo(doc, task) {
  const raw = task.rawData;
  const preprocessed = task.preprocessedData;

  if (!raw) return;

  const info = [
    ['数据点数', raw.time ? raw.time.length : 0],
    ['时间范围', raw.time ? `[${raw.time[0].toFixed(4)}, ${raw.time[raw.time.length - 1].toFixed(4)}] ps` : 'N/A'],
    ['采样间隔', raw.time ? `${((raw.time[1] - raw.time[0]) * 1000).toFixed(3)} fs` : 'N/A'],
    ['信号最大值', raw.signal ? Math.max(...raw.signal).toFixed(6) : 'N/A'],
    ['信号最小值', raw.signal ? Math.min(...raw.signal).toFixed(6) : 'N/A']
  ];

  if (preprocessed) {
    info.push(['去噪方法', 'Savitzky-Golay滤波']);
    info.push(['信噪比改善', `${preprocessed.noiseReduction?.toFixed(2)} dB` || 'N/A']);
  }

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(`${label}:`, { continued: true, width: 140 })
       .fillColor('#666').text(value.toString());
  });
}

function addFrequencyDomainInfo(doc, task) {
  const fft = task.fftData;
  if (!fft) return;

  const validFreqRange = fft.frequency
    ? `[${(fft.frequency[0] / 1e12).toFixed(3)}, ${(fft.frequency[Math.floor(fft.frequency.length / 2)] / 1e12).toFixed(3)}] THz`
    : 'N/A';

  const info = [
    ['频谱范围', validFreqRange],
    ['频率分辨率', fft.frequency ? `${(fft.frequency[1] / 1e9).toFixed(3)} GHz` : 'N/A'],
    ['最大幅值', fft.magnitude ? Math.max(...fft.magnitude).toFixed(6) : 'N/A']
  ];

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(`${label}:`, { continued: true, width: 140 })
       .fillColor('#666').text(value.toString());
  });
}

function addDielectricInfo(doc, task) {
  const fft = task.fftData;
  if (!fft || !fft.epsilonReal) return;

  const realStats = calculateStats(fft.epsilonReal);
  const imagStats = calculateStats(fft.epsilonImag || []);

  const info = [
    ['介电常数实部范围', `[${realStats.min.toFixed(4)}, ${realStats.max.toFixed(4)}]`],
    ['介电常数实部均值', realStats.mean.toFixed(4)],
    ['介电常数虚部范围', `[${imagStats.min.toFixed(6)}, ${imagStats.max.toFixed(6)}]`],
    ['介电常数虚部均值', imagStats.mean.toFixed(6)]
  ];

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(`${label}:`, { continued: true, width: 160 })
       .fillColor('#666').text(value.toString());
  });
}

function addFittingResults(doc, task) {
  const latestFitting = task.fittingResults?.[task.fittingResults.length - 1];
  if (!latestFitting) return;

  const info = [
    ['拟合模型', FIT_MODEL_LABELS[latestFitting.model] || latestFitting.model],
    ['卡方值 (χ²)', latestFitting.chiSquare.toFixed(6)],
    ['实部决定系数 (R²)', latestFitting.rSquaredReal.toFixed(6)],
    ['虚部决定系数 (R²)', latestFitting.rSquaredImag.toFixed(6)],
    ['迭代次数', latestFitting.iterations],
    ['最大残差', Math.max(...(latestFitting.residuals || [0])).toFixed(6)]
  ];

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(`${label}:`, { continued: true, width: 180 })
       .fillColor('#666').text(value.toString());
  });
}

function addExtractedParams(doc, task) {
  const params = task.extractedParams;
  if (!params) return;

  const paramNames = {
    epsilonInf: '高频介电常数 (ε∞)',
    omegaP_THz: '等离子体频率 (ω_p, THz)',
    gamma_THz: '碰撞频率 (γ, THz)',
    carrierConcentration: '载流子浓度 (cm⁻³)',
    mobility: '迁移率 (cm²/Vs)',
    deltaEpsilon: '介电常数变化量 (Δε)',
    relaxationTime: '弛豫时间 (τ, s)',
    alpha: '色散系数 (α)',
    relaxationFreq: '弛豫频率 (Hz)',
    epsilonHost: '基质介电常数',
    epsilonInclusion: '包含物介电常数',
    volumeFraction: '体积分数'
  };

  for (const [key, label] of Object.entries(paramNames)) {
    if (params[key] !== undefined) {
      const value = formatScientific(params[key]);
      doc.fontSize(11).fillColor('#333')
         .text(`${label}:`, { continued: true, width: 200 })
         .fillColor('#666').text(value);
    }
  }

  if (params.chiSquare !== undefined) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#0369a1').text(`拟合优度 (χ²): ${params.chiSquare.toFixed(6)}`);
  }
}

function addWarnings(doc, task) {
  task.warnings.forEach((warning, index) => {
    const color = warning.level === 'error' ? '#dc2626' : warning.level === 'warning' ? '#f59e0b' : '#3b82f6';
    doc.fontSize(11).fillColor(color).text(`${index + 1}. [${warning.type}] ${warning.message}`);
  });
}

function addApprovalStatus(doc, task) {
  const statusMap = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回'
  };

  const info = [
    ['一级审批 (博士后)', statusMap[task.approval1?.status] || '待审批'],
    ['   审批人', task.approval1?.reviewer || '未指定'],
    ['   审批意见', task.approval1?.comment || '无'],
    ['二级审批 (负责人)', statusMap[task.approval2?.status] || '待审批'],
    ['   审批人', task.approval2?.reviewer || '未指定'],
    ['   审批意见', task.approval2?.comment || '无']
  ];

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(label + ':', { continued: true, width: 160 })
       .fillColor('#666').text(value);
  });
}

function addStatisticsSummary(doc, task) {
  const params = task.extractedParams;
  const fitting = task.fittingResults?.[task.fittingResults.length - 1];

  if (!params || !fitting) return;

  const tableData = [
    ['参数', '数值', '单位'],
    ['---', '---', '---'],
    ['拟合模型', FIT_MODEL_LABELS[fitting.model] || fitting.model, '-'],
    ['卡方值', fitting.chiSquare.toFixed(6), '-'],
    ['决定系数 (实部)', fitting.rSquaredReal.toFixed(6), '-'],
    ['决定系数 (虚部)', fitting.rSquaredImag.toFixed(6), '-'],
    ['', '', ''],
    ['高频介电常数', params.epsilonInf?.toFixed(4) || 'N/A', '-'],
    ['载流子浓度', params.carrierConcentration ? formatScientific(params.carrierConcentration) : 'N/A', 'cm⁻³'],
    ['迁移率', params.mobility ? formatScientific(params.mobility) : 'N/A', 'cm²/Vs'],
    ['等离子体频率', params.omegaP_THz?.toFixed(4) || 'N/A', 'THz'],
    ['碰撞频率', params.gamma_THz?.toFixed(4) || 'N/A', 'THz']
  ];

  tableData.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0 || rowIndex === 1;
    doc.fontSize(isHeader ? 11 : 10)
       .fillColor(isHeader ? '#0369a1' : '#333')
       .text(row[0], { width: 150, continued: true })
       .text(row[1], { width: 200, continued: true })
       .text(row[2]);
  });
}

function calculateStats(arr) {
  if (!arr || arr.length === 0) {
    return { min: 0, max: 0, mean: 0, std: 0 };
  }

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const val of arr) {
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
  }

  const mean = sum / arr.length;
  let variance = 0;
  for (const val of arr) {
    variance += (val - mean) ** 2;
  }
  variance /= arr.length;

  return { min, max, mean, std: Math.sqrt(variance) };
}

function formatScientific(num) {
  if (Math.abs(num) < 0.001 || Math.abs(num) > 10000) {
    return num.toExponential(4);
  }
  return num.toFixed(6);
}
