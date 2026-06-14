export function generateSyntheticTHzSignal(options = {}) {
  const {
    numPoints = 1024,
    timeStep = 0.05,
    peakTime = 2.0,
    amplitude = 1.0,
    pulseWidth = 0.3,
    noiseLevel = 0.02,
    oscillations = 3,
    decayRate = 2.0
  } = options;

  const time = [];
  const signal = [];
  const reference = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i * timeStep;
    time.push(t);
    
    const envelope = Math.exp(-Math.pow((t - peakTime) / pulseWidth, 2));
    const oscillation = Math.cos(2 * Math.PI * oscillations * (t - peakTime) / pulseWidth);
    const mainPulse = amplitude * envelope * oscillation;
    
    const lateDecay = t > peakTime ? Math.exp(-decayRate * (t - peakTime)) : 0;
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    
    signal.push(mainPulse + noise);
    reference.push(mainPulse * 0.9 + noise * 0.5);
  }

  return { time, signal, reference, timeStep, numPoints };
}

export function addNoise(signal, noiseLevel = 0.01) {
  return signal.map(s => s + (Math.random() - 0.5) * 2 * noiseLevel);
}

export function gaussianFilter(signal, sigma = 2) {
  const kernelSize = Math.ceil(sigma * 6) || 1;
  const half = Math.floor(kernelSize / 2);
  const kernel = [];
  
  for (let i = 0; i < kernelSize; i++) {
    const x = i - half;
    kernel.push(Math.exp(-x * x / (2 * sigma * sigma)));
  }
  
  const sum = kernel.reduce((a, b) => a + b, 0);
  const normalized = kernel.map(k => k / sum);
  
  const result = [];
  for (let i = 0; i < signal.length; i++) {
    let val = 0;
    for (let j = 0; j < kernelSize; j++) {
      const idx = i - half + j;
      if (idx >= 0 && idx < signal.length) {
        val += signal[idx] * normalized[j];
      }
    }
    result.push(val);
  }
  
  return result;
}

export function savitzkyGolayFilter(signal, windowSize = 11, polyOrder = 3) {
  const half = Math.floor(windowSize / 2);
  const n = signal.length;
  const result = new Array(n).fill(0);
  
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n - 1, i + half);
    const actualWindow = end - start + 1;
    
    if (actualWindow < polyOrder + 1) {
      result[i] = signal[i];
      continue;
    }
    
    const x = [];
    const y = [];
    for (let j = start; j <= end; j++) {
      x.push(j - i);
      y.push(signal[j]);
    }
    
    const coeffs = polyFit(x, y, polyOrder);
    result[i] = polyVal(coeffs, 0);
  }
  
  return result;
}

function polyFit(x, y, order) {
  const n = x.length;
  const m = order + 1;
  
  const X = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) {
      row.push(Math.pow(x[i], j));
    }
    X.push(row);
  }
  
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matVecMul(Xt, y);
  const coeffs = solveLinearSystem(XtX, Xty);
  
  return coeffs;
}

function polyVal(coeffs, x) {
  let result = 0;
  for (let i = 0; i < coeffs.length; i++) {
    result += coeffs[i] * Math.pow(x, i);
  }
  return result;
}

function transpose(mat) {
  const rows = mat.length;
  const cols = mat[0].length;
  const result = [];
  for (let j = 0; j < cols; j++) {
    const row = [];
    for (let i = 0; i < rows; i++) {
      row.push(mat[i][j]);
    }
    result.push(row);
  }
  return result;
}

function matMul(a, b) {
  const n = a.length;
  const m = b[0].length;
  const p = b.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += a[i][k] * b[k][j];
      }
      row.push(sum);
    }
    result.push(row);
  }
  return result;
}

function matVecMul(mat, vec) {
  const n = mat.length;
  const m = vec.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) {
      sum += mat[i][j] * vec[j];
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

export function deconvolution(signal, reference, regularization = 0.01) {
  const n = signal.length;
  
  const signalFFT = fft(signal);
  const referenceFFT = fft(reference);
  
  const transferFunction = {
    real: new Array(n),
    imag: new Array(n)
  };
  
  for (let i = 0; i < n; i++) {
    const denom = referenceFFT.real[i] ** 2 + referenceFFT.imag[i] ** 2 + regularization;
    transferFunction.real[i] = (signalFFT.real[i] * referenceFFT.real[i] + signalFFT.imag[i] * referenceFFT.imag[i]) / denom;
    transferFunction.imag[i] = (signalFFT.imag[i] * referenceFFT.real[i] - signalFFT.real[i] * referenceFFT.imag[i]) / denom;
  }
  
  return transferFunction;
}

export function fft(signal) {
  const n = signal.length;
  
  if (n <= 1) {
    return { real: [...signal], imag: new Array(n).fill(0) };
  }
  
  const log2n = Math.log2(n);
  if (Math.floor(log2n) !== log2n) {
    return dft(signal);
  }
  
  const real = [...signal];
  const imag = new Array(n).fill(0);
  
  bitReversePermutation(real, imag);
  
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angleStep = -2 * Math.PI / size;
    
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const angle = angleStep * j;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const tr = cos * real[i + j + halfSize] - sin * imag[i + j + halfSize];
        const ti = sin * real[i + j + halfSize] + cos * imag[i + j + halfSize];
        
        real[i + j + halfSize] = real[i + j] - tr;
        imag[i + j + halfSize] = imag[i + j] - ti;
        real[i + j] += tr;
        imag[i + j] += ti;
      }
    }
  }
  
  return { real, imag };
}

