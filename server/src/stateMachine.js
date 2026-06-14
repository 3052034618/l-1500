import { TASK_STATES, WARNING_LEVELS, DEFAULT_FIT_THRESHOLDS } from './constants.js';

class StateMachine {
  constructor() {
    this.transitions = this.defineTransitions();
  }

  defineTransitions() {
    return {
      [TASK_STATES.PENDING_VALIDATION]: {
        validate: TASK_STATES.PREPROCESSING,
        fail: TASK_STATES.ABNORMAL
      },
      [TASK_STATES.PREPROCESSING]: {
        complete: TASK_STATES.FFT,
        fail: TASK_STATES.ABNORMAL
      },
      [TASK_STATES.FFT]: {
        complete: TASK_STATES.MODEL_FITTING,
        fail: TASK_STATES.ABNORMAL
      },
      [TASK_STATES.MODEL_FITTING]: {
        complete: TASK_STATES.PARAMETER_EXTRACTION,
        retry: TASK_STATES.MODEL_FITTING,
        fail: TASK_STATES.ABNORMAL
      },
      [TASK_STATES.PARAMETER_EXTRACTION]: {
        complete: TASK_STATES.COMPLETED,
        fail: TASK_STATES.ABNORMAL
      },
      [TASK_STATES.COMPLETED]: {
        submit_approval: TASK_STATES.APPROVAL_1,
        retry: TASK_STATES.MODEL_FITTING,
        retry_fitting: TASK_STATES.MODEL_FITTING
      },
      [TASK_STATES.APPROVAL_1]: {
        approve: TASK_STATES.APPROVAL_2,
        reject: TASK_STATES.MODEL_FITTING,
        retry_fitting: TASK_STATES.MODEL_FITTING
      },
      [TASK_STATES.APPROVAL_2]: {
        approve: TASK_STATES.ARCHIVED,
        reject: TASK_STATES.APPROVAL_1,
        retry_fitting: TASK_STATES.MODEL_FITTING
      },
      [TASK_STATES.ABNORMAL]: {
        retry: TASK_STATES.PREPROCESSING,
        retry_fitting: TASK_STATES.MODEL_FITTING,
        cancel: 'cancelled'
      },
      [TASK_STATES.SUSPENDED]: {
        resume: TASK_STATES.PENDING_VALIDATION
      }
    };
  }

  canTransition(fromState, event) {
    return this.transitions[fromState] && this.transitions[fromState][event];
  }

  transition(task, event) {
    const fromState = task.status;
    const toState = this.transitions[fromState]?.[event];

    if (!toState) {
      throw new Error(`Invalid state transition: ${fromState} -> ${event}`);
    }

    task.status = toState;
    task.statusHistory.push({
      from: fromState,
      to: toState,
      event,
      timestamp: new Date().toISOString()
    });

    return task;
  }
}

export const stateMachine = new StateMachine();

export class TaskMonitor {
  constructor() {
    this.thresholds = DEFAULT_FIT_THRESHOLDS;
    this.warnings = [];
  }

  monitorFitting(task, fittingResult) {
    const warnings = [];

    if (fittingResult.chiSquare > this.thresholds.maxChiSquare) {
      warnings.push({
        level: WARNING_LEVELS.WARNING,
        type: 'chi_square_high',
        message: `卡方值过高: ${fittingResult.chiSquare.toFixed(4)} > ${this.thresholds.maxChiSquare}`,
        value: fittingResult.chiSquare,
        threshold: this.thresholds.maxChiSquare
      });
    }

    const residualStats = this.computeResidualStats(fittingResult.residuals);
    if (residualStats.max > this.thresholds.maxResidual) {
      warnings.push({
        level: WARNING_LEVELS.WARNING,
        type: 'residual_high',
        message: `最大残差过高: ${residualStats.max.toFixed(4)} > ${this.thresholds.maxResidual}`,
        value: residualStats.max,
        threshold: this.thresholds.maxResidual
      });
    }

    const stability = this.checkStability(fittingResult.modelResult.epsilonImag);
    if (!stability.stable) {
      warnings.push({
        level: WARNING_LEVELS.WARNING,
        type: 'instability_detected',
        message: `复介电函数虚部不稳定，变异系数: ${(stability.cv * 100).toFixed(2)}%`,
        value: stability.cv,
        threshold: 0.3
      });
    }

    const resonanceCheck = this.checkResonancePeaks(fittingResult.modelResult.epsilonImag);
    if (resonanceCheck.abnormalPeaks.length > 0) {
      warnings.push({
        level: WARNING_LEVELS.WARNING,
        type: 'abnormal_resonance',
        message: `检测到${resonanceCheck.abnormalPeaks.length}个异常共振峰`,
        peaks: resonanceCheck.abnormalPeaks
      });
    }

    if (warnings.length > 0) {
      task.warnings = (task.warnings || []).concat(warnings);
      task.needsReview = true;
    }

    return {
      warnings,
      hasCritical: warnings.some(w => w.level === WARNING_LEVELS.ERROR || w.level === WARNING_LEVELS.CRITICAL),
      needsReview: warnings.length > 0
    };
  }

