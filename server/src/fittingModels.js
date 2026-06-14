import { FIT_MODELS } from './constants.js';

const epsilon0 = 8.854187817e-12;
const electronCharge = 1.602176634e-19;
const electronMass = 9.10938356e-31;

export function drudeLorentzModel(frequency, params) {
  const {
    epsilonInf = 3.0,
    omegaP = 1e14,
    gamma = 1e13,
    lorentzOscillators = []
  } = params;

  const omega = frequency.map(f => 2 * Math.PI * f);
  
  const epsilonReal = [];
  const epsilonImag = [];

  for (let i = 0; i < omega.length; i++) {
    const w = omega[i];
    
    const drudeReal = -(omegaP ** 2) / (w ** 2 + gamma ** 2);
    const drudeImag = omegaP ** 2 * gamma / (w * (w ** 2 + gamma ** 2));
    
    let lorentzReal = 0;
    let lorentzImag = 0;
    
    for (const osc of lorentzOscillators) {
      const { omega0, strength, damping } = osc;
      const denom = (omega0 ** 2 - w ** 2) ** 2 + (damping * w) ** 2;
      lorentzReal += strength * (omega0 ** 2 - w ** 2) / denom;
      lorentzImag += strength * damping * w / denom;
    }
    
    epsilonReal.push(epsilonInf + drudeReal + lorentzReal);
    epsilonImag.push(-drudeImag + lorentzImag);
  }

  return { epsilonReal, epsilonImag };
}

export function coleColeModel(frequency, params) {
  const {
    epsilonInf = 3.0,
    deltaEpsilon = 2.0,
    tau = 1e-12,
    alpha = 0.1
  } = params;

  const omega = frequency.map(f => 2 * Math.PI * f);
  
  const epsilonReal = [];
  const epsilonImag = [];

  for (let i = 0; i < omega.length; i++) {
    const w = omega[i];
    const wt = w * tau;
    const cosAlphaPi = Math.cos(alpha * Math.PI / 2);
    const sinAlphaPi = Math.sin(alpha * Math.PI / 2);
    
    const denom = 1 + 2 * wt ** alpha * sinAlphaPi + wt ** (2 * alpha);
    const realPart = deltaEpsilon * (1 + wt ** alpha * cosAlphaPi) / denom;
    const imagPart = deltaEpsilon * wt ** alpha * sinAlphaPi / denom;
    
    epsilonReal.push(epsilonInf + realPart);
    epsilonImag.push(imagPart);
  }

  return { epsilonReal, epsilonImag };
}

export function debyeModel(frequency, params) {
  const {
    epsilonInf = 3.0,
    deltaEpsilon = 2.0,
    tau = 1e-12
  } = params;

  const omega = frequency.map(f => 2 * Math.PI * f);
  
  const epsilonReal = [];
  const epsilonImag = [];

  for (let i = 0; i < omega.length; i++) {
    const w = omega[i];
    const wt = w * tau;
    
    epsilonReal.push(epsilonInf + deltaEpsilon / (1 + wt ** 2));
    epsilonImag.push(deltaEpsilon * wt / (1 + wt ** 2));
  }

  return { epsilonReal, epsilonImag };
}

export function maxwellGarnettModel(frequency, params) {
  const {
    epsilonHost = 2.25,
    epsilonInclusion = 10.0,
    volumeFraction = 0.1
  } = params;

  const omega = frequency.map(f => 2 * Math.PI * f);
  
  const epsilonReal = [];
  const epsilonImag = [];

  for (let i = 0; i < omega.length; i++) {
    const num = epsilonInclusion + 2 * epsilonHost + 2 * volumeFraction * (epsilonInclusion - epsilonHost);
    const den = epsilonInclusion + 2 * epsilonHost - volumeFraction * (epsilonInclusion - epsilonHost);
    const epsilonEff = epsilonHost * num / den;
    
    epsilonReal.push(epsilonEff);
    epsilonImag.push(0.01 * epsilonEff);
  }

  return { epsilonReal, epsilonImag };
}

export function computeResiduals(measuredReal, measuredImag, modelReal, modelImag) {
  const residuals = [];
  
  for (let i = 0; i < measuredReal.length; i++) {
    const realDiff = measuredReal[i] - modelReal[i];
    const imagDiff = measuredImag[i] - modelImag[i];
    residuals.push(Math.sqrt(realDiff ** 2 + imagDiff ** 2));
  }
  
  return residuals;
}

