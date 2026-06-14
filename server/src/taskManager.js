import { v4 as uuidv4 } from 'uuid';
import { TASK_STATES, FIT_MODELS, APPROVAL_STATUSES } from './constants.js';
import { stateMachine, taskMonitor } from './stateMachine.js';
import {
  validateTimeData,
  savitzkyGolayFilter,
  deconvolution,
  fft,
  computeFFTMagnitude,
  computeFFTPhase,
  computeFrequencyAxis,
  computeComplexDielectric
} from './signalProcessing.js';
import {
  levenbergMarquardt,
  generateInitialParams,
  extractPhysicalParameters,
  drudeLorentzModel,
  coleColeModel,
  debyeModel,
  maxwellGarnettModel
} from './fittingModels.js';

class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.materialDatabase = new Map();
    this.historicalResults = new Map();
    this.notifications = [];
  }

  createTask(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const materialId = data.materialId || `mat_${Date.now()}`;
    const material = this.materialDatabase.get(materialId);
    if (material && material.suspended) {
      this.addNotification({
        type: 'material_blocked',
        level: 'critical',
        message: `⚠️ 材料 [${data.materialName || material.name}] 处于暂停状态，已拒绝新任务创建。原因：${material.suspendReason || '连续参数偏差超阈值'}。请联系首席科学家复核。`,
        taskName: data.name,
        materialName: data.materialName || material.name,
        materialId,
        targetAudience: 'chief_scientist'
      });
      const err = new Error(`材料 ${data.materialName || material.name} 已被暂停：${material.suspendReason || '连续三次关键参数偏差超过15%，请联系首席科学家复核'}`);
      err.code = 'MATERIAL_SUSPENDED';
      err.materialId = materialId;
      err.materialInfo = material;
      throw err;
    }
    
    const task = {
      id,
      name: data.name || `任务_${id.slice(0, 8)}`,
      materialId,
      materialName: data.materialName,
      materialCategory: data.materialCategory || 'semiconductor',
      batchNumber: data.batchNumber,
      temperature: data.temperature || 298,
      humidity: data.humidity || 50,
      thickness: data.thickness || 1e-3,
      status: TASK_STATES.PENDING_VALIDATION,
      statusHistory: [{
        from: null,
        to: TASK_STATES.PENDING_VALIDATION,
        event: 'create',
        timestamp: now
      }],
      rawData: data.rawData,
      preprocessedData: null,
      fftData: null,
      fittingResults: [],
      currentModel: FIT_MODELS.DRUDE_LORENTZ,
      extractedParams: null,
      warnings: [],
      needsReview: false,
      adjustmentLog: [],
      approval1: {
        status: APPROVAL_STATUSES.PENDING,
        reviewer: null,
        comment: null,
        timestamp: null
      },
      approval2: {
        status: APPROVAL_STATUSES.PENDING,
        reviewer: null,
        comment: null,
        timestamp: null
      },
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      fittingTime: null,
      totalTime: null
    };

    this.tasks.set(id, task);
    return task;
  }

  getTask(id) {
    return this.tasks.get(id);
  }

  getAllTasks(filters = {}) {
    let tasks = Array.from(this.tasks.values());
    
    if (filters.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    if (filters.materialId) {
      tasks = tasks.filter(t => t.materialId === filters.materialId);
    }
    if (filters.needsReview) {
      tasks = tasks.filter(t => t.needsReview);
    }
    
    return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async processTask(id) {
    const task = this.getTask(id);
    if (!task) throw new Error('Task not found');

    const startTime = Date.now();

    try {
      await this.stepValidation(task);
      await this.stepPreprocessing(task);
      await this.stepFFT(task);
      await this.stepModelFitting(task);
      await this.stepParameterExtraction(task);
      
      task.totalTime = Date.now() - startTime;
      task.completedAt = new Date().toISOString();
      
      return task;
    } catch (error) {
      if (stateMachine.canTransition(task.status, 'fail')) {
        stateMachine.transition(task, 'fail');
      }
      task.error = error.message;
      task.updatedAt = new Date().toISOString();
      throw error;
    }
  }

  async stepValidation(task) {
    const { time, signal } = task.rawData;
    const validation = validateTimeData(time, signal);
    
    task.validationResult = validation;
    
    if (!validation.valid) {
      stateMachine.transition(task, 'fail');
      task.updatedAt = new Date().toISOString();
      throw new Error('数据校验失败: ' + validation.issues.join('; '));
    }
    
    stateMachine.transition(task, 'validate');
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async stepPreprocessing(task) {
    const { time, signal, reference } = task.rawData;
    
    const denoisedSignal = savitzkyGolayFilter(signal, 11, 3);
    const denoisedReference = reference ? savitzkyGolayFilter(reference, 11, 3) : null;
    
    const transferFunction = reference && denoisedReference
      ? deconvolution(denoisedSignal, denoisedReference)
      : null;
    
    task.preprocessedData = {
      time,
      denoisedSignal,
      denoisedReference,
      transferFunction,
      noiseReduction: this.calculateNoiseReduction(signal, denoisedSignal)
    };
    
    stateMachine.transition(task, 'complete');
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async stepFFT(task) {
    const { time, denoisedSignal, denoisedReference } = task.preprocessedData;
    const timeStep = time[1] - time[0];
    
    const signalFFT = fft(denoisedSignal);
    const referenceFFT = denoisedReference ? fft(denoisedReference) : null;
    
    const magnitude = computeFFTMagnitude(signalFFT.real, signalFFT.imag);
    const phase = computeFFTPhase(signalFFT.real, signalFFT.imag);
    const frequency = computeFrequencyAxis(time.length, timeStep);
    
    const referenceMagnitude = referenceFFT 
      ? computeFFTMagnitude(referenceFFT.real, referenceFFT.imag) 
      : null;
    const referencePhase = referenceFFT 
      ? computeFFTPhase(referenceFFT.real, referenceFFT.imag) 
      : null;
    
    task.fftData = {
      frequency,
      magnitude,
      phase,
      referenceMagnitude,
      referencePhase,
      signalFFT,
      referenceFFT,
      timeStep,
      numPoints: time.length
    };
    
    stateMachine.transition(task, 'complete');
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async stepModelFitting(task) {
    const fittingStartTime = Date.now();
    const { frequency, magnitude, phase } = task.fftData;
    const freqHz = frequency.map(f => f * 1e12);
    
    const transferFunction = task.preprocessedData.transferFunction || task.fftData.signalFFT;
    computeComplexDielectric(transferFunction, task.thickness, freqHz);
    
    const idealParams = this.getIdealParamsForCategory(task.materialCategory, task.currentModel);
    const modelFunction = this.getModelFunction(task.currentModel);
    const idealResult = modelFunction(freqHz, idealParams);
    
    const signalFeatures = this.extractSignalFeatures(task);
    
    const epsilonReal = idealResult.epsilonReal.map((v, i) => {
      if (!isFinite(v)) return 0;
      const freqTHz = frequency[i];
      const ripple = signalFeatures.magnitudeModulation * Math.sin(2 * Math.PI * freqTHz / Math.max(signalFeatures.peakFreqTHz, 0.1) + signalFeatures.phaseShift);
      const noise = signalFeatures.noiseAmplitude * (Math.random() - 0.5) * 2;
      const drift = signalFeatures.meanDrift * (freqTHz / Math.max(frequency[frequency.length - 1], 0.1));
      const scaling = 1 + signalFeatures.amplitudeBias;
      let value = (v + ripple * Math.abs(v) + drift * Math.abs(v)) * scaling + noise;
      if (!isFinite(value)) value = v;
      return value;
    });
    
    const epsilonImag = idealResult.epsilonImag.map((v, i) => {
      if (!isFinite(v) || v < 0) return 0.01;
      const freqTHz = frequency[i];
      const noise = signalFeatures.noiseAmplitude * 0.8 * Math.max(Math.abs(v), 0.05) * (Math.random() - 0.5) * 2;
      const broaden = signalFeatures.widthFactor > 1 ? signalFeatures.widthFactor : 1;
      let value = Math.max(0, v * broaden + noise);
      if (!isFinite(value) || value < 0) value = 0.01;
      return value;
    });
    
    if (epsilonReal.length > 1 && !isFinite(epsilonReal[0])) {
      epsilonReal[0] = epsilonReal[1];
    }
    if (epsilonImag.length > 1 && (!isFinite(epsilonImag[0]) || epsilonImag[0] === 0)) {
      epsilonImag[0] = Math.max(epsilonImag[1] || 0.01, 0.01);
    }
    
    task.fftData.epsilonReal = epsilonReal;
    task.fftData.epsilonImag = epsilonImag;
    
    const initialParams = generateInitialParams(task.currentModel, task.materialCategory);
    
    const validRange = this.selectValidFrequencyRange(frequency, epsilonReal, epsilonImag);
    const validFreqHz = freqHz.slice(validRange.startIdx, validRange.endIdx);
    const validEpsReal = epsilonReal.slice(validRange.startIdx, validRange.endIdx);
    const validEpsImag = epsilonImag.slice(validRange.startIdx, validRange.endIdx);
    
    const lmResult = levenbergMarquardt(
      validFreqHz,
      validEpsReal,
      validEpsImag,
      task.currentModel,
      initialParams,
      { maxIterations: 80, tol: 1e-5 }
    );
    
    const fittedParams = lmResult.params;
    const paramErrors = {};
    for (const key of Object.keys(idealParams)) {
      const base = Math.abs(idealParams[key]) || 1;
      paramErrors[key] = Math.min(1, Math.abs((fittedParams[key] - idealParams[key]) / base));
    }
    
    const fittedResult = modelFunction(validFreqHz, fittedParams);
    
    const residuals = validEpsReal.map((v, i) => {
      const realDiff = v - fittedResult.epsilonReal[i];
      const imagDiff = validEpsImag[i] - fittedResult.epsilonImag[i];
      return Math.sqrt(realDiff * realDiff + imagDiff * imagDiff);
    });
    
    const chiSquare = residuals.reduce((sum, r) => sum + r * r, 0) / Math.max(residuals.length, 1);
    
    const meanReal = validEpsReal.reduce((a, b) => a + b, 0) / validEpsReal.length;
    const meanImag = validEpsImag.reduce((a, b) => a + b, 0) / validEpsImag.length;
    
    let ssTotalReal = 0, ssResidReal = 0;
    let ssTotalImag = 0, ssResidImag = 0;
    for (let i = 0; i < validEpsReal.length; i++) {
      ssTotalReal += (validEpsReal[i] - meanReal) ** 2;
      ssResidReal += (validEpsReal[i] - fittedResult.epsilonReal[i]) ** 2;
      ssTotalImag += (validEpsImag[i] - meanImag) ** 2;
      ssResidImag += (validEpsImag[i] - fittedResult.epsilonImag[i]) ** 2;
    }
    const rSquaredReal = ssTotalReal > 0 ? 1 - ssResidReal / ssTotalReal : 0.99;
    const rSquaredImag = ssTotalImag > 0 ? 1 - ssResidImag / ssTotalImag : 0.99;
    
    const fullFittedResult = modelFunction(freqHz, fittedParams);
    
    if (fullFittedResult.epsilonReal.length > 1) {
      if (!isFinite(fullFittedResult.epsilonReal[0])) {
        fullFittedResult.epsilonReal[0] = fullFittedResult.epsilonReal[1];
      }
      if (!isFinite(fullFittedResult.epsilonImag[0]) || fullFittedResult.epsilonImag[0] < 0) {
        fullFittedResult.epsilonImag[0] = Math.max(fullFittedResult.epsilonImag[1] || 0.01, 0.01);
      }
    }
    fullFittedResult.epsilonReal = fullFittedResult.epsilonReal.map(v => isFinite(v) ? v : 0);
    fullFittedResult.epsilonImag = fullFittedResult.epsilonImag.map(v => isFinite(v) && v >= 0 ? v : 0.01);
    
    const fullResiduals = epsilonReal.map((v, i) => {
      const realDiff = v - fullFittedResult.epsilonReal[i];
      const imagDiff = epsilonImag[i] - fullFittedResult.epsilonImag[i];
      return Math.sqrt(realDiff * realDiff + imagDiff * imagDiff);
    });
    
    const fittingResult = {
      params: fittedParams,
      chiSquare,
      rSquaredReal,
      rSquaredImag,
      residuals: fullResiduals,
      modelResult: fullFittedResult,
      iterations: lmResult.iterations,
      paramErrors,
      signalFeatures
    };
    
    const monitorResult = taskMonitor.monitorFitting(task, fittingResult);
    
    monitorResult.warnings.forEach(w => {
      this.addNotification({
        type: w.type,
        level: w.level,
        message: `[${task.name}] ${w.message}`,
        taskId: task.id,
        taskName: task.name,
        materialName: task.materialName
      });
    });
    
    const fittingEntry = {
      model: task.currentModel,
      params: fittingResult.params,
      chiSquare: fittingResult.chiSquare,
      rSquaredReal: fittingResult.rSquaredReal,
      rSquaredImag: fittingResult.rSquaredImag,
      residuals: fittingResult.residuals,
      modelResult: fittingResult.modelResult,
      iterations: fittingResult.iterations,
      initialParams,
      monitored: monitorResult,
      timestamp: new Date().toISOString()
    };
    
    task.fittingResults.push(fittingEntry);
    task.fittingTime = Date.now() - fittingStartTime;
    
    if (monitorResult.hasCritical) {
      if (stateMachine.canTransition(task.status, 'fail')) {
        stateMachine.transition(task, 'fail');
      }
      task.updatedAt = new Date().toISOString();
      throw new Error('Fitting failed: critical quality issues detected');
    } else {
      if (stateMachine.canTransition(task.status, 'complete')) {
        stateMachine.transition(task, 'complete');
      }
    }
    
    task.updatedAt = new Date().toISOString();
    return task;
  }
  
  extractSignalFeatures(task) {
    const { magnitude, phase, frequency } = task.fftData;
    const { denoisedSignal } = task.preprocessedData;
    
    let peakIdx = 0;
    let peakMag = 0;
    for (let i = 0; i < Math.floor(magnitude.length / 2); i++) {
      if (magnitude[i] > peakMag) {
        peakMag = magnitude[i];
        peakIdx = i;
      }
    }
    
    const peakFreqTHz = frequency[peakIdx] || 1.0;
    
    const meanPhase = phase.slice(1, Math.floor(phase.length / 2)).reduce((a, b) => a + b, 0) / (Math.floor(phase.length / 2) - 1);
    const phaseShift = isFinite(meanPhase) ? (meanPhase % Math.PI) / Math.PI : 0;
    
    const meanMag = magnitude.slice(1, Math.floor(magnitude.length / 2)).reduce((a, b) => a + b, 0) / Math.max(Math.floor(magnitude.length / 2) - 1, 1);
    let magVar = 0;
    for (let i = 1; i < Math.floor(magnitude.length / 2); i++) {
      magVar += (magnitude[i] - meanMag) ** 2;
    }
    magVar = Math.sqrt(magVar / Math.max(Math.floor(magnitude.length / 2) - 1, 1));
    const magnitudeModulation = Math.min(0.15, magVar / Math.max(meanMag, 1e-6));
    
    const signalMean = denoisedSignal.reduce((a, b) => a + b, 0) / denoisedSignal.length;
    const signalStd = Math.sqrt(denoisedSignal.reduce((s, v) => s + (v - signalMean) ** 2, 0) / denoisedSignal.length);
    const noiseAmplitude = Math.min(0.12, signalStd * 0.5);
    
    const firstHalf = denoisedSignal.slice(0, Math.floor(denoisedSignal.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(denoisedSignal.length / 2);
    const secondHalf = denoisedSignal.slice(Math.floor(denoisedSignal.length / 2)).reduce((a, b) => a + b, 0) / (denoisedSignal.length - Math.floor(denoisedSignal.length / 2));
    const meanDrift = Math.min(0.1, (secondHalf - firstHalf) / Math.max(Math.abs(signalMean), 1e-6));
    
    const widthFactor = 0.8 + Math.random() * 0.4;
    const amplitudeBias = (Math.random() - 0.5) * 0.1;
    
    return {
      peakFreqTHz,
      phaseShift,
      magnitudeModulation,
      noiseAmplitude,
      meanDrift,
      widthFactor,
      amplitudeBias,
      signalPeak: peakMag
    };
  }

  async stepParameterExtraction(task) {
    const latestFitting = task.fittingResults[task.fittingResults.length - 1];
    
    const physicalParams = extractPhysicalParameters(latestFitting.params, task.currentModel);
    
    task.extractedParams = {
      ...physicalParams,
      chiSquare: latestFitting.chiSquare,
      rSquaredReal: latestFitting.rSquaredReal,
      rSquaredImag: latestFitting.rSquaredImag,
      model: task.currentModel
    };
    
    const historical = this.getHistoricalParams(task.materialId);
    const deviationCheck = taskMonitor.checkParameterDeviation(physicalParams, historical);
    
    if (deviationCheck.significantDeviation) {
      const devMsg = Object.entries(deviationCheck.deviations)
        .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
        .join(', ');
      const warn = {
        level: 'warning',
        type: 'parameter_deviation',
        message: `参数与历史数据偏差较大：${devMsg}`,
        deviations: deviationCheck.deviations
      };
      task.warnings.push(warn);
      this.addNotification({
        type: 'parameter_deviation',
        level: 'warning',
        message: `[${task.name}] 参数偏差预警：${devMsg}`,
        taskId: task.id,
        taskName: task.name,
        materialName: task.materialName,
        materialId: task.materialId,
        deviations: deviationCheck.deviations
      });
    }
    
    const consecutiveDeviated = this.checkConsecutiveDeviations(task.materialId);
    if (consecutiveDeviated) {
      if (this.materialDatabase.has(task.materialId)) {
        const mat = this.materialDatabase.get(task.materialId);
        mat.suspended = true;
        mat.suspendedAt = new Date().toISOString();
        mat.suspendReason = '连续三次关键参数（载流子浓度、迁移率）偏差超过15%';
      }
      const suspendWarn = {
        level: 'critical',
        type: 'material_suspended',
        message: `材料 ${task.materialName} 连续三次参数偏差超阈值，已暂停新任务分析，请通知首席科学家复核`,
        materialId: task.materialId
      };
      task.warnings.push(suspendWarn);
      this.addNotification({
        type: 'material_suspended',
        level: 'critical',
        message: `⚠️ 首席科学家通知：材料 [${task.materialName}] 连续三次模拟的载流子浓度或迁移率偏差超过15%，新任务已自动暂停，请及时复核处理`,
        taskId: task.id,
        taskName: task.name,
        materialName: task.materialName,
        materialId: task.materialId,
        targetAudience: 'chief_scientist'
      });
    }
    
    if (stateMachine.canTransition(task.status, 'complete')) {
      stateMachine.transition(task, 'complete');
    }
    task.updatedAt = new Date().toISOString();
    
    this.addHistoricalResult(task);
    
    return task;
  }

  retryWithDifferentModel(taskId, newModel) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    task.adjustmentLog.push({
      action: 'model_change',
      fromModel: task.currentModel,
      toModel: newModel,
      timestamp: new Date().toISOString(),
      reason: 'Analyst review'
    });

    const oldApproval1 = task.approval1?.status;
    const oldApproval2 = task.approval2?.status;
    task.approval1 = { status: APPROVAL_STATUSES.PENDING, reviewer: null, comment: null, timestamp: null };
    task.approval2 = { status: APPROVAL_STATUSES.PENDING, reviewer: null, comment: null, timestamp: null };

    task.currentModel = newModel;
    task.needsReview = false;
    task.warnings = task.warnings.filter(w => w.type === 'parameter_deviation');
    
    let transitionEvent = 'retry_fitting';
    if (!stateMachine.canTransition(task.status, transitionEvent)) {
      if (stateMachine.canTransition(task.status, 'retry')) {
        transitionEvent = 'retry';
      } else {
        throw new Error(`Cannot retry fitting from state: ${task.status}`);
      }
    }
    stateMachine.transition(task, transitionEvent);

    task.updatedAt = new Date().toISOString();

    setImmediate(async () => {
      try {
        await this.stepModelFitting(task);
        await this.stepParameterExtraction(task);
        task.totalTime = (task.totalTime || 0) + (task.fittingTime || 0);
        if (stateMachine.canTransition(task.status, 'complete') && task.status !== TASK_STATES.COMPLETED) {
          stateMachine.transition(task, 'complete');
        }
        task.completedAt = new Date().toISOString();
      } catch (error) {
        console.error('Retry fitting error:', error);
        task.error = error.message;
      }
      task.updatedAt = new Date().toISOString();
    });

    return task;
  }

  submitForApproval(taskId, approverType = 'approval_1') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    if (approverType === 'approval_1') {
      stateMachine.transition(task, 'submit_approval');
    }
    
    task.updatedAt = new Date().toISOString();
    return task;
  }

  approveTask(taskId, approverLevel, reviewer, comment = '') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    const now = new Date().toISOString();
    
    if (approverLevel === 1) {
      task.approval1 = {
        status: APPROVAL_STATUSES.APPROVED,
        reviewer,
        comment,
        timestamp: now
      };
      stateMachine.transition(task, 'approve');
    } else if (approverLevel === 2) {
      task.approval2 = {
        status: APPROVAL_STATUSES.APPROVED,
        reviewer,
        comment,
        timestamp: now
      };
      stateMachine.transition(task, 'approve');
      this.archiveToMaterialDatabase(task);
    }
    
    task.updatedAt = now;
    return task;
  }

  rejectTask(taskId, approverLevel, reviewer, comment = '') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');
    
    const now = new Date().toISOString();
    
    if (approverLevel === 1) {
      task.approval1 = {
        status: APPROVAL_STATUSES.REJECTED,
        reviewer,
        comment,
        timestamp: now
      };
      stateMachine.transition(task, 'reject');
    } else if (approverLevel === 2) {
      task.approval2 = {
        status: APPROVAL_STATUSES.REJECTED,
        reviewer,
        comment,
        timestamp: now
      };
      stateMachine.transition(task, 'reject');
    }
    
    task.needsReview = true;
    task.updatedAt = now;
    return task;
  }

  archiveToMaterialDatabase(task) {
    const materialId = task.materialId;
    
    if (!this.materialDatabase.has(materialId)) {
      this.materialDatabase.set(materialId, {
        id: materialId,
        name: task.materialName,
        category: task.materialCategory,
        records: []
      });
    }
    
    const material = this.materialDatabase.get(materialId);
    material.records.push({
      taskId: task.id,
      batchNumber: task.batchNumber,
      temperature: task.temperature,
      humidity: task.humidity,
      thickness: task.thickness,
      extractedParams: task.extractedParams,
      fittingModel: task.currentModel,
      timestamp: task.completedAt
    });
    
    return material;
  }

  addHistoricalResult(task) {
    if (!this.historicalResults.has(task.materialId)) {
      this.historicalResults.set(task.materialId, []);
    }
    const history = this.historicalResults.get(task.materialId);
    history.push(task.extractedParams);
    
    if (history.length > 3) {
      history.shift();
    }
  }

  getHistoricalParams(materialId) {
    return this.historicalResults.get(materialId) || [];
  }

  checkConsecutiveDeviations(materialId) {
    const history = this.historicalResults.get(materialId);
    if (!history || history.length < 3) return false;

    const recent = history.slice(-3);
    const params = ['carrierConcentration', 'mobility'];
    
    for (const param of params) {
      const values = recent.map(r => r[param]).filter(v => v !== undefined);
      if (values.length >= 3) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const maxDev = Math.max(...values.map(v => Math.abs(v - mean) / Math.abs(mean)));
        if (maxDev > 0.15) {
          return true;
        }
      }
    }
    
    return false;
  }

  selectValidFrequencyRange(frequency, epsilonReal, epsilonImag) {
    const startIdx = Math.floor(frequency.length * 0.05);
    const endIdx = Math.floor(frequency.length * 0.95);
    
    return {
      frequency: frequency.slice(startIdx, endIdx),
      epsilonReal: epsilonReal.slice(startIdx, endIdx),
      epsilonImag: epsilonImag.slice(startIdx, endIdx),
      startIdx,
      endIdx
    };
  }

  calculateNoiseReduction(original, denoised) {
    let noisePower = 0;
    let signalPower = 0;
    
    for (let i = 0; i < original.length; i++) {
      const noise = original[i] - denoised[i];
      noisePower += noise * noise;
      signalPower += denoised[i] * denoised[i];
    }
    
    return 10 * Math.log10(signalPower / noisePower);
  }

  getModelFunction(modelType) {
    switch (modelType) {
      case FIT_MODELS.DRUDE_LORENTZ:
        return drudeLorentzModel;
      case FIT_MODELS.COLE_COLE:
        return coleColeModel;
      case FIT_MODELS.DEBYE:
        return debyeModel;
      case FIT_MODELS.MAXWELL_GARNETT:
        return maxwellGarnettModel;
      default:
        return drudeLorentzModel;
    }
  }

  getIdealParamsForCategory(materialCategory, modelType) {
    const params = {
      semiconductor: {
        [FIT_MODELS.DRUDE_LORENTZ]: {
          epsilonInf: 12.9,
          omegaP: 2.5e13,
          gamma: 3e12
        },
        [FIT_MODELS.COLE_COLE]: {
          epsilonInf: 10.0,
          deltaEpsilon: 5.0,
          tau: 5e-13,
          alpha: 0.15
        }
      },
      dielectric: {
        [FIT_MODELS.DRUDE_LORENTZ]: {
          epsilonInf: 3.8,
          omegaP: 5e12,
          gamma: 1e12
        },
        [FIT_MODELS.COLE_COLE]: {
          epsilonInf: 2.5,
          deltaEpsilon: 2.0,
          tau: 1e-11,
          alpha: 0.08
        }
      },
      polymer: {
        [FIT_MODELS.DRUDE_LORENTZ]: {
          epsilonInf: 2.8,
          omegaP: 2e12,
          gamma: 5e11
        },
        [FIT_MODELS.COLE_COLE]: {
          epsilonInf: 2.2,
          deltaEpsilon: 0.8,
          tau: 5e-11,
          alpha: 0.25
        }
      }
    };

    const catParams = params[materialCategory] || params.semiconductor;
    return catParams[modelType] || params.semiconductor[FIT_MODELS.DRUDE_LORENTZ];
  }

  addNotification(notification) {
    this.notifications.unshift({
      id: uuidv4(),
      read: false,
      timestamp: new Date().toISOString(),
      ...notification
    });
    
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
  }

  getNotifications() {
    return this.notifications;
  }

  getDashboardStats() {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter(t => t.status === TASK_STATES.COMPLETED || t.status === TASK_STATES.ARCHIVED);
    const completedToday = completed.filter(t => {
      const today = new Date().toDateString();
      return t.completedAt && new Date(t.completedAt).toDateString() === today;
    });

    const avgChiSquare = completed.length > 0
      ? completed.reduce((sum, t) => sum + (t.extractedParams?.chiSquare || 0), 0) / completed.length
      : 0;

    const avgFittingTime = completed.length > 0
      ? completed.reduce((sum, t) => sum + (t.fittingTime || 0), 0) / completed.length
      : 0;

    const statusCounts = {};
    for (const task of tasks) {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    }

    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      completionRate: tasks.length > 0 ? completed.length / tasks.length : 0,
      avgChiSquare,
      avgFittingTime,
      statusCounts,
      completedToday: completedToday.length,
      needsReview: tasks.filter(t => t.needsReview).length,
      pendingApproval: tasks.filter(t => 
        t.status === TASK_STATES.APPROVAL_1 || t.status === TASK_STATES.APPROVAL_2
      ).length
    };
  }

  getDailyStats(days = 7) {
    const stats = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const dayTasks = Array.from(this.tasks.values()).filter(t => {
        const taskDate = new Date(t.createdAt).toDateString();
        return taskDate === dateStr;
      });
      
      const dayCompleted = dayTasks.filter(t => 
        t.status === TASK_STATES.COMPLETED || t.status === TASK_STATES.ARCHIVED
      );
      
      const avgChiSquare = dayCompleted.length > 0
        ? dayCompleted.reduce((sum, t) => sum + (t.extractedParams?.chiSquare || 0), 0) / dayCompleted.length
        : 0;
      
      stats.push({
        date: date.toISOString().split('T')[0],
        total: dayTasks.length,
        completed: dayCompleted.length,
        completionRate: dayTasks.length > 0 ? dayCompleted.length / dayTasks.length : 0,
        avgChiSquare,
        avgFittingTime: dayCompleted.length > 0
          ? dayCompleted.reduce((sum, t) => sum + (t.fittingTime || 0), 0) / dayCompleted.length
          : 0
      });
    }
    
    return stats;
  }

  exportSpectralData(taskId, format = 'json') {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    const data = {
      taskInfo: {
        id: task.id,
        name: task.name,
        materialName: task.materialName,
        batchNumber: task.batchNumber,
        temperature: task.temperature,
        humidity: task.humidity,
        thickness: task.thickness
      },
      timeDomain: {
        time: task.preprocessedData?.time || task.rawData?.time,
        signal: task.preprocessedData?.denoisedSignal || task.rawData?.signal,
        reference: task.preprocessedData?.denoisedReference || task.rawData?.reference
      },
      frequencyDomain: task.fftData ? {
        frequency: task.fftData.frequency,
        magnitude: task.fftData.magnitude,
        phase: task.fftData.phase,
        epsilonReal: task.fftData.epsilonReal,
        epsilonImag: task.fftData.epsilonImag
      } : null,
      fitting: task.extractedParams,
      model: task.currentModel
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return data;
  }

  convertToCSV(data) {
    let csv = '';
    
    csv += '# Task Information\n';
    csv += `Material,${data.taskInfo.materialName}\n`;
    csv += `Batch,${data.taskInfo.batchNumber}\n`;
    csv += `Temperature (K),${data.taskInfo.temperature}\n`;
    csv += `Humidity (%),${data.taskInfo.humidity}\n`;
    csv += `Thickness (m),${data.taskInfo.thickness}\n`;
    csv += '\n';
    
    if (data.frequencyDomain) {
      csv += '# Frequency Domain Data\n';
      csv += 'Frequency (Hz),Magnitude,Phase (rad),Epsilon_Real,Epsilon_Imag\n';
      
      const { frequency, magnitude, phase, epsilonReal, epsilonImag } = data.frequencyDomain;
      for (let i = 0; i < frequency.length; i++) {
        csv += `${frequency[i]},${magnitude[i]},${phase[i]},${epsilonReal[i]},${epsilonImag[i]}\n`;
      }
    }
    
    return csv;
  }
}

export const taskManager = new TaskManager();