  computeResidualStats(residuals) {
    let sum = 0;
    let max = 0;
    let min = Infinity;

    for (const r of residuals) {
      sum += r;
      if (r > max) max = r;
      if (r < min) min = r;
    }

    const mean = sum / residuals.length;
    let variance = 0;
    for (const r of residuals) {
      variance += (r - mean) ** 2;
    }
    variance /= residuals.length;

    return {
      mean,
      std: Math.sqrt(variance),
      max,
      min
    };
  }

  checkStability(signal) {
    const windowSize = this.thresholds.stabilityWindowSize;
    const cleanSignal = signal.filter(v => isFinite(v) && v >= 0);
    const n = cleanSignal.length;
    
    if (n < windowSize * 2) {
      return { stable: true, cv: 0, windows: [] };
    }
    
    const globalMean = cleanSignal.reduce((a, b) => a + b, 0) / n;
    const windows = [];

    for (let i = 0; i <= n - windowSize; i += windowSize) {
      const window = cleanSignal.slice(i, i + windowSize);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + (val - mean) ** 2, 0) / window.length;
      const std = Math.sqrt(variance);
      
      let cv;
      if (globalMean > 0.01) {
        cv = std / globalMean;
      } else {
        cv = std < 0.01 ? 0 : 0.5;
      }
      
      windows.push({ mean, std, cv: isFinite(cv) ? cv : 0 });
    }

    const maxCv = windows.length > 0 ? Math.max(...windows.map(w => w.cv)) : 0;
    const stable = maxCv < 0.3;

    return { stable, cv: maxCv, windows };
  }

  checkResonancePeaks(signal) {
    const cleanSignal = signal.map(v => isFinite(v) && v >= 0 ? v : 0);
    const peaks = [];
    const n = cleanSignal.length;

    for (let i = 2; i < n - 2; i++) {
      if (cleanSignal[i] > cleanSignal[i - 1] && cleanSignal[i] > cleanSignal[i + 1] &&
          cleanSignal[i] > cleanSignal[i - 2] && cleanSignal[i] > cleanSignal[i + 2]) {
        peaks.push({ index: i, value: cleanSignal[i] });
      }
    }

    const median = this.median(cleanSignal);
    const std = this.stdDev(cleanSignal);
    const threshold = median + 3 * std;

    const abnormalPeaks = peaks.filter(p => p.value > threshold && std > 0);

    return { peaks, abnormalPeaks, threshold };
  }

  median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  stdDev(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  checkParameterDeviation(currentParams, historicalParams) {
    if (!historicalParams || historicalParams.length < 3) {
      return { significantDeviation: false, deviations: {} };
    }

    const keyParams = ['carrierConcentration', 'mobility', 'epsilonInf'];
    const deviations = {};
    let significantDeviation = false;

    for (const param of keyParams) {
      if (currentParams[param] !== undefined) {
        const historicalValues = historicalParams.map(p => p[param]).filter(v => v !== undefined);
        if (historicalValues.length >= 3) {
          const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
          const deviation = Math.abs(currentParams[param] - mean) / Math.abs(mean);
          deviations[param] = deviation;
          
          if (deviation > this.thresholds.maxParameterDeviation) {
            significantDeviation = true;
          }
        }
      }
    }

    return { significantDeviation, deviations };
  }
}

export const taskMonitor = new TaskMonitor();