export function computeChiSquare(measuredReal, measuredImag, modelReal, modelImag, weights = null) {
  let chiSquare = 0;
  const n = measuredReal.length;
  
  for (let i = 0; i < n; i++) {
    const realDiff = measuredReal[i] - modelReal[i];
    const imagDiff = measuredImag[i] - modelImag[i];
    const w = weights ? weights[i] : 1;
    chiSquare += w * (realDiff ** 2 + imagDiff ** 2);
  }
  
  return chiSquare / n;
}

export function computeRSquared(measured, model) {
  const n = measured.length;
  
  let meanMeasured = 0;
  for (let i = 0; i < n; i++) {
    meanMeasured += measured[i];
  }
  meanMeasured /= n;
  
  let ssTotal = 0;
  let ssResidual = 0;
  
  for (let i = 0; i < n; i++) {
    ssTotal += (measured[i] - meanMeasured) ** 2;
    ssResidual += (measured[i] - model[i]) ** 2;
  }
  
  return 1 - ssResidual / ssTotal;
}

export function levenbergMarquardt(frequency, epsilonReal, epsilonImag, modelType, initialParams, options = {}) {
  const {
    maxIterations = 100,
    tol = 1e-6,
    lambda = 0.01,
    lambdaFactor = 10
  } = options;

  const modelFunction = getModelFunction(modelType);
  const paramNames = getParamNames(modelType);
  
  let params = { ...initialParams };
  let lambdaCurrent = lambda;
  
  let prevChiSquare = Infinity;
  const chiSquareHistory = [];
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const modelResult = modelFunction(frequency, params);
    const residuals = computeResiduals(epsilonReal, epsilonImag, modelResult.epsilonReal, modelResult.epsilonImag);
    let chiSquare = residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length;
    
    chiSquareHistory.push(chiSquare);
    
    if (Math.abs(prevChiSquare - chiSquare) < tol * chiSquare) {
      break;
    }
    
    const paramArray = paramNames.map(name => params[name]);
    const jacobian = computeJacobian(frequency, params, modelFunction, paramNames);
    
    const JtJ = matTransposeMult(jacobian, jacobian);
    const JtR = matVecMultTranspose(jacobian, residuals);
    
    const diag = [];
    for (let i = 0; i < JtJ.length; i++) {
      diag.push(JtJ[i][i] * (1 + lambdaCurrent));
    }
    
    const A = JtJ.map((row, i) => row.map((val, j) => i === j ? val * (1 + lambdaCurrent) : val));
    
    try {
      const delta = solveLinearSystem(A, JtR.map(x => -x));
      
      const newParams = {};
      paramNames.forEach((name, i) => {
        newParams[name] = params[name] + delta[i];
      });
      
      const newModelResult = modelFunction(frequency, newParams);
      const newResiduals = computeResiduals(epsilonReal, epsilonImag, newModelResult.epsilonReal, newModelResult.epsilonImag);
      const newChiSquare = newResiduals.reduce((sum, r) => sum + r * r, 0) / newResiduals.length;
      
      if (newChiSquare < chiSquare) {
        params = newParams;
        chiSquare = newChiSquare;
        lambdaCurrent /= lambdaFactor;
      } else {
        lambdaCurrent *= lambdaFactor;
      }
    } catch (e) {
      lambdaCurrent *= lambdaFactor;
    }
    
    prevChiSquare = chiSquare;
  }
  
  const finalModel = modelFunction(frequency, params);
  const finalResiduals = computeResiduals(epsilonReal, epsilonImag, finalModel.epsilonReal, finalModel.epsilonImag);
  const finalChiSquare = finalResiduals.reduce((sum, r) => sum + r * r, 0) / finalResiduals.length;
  const rSquaredReal = computeRSquared(epsilonReal, finalModel.epsilonReal);
  const rSquaredImag = computeRSquared(epsilonImag, finalModel.epsilonImag);
  
  return {
    params,
    chiSquare: finalChiSquare,
    rSquaredReal,
    rSquaredImag,
    residuals: finalResiduals,
    modelResult: finalModel,
    chiSquareHistory,
    iterations: chiSquareHistory.length
  };
}

