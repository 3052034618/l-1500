import { FIT_MODELS } from './constants.js';

class RecommendationEngine {
  constructor() {
    this.modelHistory = new Map();
    this.parameterHistory = new Map();
    this.materialProfiles = new Map();
  }

  recommendModel(materialId, materialCategory = 'semiconductor') {
    const history = this.modelHistory.get(materialId) || [];
    
    if (history.length === 0) {
      return this.getDefaultRecommendations(materialCategory);
    }

    const modelScores = {};
    
    for (const record of history) {
      const model = record.model;
      if (!modelScores[model]) {
        modelScores[model] = { count: 0, totalChiSquare: 0, avgFitTime: 0 };
      }
      modelScores[model].count++;
      modelScores[model].totalChiSquare += record.chiSquare;
      modelScores[model].avgFitTime += record.fitTime;
    }

    const recommendations = [];
    for (const [model, stats] of Object.entries(modelScores)) {
      const avgChiSquare = stats.totalChiSquare / stats.count;
      const avgFitTime = stats.avgFitTime / stats.count;
      
      const score = this.calculateModelScore(avgChiSquare, avgFitTime, stats.count);
      
      recommendations.push({
        model,
        score,
        avgChiSquare,
        avgFitTime,
        usageCount: stats.count,
        recommended: score > 0.7
      });
    }
    
    recommendations.sort((a, b) => b.score - a.score);
    
    return recommendations;
  }

  getDefaultRecommendations(materialCategory) {
    const defaults = {
      semiconductor: [
        { model: FIT_MODELS.DRUDE_LORENTZ, score: 0.85, recommended: true },
        { model: FIT_MODELS.COLE_COLE, score: 0.6, recommended: false },
        { model: FIT_MODELS.DEBYE, score: 0.4, recommended: false }
      ],
      dielectric: [
        { model: FIT_MODELS.COLE_COLE, score: 0.8, recommended: true },
        { model: FIT_MODELS.DEBYE, score: 0.7, recommended: true },
        { model: FIT_MODELS.DRUDE_LORENTZ, score: 0.5, recommended: false }
      ],
      polymer: [
        { model: FIT_MODELS.COLE_COLE, score: 0.85, recommended: true },
        { model: FIT_MODELS.DEBYE, score: 0.75, recommended: true },
        { model: FIT_MODELS.MAXWELL_GARNETT, score: 0.5, recommended: false }
      ],
      metamaterial: [
        { model: FIT_MODELS.MAXWELL_GARNETT, score: 0.8, recommended: true },
        { model: FIT_MODELS.DRUDE_LORENTZ, score: 0.6, recommended: false }
      ],
      biomaterial: [
        { model: FIT_MODELS.COLE_COLE, score: 0.75, recommended: true },
        { model: FIT_MODELS.DEBYE, score: 0.65, recommended: false }
      ]
    };

    return defaults[materialCategory] || defaults.semiconductor;
  }

  calculateModelScore(chiSquare, fitTime, usageCount) {
    const chiScore = Math.max(0, 1 - chiSquare / 10);
    const timeScore = Math.max(0, 1 - fitTime / 10000);
    const usageScore = Math.min(1, usageCount / 10);
    
    return 0.5 * chiScore + 0.3 * timeScore + 0.2 * usageScore;
  }

  recommendInitialParams(materialId, modelType, materialCategory = 'semiconductor') {
    const paramHistory = this.parameterHistory.get(`${materialId}_${modelType}`) || [];
    
    if (paramHistory.length === 0) {
      return this.generateDefaultParams(modelType, materialCategory);
    }

    const avgParams = {};
    const paramNames = Object.keys(paramHistory[0]);
    
    for (const name of paramNames) {
      const values = paramHistory.map(p => p[name]).filter(v => v !== undefined);
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
        
        avgParams[name] = {
          value: mean,
          std,
          range: [mean - 2 * std, mean + 2 * std],
          confidence: Math.min(1, values.length / 10)
        };
      }
    }