function dft(signal) {
  const n = signal.length;
  const real = new Array(n).fill(0);
  const imag = new Array(n).fill(0);
  
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      real[k] += signal[t] * Math.cos(angle);
      imag[k] += signal[t] * Math.sin(angle);
    }
  }
  
  return { real, imag };
}

function bitReversePermutation(real, imag) {
  const n = real.length;
  
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
}

export function ifft(real, imag) {
  const n = real.length;
  const imagNeg = imag.map(x => -x);
  
  const result = fft(real.map((_, i) => real[i]));
  
  const ifftReal = result.real.map(x => x / n);
  const ifftImag = result.imag.map(x => -x / n);
  
  return { real: ifftReal, imag: ifftImag };
}

export function computeFFTMagnitude(real, imag) {
  return real.map((r, i) => Math.sqrt(r * r + imag[i] * imag[i]));
}

export function computeFFTPhase(real, imag) {
  return real.map((r, i) => Math.atan2(imag[i], r));
}

export function computeFrequencyAxis(numPoints, timeStep) {
  const freqs = [];
  const sampleRate = 1 / timeStep;
  
  for (let i = 0; i < numPoints; i++) {
    freqs.push((i * sampleRate) / numPoints);
  }
  
  return freqs;
}

export function validateTimeData(time, signal, options = {}) {
  const {
    minPoints = 64,
    maxNoiseLevel = 0.1,
    maxMissingRatio = 0.05
  } = options;
  
  const issues = [];
  const warnings = [];
  
  if (time.length < minPoints) {
    issues.push(`数据点不足：${time.length} < ${minPoints}`);
  }
  
  if (time.length !== signal.length) {
    issues.push(`时间序列与信号长度不一致`);
  }
  
  const timeDiffs = [];
  for (let i = 1; i < time.length; i++) {
    timeDiffs.push(time[i] - time[i - 1]);
  }
  
  const avgInterval = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
  const maxDeviation = Math.max(...timeDiffs.map(d => Math.abs(d - avgInterval) / avgInterval));
  
  if (maxDeviation > maxMissingRatio) {
    issues.push(`采样时间间隔不均匀，最大偏差: ${(maxDeviation * 100).toFixed(2)}%`);
  }
  
  const signalStats = computeStats(signal);
  const noiseEstimate = estimateNoiseLevel(signal);
  
  if (noiseEstimate / signalStats.max > maxNoiseLevel) {
    warnings.push(`噪声水平较高: ${(noiseEstimate / signalStats.max * 100).toFixed(2)}%`);
  }
  
  const zeroCount = signal.filter(s => s === 0).length;
  if (zeroCount > signal.length * maxMissingRatio) {
    issues.push(`存在过多零值点，可能数据缺失`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    stats: {
      numPoints: time.length,
      timeRange: [time[0], time[time.length - 1]],
      avgInterval,
      maxDeviation,
      noiseLevel: noiseEstimate / signalStats.max,
      signalMax: signalStats.max,
      signalMin: signalStats.min
    }
  };
}

function computeStats(arr) {
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  
  for (const val of arr) {
    sum += val;
    if (val > max) max = val;
    if (val < min) min = val;
  }
  
  const mean = sum / arr.length;
  
  let variance = 0;
  for (const val of arr) {
    variance += (val - mean) ** 2;
  }
  variance /= arr.length;
  
  return { mean, std: Math.sqrt(variance), max, min };
}

function estimateNoiseLevel(signal) {
  let sum = 0;
  for (let i = 0; i < Math.floor(signal.length / 4); i++) {
    sum += signal[i] * signal[i];
  }
  return Math.sqrt(sum / Math.floor(signal.length / 4));
}

export function computeComplexDielectric(transferFunction, thickness, frequency) {
  const c = 299792458;
  
  const epsilonReal = [];
  const epsilonImag = [];
  
  for (let i = 0; i < frequency.length; i++) {
    const omega = 2 * Math.PI * frequency[i];
    const n = computeRefractiveIndex(transferFunction, i);
    const k = computeExtinctionCoefficient(transferFunction, i);
    
    epsilonReal.push(n * n - k * k);
    epsilonImag.push(2 * n * k);
  }
  
  return { epsilonReal, epsilonImag };
}

function computeRefractiveIndex(tf, index) {
  const phase = Math.atan2(tf.imag[index], tf.real[index]);
  const magnitude = Math.sqrt(tf.real[index] ** 2 + tf.imag[index] ** 2);
  return 1 + phase;
}

function computeExtinctionCoefficient(tf, index) {
  const magnitude = Math.sqrt(tf.real[index] ** 2 + tf.imag[index] ** 2);
  return -Math.log(Math.max(magnitude, 1e-10));
}