function getModelFunction(modelType) {
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

function getParamNames(modelType) {
  switch (modelType) {
    case FIT_MODELS.DRUDE_LORENTZ:
      return ['epsilonInf', 'omegaP', 'gamma'];
    case FIT_MODELS.COLE_COLE:
      return ['epsilonInf', 'deltaEpsilon', 'tau', 'alpha'];
    case FIT_MODELS.DEBYE:
      return ['epsilonInf', 'deltaEpsilon', 'tau'];
    case FIT_MODELS.MAXWELL_GARNETT:
      return ['epsilonHost', 'epsilonInclusion', 'volumeFraction'];
    default:
      return ['epsilonInf', 'omegaP', 'gamma'];
  }
}

function computeJacobian(frequency, params, modelFunction, paramNames) {
  const n = frequency.length;
  const m = paramNames.length;
  const jacobian = [];
  
  const delta = 1e-6;
  
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) {
      row.push(0);
    }
    jacobian.push(row);
  }
  
  for (let j = 0; j < m; j++) {
    const paramName = paramNames[j];
    const originalValue = params[paramName];
    const h = Math.abs(originalValue) * delta || delta;
    
    const paramsPlus = { ...params, [paramName]: originalValue + h };
    const paramsMinus = { ...params, [paramName]: originalValue - h };
    
    const resultPlus = modelFunction(frequency, paramsPlus);
    const resultMinus = modelFunction(frequency, paramsMinus);
    
    for (let i = 0; i < n; i++) {
      const dReal = (resultPlus.epsilonReal[i] - resultMinus.epsilonReal[i]) / (2 * h);
      const dImag = (resultPlus.epsilonImag[i] - resultMinus.epsilonImag[i]) / (2 * h);
      jacobian[i][j] = Math.sqrt(dReal ** 2 + dImag ** 2);
    }
  }
  
  return jacobian;
}

function matTransposeMult(A, B) {
  const n = A[0].length;
  const m = B[0].length;
  const result = [];
  
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < A.length; k++) {
        sum += A[k][i] * B[k][j];
      }
      row.push(sum);
    }
    result.push(row);
  }
  
  return result;
}

function matVecMultTranspose(A, v) {
  const n = A[0].length;
  const result = [];
  
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < A.length; k++) {
      sum += A[k][i] * v[k];
    }
    result.push(sum);
  }
  
  return result;
}

function solveLinearSystem(A, b) {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);
  
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    
    if (Math.abs(augmented[col][col]) < 1e-10) {
      throw new Error('Singular matrix');
    }
    
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }
  
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= augmented[i][j] * x[j];
    }
    x[i] = sum / augmented[i][i];
  }
  
  return x;
}

export function computeCarrierConcentration(omegaP, effectiveMassRatio = 1.0) {
  const effectiveMass = effectiveMassRatio * electronMass;
  return (omegaP ** 2 * epsilon0 * effectiveMass) / (electronCharge ** 2);
}

export function computeMobility(gamma, effectiveMassRatio = 1.0) {
  const effectiveMass = effectiveMassRatio * electronMass;
  return electronCharge / (effectiveMass * gamma);
}

export function convertOmegaPToTHz(omegaP) {
  return omegaP / (2 * Math.PI * 1e12);
}

export function convertGammaToTHz(gamma) {
  return gamma / (2 * Math.PI * 1e12);
}

export function generateInitialParams(modelType, materialCategory = 'semiconductor') {
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
      }
    },
    polymer: {
      [FIT_MODELS.DRUDE_LORENTZ]: {
        epsilonInf: 2.2,
        omegaP: 5e11,
        gamma: 1e11
      },
      [FIT_MODELS.COLE_COLE]: {
        epsilonInf: 2.0,
        deltaEpsilon: 0.5,
        tau: 1e-10,
        alpha: 0.3
      }
    }
  };
  
  const catDefaults = defaults[materialCategory] || defaults.semiconductor;
  return catDefaults[modelType] || defaults.semiconductor[modelType];
}

export function extractPhysicalParameters(params, modelType) {
  const result = {};
  
  switch (modelType) {
    case FIT_MODELS.DRUDE_LORENTZ:
      result.epsilonInf = params.epsilonInf;
      result.omegaP_THz = convertOmegaPToTHz(params.omegaP);
      result.gamma_THz = convertGammaToTHz(params.gamma);
      result.carrierConcentration = computeCarrierConcentration(params.omegaP);
      result.mobility = computeMobility(params.gamma);
      break;
    case FIT_MODELS.COLE_COLE:
      result.epsilonInf = params.epsilonInf;
      result.deltaEpsilon = params.deltaEpsilon;
      result.relaxationTime = params.tau;
      result.alpha = params.alpha;
      result.relaxationFreq = 1 / (2 * Math.PI * params.tau);
      break;
    case FIT_MODELS.DEBYE:
      result.epsilonInf = params.epsilonInf;
      result.deltaEpsilon = params.deltaEpsilon;
      result.relaxationTime = params.tau;
      result.relaxationFreq = 1 / (2 * Math.PI * params.tau);
      break;
    case FIT_MODELS.MAXWELL_GARNETT:
      result.epsilonHost = params.epsilonHost;
      result.epsilonInclusion = params.epsilonInclusion;
      result.volumeFraction = params.volumeFraction;
      break;
  }
  
  return result;
}