    return {
      params: Object.fromEntries(Object.entries(avgParams).map(([k, v]) => [k, v.value])),
      confidence: this.calculateOverallConfidence(avgParams),
      historicalCount: paramHistory.length,
      parameterStats: avgParams
    };
  }

  generateDefaultParams(modelType, materialCategory) {
    const defaults = {
      semiconductor: {
        [FIT_MODELS.DRUDE_LORENTZ]: {
          epsilonInf: 10.0,
          omegaP: 5e13,
          gamma: 5e12
        },
        [FIT_MODELS.COLE_COLE]: {
          epsilonInf: 3.0,
          deltaEpsilon: 5.0,
          tau: 1e-13,
          alpha: 0.2
        },
        [FIT_MODELS.DEBYE]: {
          epsilonInf: 3.0,
          deltaEpsilon: 5.0,
          tau: 1e-13
        }
      },
      dielectric: {
        [FIT_MODELS.DRUDE_LORENTZ]: {
          epsilonInf: 2.5,
          omegaP: 1e12,
          gamma: 1e11
        },
        [FIT_MODELS.COLE_COLE]: {
          epsilonInf: 2.0,
          deltaEpsilon: 1.5,
          tau: 1e-11,
          alpha: 0.1
        },
        [FIT_MODELS.DEBYE]: {
          epsilonInf: 2.0,
          deltaEpsilon: 1.5,
          tau: 1e-11
        }
      }
    };

    const catDefaults = defaults[materialCategory] || defaults.semiconductor;
    const modelDefaults = catDefaults[modelType] || defaults.semiconductor[modelType];

    return {
      params: modelDefaults,
      confidence: 0.3,
      historicalCount: 0,
      note: '使用默认初始参数'
    };
  }

  calculateOverallConfidence(paramStats) {
    const confidences = Object.values(paramStats).map(p => p.confidence || 0);
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  recordModelUsage(materialId, model, chiSquare, fitTime) {
    if (!this.modelHistory.has(materialId)) {
      this.modelHistory.set(materialId, []);
    }
    const history = this.modelHistory.get(materialId);
    history.push({ model, chiSquare, fitTime, timestamp: new Date().toISOString() });
    
    if (history.length > 50) {
      history.shift();
    }
  }

  recordParameterUsage(materialId, modelType, params) {
    const key = `${materialId}_${modelType}`;
    if (!this.parameterHistory.has(key)) {
      this.parameterHistory.set(key, []);
    }
    const history = this.parameterHistory.get(key);
    history.push({ ...params, timestamp: new Date().toISOString() });
    
    if (history.length > 50) {
      history.shift();
    }
  }

  getMaterialProfile(materialId) {
    if (!this.materialProfiles.has(materialId)) {
      return null;
    }
    return this.materialProfiles.get(materialId);
  }

  updateMaterialProfile(materialId, profileData) {
    const existing = this.materialProfiles.get(materialId) || { id: materialId };
    this.materialProfiles.set(materialId, { ...existing, ...profileData });
  }

  recommendFittingStrategy(measuredData, materialCategory) {
    const strategies = [];
    
    const noiseLevel = this.estimateNoise(measuredData.epsilonImag || []);
    
    if (noiseLevel > 0.1) {
      strategies.push({
        type: 'preprocessing',
        recommendation: '建议使用更强的去噪处理',
        priority: 'high'
      });
    }
    
    const hasMultiplePeaks = this.detectMultiplePeaks(measuredData.epsilonImag || []);
    
    if (hasMultiplePeaks) {
      strategies.push({
        type: 'model',
        recommendation: '检测到多个共振峰，建议使用多振子Drude-Lorentz模型',
        priority: 'high'
      });
    }
    
    const isDispersive = this.checkDispersion(measuredData.epsilonReal || []);
    
    if (isDispersive) {
      strategies.push({
        type: 'model',
        recommendation: '介电常数色散明显，建议使用Cole-Cole或Debye模型',
        priority: 'medium'
      });
    }
    
    return strategies;
  }

  estimateNoise(signal) {
    if (signal.length < 10) return 0;
    
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += signal[i] * signal[i];
    }
    return Math.sqrt(sum / 10) / Math.max(...signal.map(s => Math.abs(s)));
  }

  detectMultiplePeaks(signal) {
    let peaks = 0;
    for (let i = 2; i < signal.length - 2; i++) {
      if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
        peaks++;
      }
    }
    return peaks >= 2;
  }

  checkDispersion(epsilonReal) {
    if (epsilonReal.length < 2) return false;
    const first = epsilonReal[0];
    const last = epsilonReal[epsilonReal.length - 1];
    const change = Math.abs(first - last) / Math.abs(first);
    return change > 0.1;
  }
}

export const recommendationEngine = new RecommendationEngine();
