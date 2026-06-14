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

  if (raw.time && raw.signal) {
    doc.moveDown(0.5);
    drawTimeDomainChart(doc, task);
  }
}

function addFrequencyDomainInfo(doc, task) {
  const fft = task.fftData;
  if (!fft) return;

  const validFreqRange = fft.frequency
    ? `[${fft.frequency[0].toFixed(3)}, ${(fft.frequency[Math.floor(fft.frequency.length / 2)]).toFixed(3)}] THz`
    : 'N/A';

  const info = [
    ['频谱范围', validFreqRange],
    ['频率分辨率', fft.frequency ? `${((fft.frequency[1] - fft.frequency[0]) * 1000).toFixed(3)} GHz` : 'N/A'],
    ['最大幅值', fft.magnitude ? Math.max(...fft.magnitude).toFixed(6) : 'N/A']
  ];

  info.forEach(([label, value]) => {
    doc.fontSize(11).fillColor('#333')
       .text(`${label}:`, { continued: true, width: 140 })
       .fillColor('#666').text(value.toString());
  });

  if (fft.frequency && fft.magnitude) {
    doc.moveDown(0.5);
    drawFrequencyDomainChart(doc, task);
  }
}

function addDielectricInfo(doc, task) {
  const fft = task.fftData;
  const fitting = task.fittingResults?.[task.fittingResults.length - 1];
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

  if (fft.frequency && fft.epsilonReal) {
    doc.moveDown(0.5);
    drawDielectricChart(doc, task);
  }
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

function drawChartAxes(doc, x, y, width, height, xLabel, yLabel, xMin, xMax, yMin, yMax) {
  doc.save();
  doc.lineWidth(0.8);
  doc.strokeColor('#333');
  doc.moveTo(x, y - height).lineTo(x, y).stroke();
  doc.moveTo(x, y).lineTo(x + width, y).stroke();
  const ticks = 5;
  doc.fontSize(7).fillColor('#666');
  for (let i = 0; i <= ticks; i++) {
    const tx = x + (width * i / ticks);
    const ty = y - (height * i / ticks);
    doc.moveTo(tx, y).lineTo(tx, y + 2).stroke();
    doc.moveTo(x - 2, ty).lineTo(x, ty).stroke();
    const xVal = xMin + (xMax - xMin) * i / ticks;
    const yVal = yMin + (yMax - yMin) * i / ticks;
    doc.text(xVal.toFixed(2), tx - 10, y + 4, { width: 25, align: 'center' });
    doc.text(yVal.toFixed(2), x - 40, ty - 4, { width: 35, align: 'right' });
  }
  doc.fontSize(8).fillColor('#333');
  doc.text(xLabel, x + width / 2 - 30, y + 16, { width: 60, align: 'center' });
  doc.text(yLabel, x - 50, y - height / 2 - 10, { width: 40, align: 'center', lineGap: 2 });
  doc.restore();
}

function drawCurve(doc, xData, yData, x, y, width, height, xMin, xMax, yMin, yMax, color) {
  if (!xData || !yData || xData.length === 0) return;
  const len = Math.min(xData.length, yData.length);
  const sample = Math.max(1, Math.floor(len / 250));
  doc.save();
  doc.lineWidth(1.0);
  doc.strokeColor(color);
  let first = true;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  for (let i = 0; i < len; i += sample) {
    const xv = (xData[i] - xMin) / xRange;
    let yv = (yData[i] - yMin) / yRange;
    if (yv < -1000) yv = -1000;
    if (yv > 1000) yv = 1000;
    if (!isFinite(xv) || !isFinite(yv)) continue;
    const px = x + Math.max(0, Math.min(width, xv * width));
    const py = y - Math.max(0, Math.min(height, yv * height));
    if (first) {
      doc.moveTo(px, py);
      first = false;
    } else {
      doc.lineTo(px, py);
    }
  }
  doc.stroke();
  doc.restore();
}

function drawLegend(doc, x, y, items) {
  doc.save();
  let cx = x;
  items.forEach(({ color, label }) => {
    doc.strokeColor(color).lineWidth(1.5).moveTo(cx, y + 4).lineTo(cx + 15, y + 4).stroke();
    doc.fillColor('#333').fontSize(8).text(label, cx + 18, y, { width: 80 });
    cx += 100;
  });
  doc.restore();
}

function drawTimeDomainChart(doc, task) {
  const x = doc.x;
  const y = doc.y + 5;
  const width = 460;
  const height = 130;
  const raw = task.rawData;
  const preprocessed = task.preprocessedData;
  if (!raw || !raw.time) return;

  const xMin = raw.time[0];
  const xMax = raw.time[raw.time.length - 1];
  let yMin = Math.min(...raw.signal);
  let yMax = Math.max(...raw.signal);
  if (preprocessed && preprocessed.denoisedSignal) {
    yMin = Math.min(yMin, Math.min(...preprocessed.denoisedSignal));
    yMax = Math.max(yMax, Math.max(...preprocessed.denoisedSignal));
  }
  const pad = (yMax - yMin) * 0.1;
  yMin -= pad;
  yMax += pad;

  doc.save();
  doc.roundedRect(x - 6, y - height - 20, width + 40, height + 45, 4)
     .strokeColor('#ddd').lineWidth(0.5).stroke();
  drawChartAxes(doc, x, y, width, height, '时间 (ps)', '幅值', xMin, xMax, yMin, yMax);
  drawCurve(doc, raw.time, raw.signal, x, y, width, height, xMin, xMax, yMin, yMax, '#0369a1');
  if (preprocessed && preprocessed.denoisedSignal) {
    drawCurve(doc, raw.time, preprocessed.denoisedSignal, x, y, width, height, xMin, xMax, yMin, yMax, '#dc2626');
    drawLegend(doc, x + 20, y - height - 12, [
      { color: '#0369a1', label: '原始信号' },
      { color: '#dc2626', label: '去噪后信号' }
    ]);
  } else {
    drawLegend(doc, x + 20, y - height - 12, [
      { color: '#0369a1', label: '时域信号' }
    ]);
  }
  doc.fontSize(9).fillColor('#0369a1').text('图1 时域信号对比', x + width / 2 - 30, y + 30, { width: 60, align: 'center' });
  doc.restore();
  doc.y = y + 50;
}

function drawFrequencyDomainChart(doc, task) {
  const x = doc.x;
  const y = doc.y + 5;
  const width = 460;
  const height = 130;
  const fft = task.fftData;
  if (!fft || !fft.frequency || !fft.magnitude) return;

  const half = Math.floor(fft.frequency.length / 2);
  const freq = fft.frequency.slice(0, half);
  const mag = fft.magnitude.slice(0, half);

  const xMin = 0;
  const xMax = freq[freq.length - 1];
  let yMin = Math.min(...mag);
  let yMax = Math.max(...mag);
  const pad = (yMax - yMin) * 0.1;
  yMin = Math.max(0, yMin - pad);
  yMax += pad;

  doc.save();
  doc.roundedRect(x - 6, y - height - 20, width + 40, height + 45, 4)
     .strokeColor('#ddd').lineWidth(0.5).stroke();
  drawChartAxes(doc, x, y, width, height, '频率 (THz)', '幅值', xMin, xMax, yMin, yMax);
  drawCurve(doc, freq, mag, x, y, width, height, xMin, xMax, yMin, yMax, '#059669');
  drawLegend(doc, x + 20, y - height - 12, [
    { color: '#059669', label: '频域幅值' }
  ]);
  doc.fontSize(9).fillColor('#0369a1').text('图2 频域幅值谱', x + width / 2 - 30, y + 30, { width: 60, align: 'center' });
  doc.restore();
  doc.y = y + 50;
}

function drawDielectricChart(doc, task) {
  const x = doc.x;
  const y = doc.y + 5;
  const width = 460;
  const height = 160;
  const fft = task.fftData;
  const fitting = task.fittingResults?.[task.fittingResults.length - 1];
  if (!fft || !fft.frequency || !fft.epsilonReal) return;

  const start = Math.floor(fft.frequency.length * 0.05);
  const end = Math.floor(fft.frequency.length * 0.5);
  const freq = fft.frequency.slice(start, end);
  const real = fft.epsilonReal.slice(start, end);
  const imag = (fft.epsilonImag || []).slice(start, end);

  const xMin = freq[0];
  const xMax = freq[freq.length - 1];
  let yMin = Math.min(...real);
  let yMax = Math.max(...real);
  if (imag && imag.length) {
    const imagClean = imag.filter(v => isFinite(v) && v < 1e6);
    if (imagClean.length) {
      yMin = Math.min(yMin, Math.min(...imagClean));
      yMax = Math.max(yMax, Math.max(...imagClean));
    }
  }
  const pad = (yMax - yMin) * 0.1;
  yMin = Math.min(0, yMin - pad);
  yMax += pad;

  doc.save();
  doc.roundedRect(x - 6, y - height - 20, width + 40, height + 45, 4)
     .strokeColor('#ddd').lineWidth(0.5).stroke();
  drawChartAxes(doc, x, y, width, height, '频率 (THz)', 'ε', xMin, xMax, yMin, yMax);
  drawCurve(doc, freq, real, x, y, width, height, xMin, xMax, yMin, yMax, '#2563eb');
  const imagClean = imag.map(v => (!isFinite(v) || v > 1e6) ? 0 : v);
  drawCurve(doc, freq, imagClean, x, y, width, height, xMin, xMax, yMin, yMax, '#db2777');
  if (fitting && fitting.fittedEpsilonReal && fitting.fittedEpsilonImag) {
    const fittedReal = fitting.fittedEpsilonReal.slice(start, end);
    const fittedImag = fitting.fittedEpsilonImag.slice(start, end);
    drawCurve(doc, freq, fittedReal, x, y, width, height, xMin, xMax, yMin, yMax, '#7c3aed');
    const fittedImagClean = fittedImag.map(v => (!isFinite(v) || v > 1e6) ? 0 : v);
    drawCurve(doc, freq, fittedImagClean, x, y, width, height, xMin, xMax, yMin, yMax, '#ea580c');
    drawLegend(doc, x + 5, y - height - 12, [
      { color: '#2563eb', label: 'ε\' 实测' },
      { color: '#db2777', label: 'ε\" 实测' },
      { color: '#7c3aed', label: 'ε\' 拟合' },
      { color: '#ea580c', label: 'ε\" 拟合' }
    ]);
  } else {
    drawLegend(doc, x + 5, y - height - 12, [
      { color: '#2563eb', label: 'ε\' 实部' },
      { color: '#db2777', label: 'ε\" 虚部' }
    ]);
  }
  doc.fontSize(9).fillColor('#0369a1').text('图3 复介电函数实部与虚部', x + width / 2 - 45, y + 30, { width: 90, align: 'center' });
  doc.restore();
  doc.y = y + 50;
}
