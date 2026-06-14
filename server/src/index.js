import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { taskManager } from './taskManager.js';
import { recommendationEngine } from './recommendationEngine.js';
import { generateReportPDF } from './reportGenerator.js';
import { generateSyntheticTHzSignal } from './signalProcessing.js';
import { TASK_STATES, FIT_MODELS, FIT_MODEL_LABELS } from './constants.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/tasks', (req, res) => {
  const { status, materialId, needsReview } = req.query;
  const tasks = taskManager.getAllTasks({
    status,
    materialId,
    needsReview: needsReview === 'true'
  });
  res.json(tasks.map(t => sanitizeTask(t)));
});

app.get('/api/tasks/:id', (req, res) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(sanitizeTask(task));
});

app.post('/api/tasks', async (req, res) => {
  try {
    const {
      name,
      materialId,
      materialName,
      materialCategory,
      batchNumber,
      temperature,
      humidity,
      thickness,
      rawData
    } = req.body;

    let data = rawData;
    
    if (!data) {
      const peakTime = 2 + Math.random() * 4;
      const noiseLevel = 0.01 + Math.random() * 0.08;
      const centerFreqTHz = 0.8 + Math.random() * 1.2;
      const synthetic = generateSyntheticTHzSignal({
        numPoints: 1024,
        timeStep: 0.05,
        noiseLevel,
        peakTime,
        centerFreqTHz
      });
      data = {
        time: synthetic.time,
        signal: synthetic.signal,
        reference: synthetic.reference
      };
    }

    const task = taskManager.createTask({
      name,
      materialId: materialId || `mat_${Date.now()}`,
      materialName: materialName || '未知材料',
      materialCategory: materialCategory || 'semiconductor',
      batchNumber,
      temperature,
      humidity,
      thickness: thickness || 1e-3,
      rawData: data
    });

    setImmediate(async () => {
      try {
        await taskManager.processTask(task.id);
      } catch (error) {
        console.error('Task processing error:', error);
      }
    });

    res.status(201).json(sanitizeTask(task));
  } catch (error) {
    if (error.code === 'MATERIAL_SUSPENDED') {
      res.status(423).json({
        error: error.message,
        code: error.code,
        materialId: error.materialId,
        materialInfo: error.materialInfo
      });
    } else {
      res.status(400).json({ error: error.message, code: error.code });
    }
  }
});

app.post('/api/tasks/:id/retry', (req, res) => {
  try {
    const { model } = req.body;
    const task = taskManager.retryWithDifferentModel(req.params.id, model);
    res.json(sanitizeTask(task));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/approve', (req, res) => {
  try {
    const { level, reviewer, comment } = req.body;
    const task = taskManager.approveTask(req.params.id, level, reviewer, comment);
    res.json(sanitizeTask(task));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/reject', (req, res) => {
  try {
    const { level, reviewer, comment } = req.body;
    const task = taskManager.rejectTask(req.params.id, level, reviewer, comment);
    res.json(sanitizeTask(task));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/submit-approval', (req, res) => {
  try {
    const task = taskManager.submitForApproval(req.params.id);
    res.json(sanitizeTask(task));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/tasks/:id/report', async (req, res) => {
  try {
    const task = taskManager.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const pdfBuffer = await generateReportPDF(task);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${task.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:id/export', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const data = taskManager.exportSpectralData(req.params.id, format);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="spectral_data_${req.params.id}.csv"`);
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/dashboard', (req, res) => {
  const stats = taskManager.getDashboardStats();
  const dailyStats = taskManager.getDailyStats(7);
  const notifications = taskManager.getNotifications().slice(0, 10);
  
  res.json({
    stats,
    dailyStats,
    notifications
  });
});

app.get('/api/daily-stats', (req, res) => {
  const { days = 7 } = req.query;
  const stats = taskManager.getDailyStats(parseInt(days));
  res.json(stats);
});

app.get('/api/notifications', (req, res) => {
  const notifications = taskManager.getNotifications();
  res.json(notifications);
});

app.get('/api/recommendations/model', (req, res) => {
  const { materialId, materialCategory } = req.query;
  const recommendations = recommendationEngine.recommendModel(
    materialId,
    materialCategory || 'semiconductor'
  );
  res.json(recommendations);
});

app.get('/api/recommendations/params', (req, res) => {
  const { materialId, model, materialCategory } = req.query;
  const recommendations = recommendationEngine.recommendInitialParams(
    materialId,
    model || FIT_MODELS.DRUDE_LORENTZ,
    materialCategory || 'semiconductor'
  );
  res.json(recommendations);
});

app.get('/api/materials', (req, res) => {
  const materials = Array.from(taskManager.materialDatabase.values());
  res.json(materials);
});

app.get('/api/materials/:id', (req, res) => {
  const material = taskManager.materialDatabase.get(req.params.id);
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  res.json(material);
});

app.get('/api/models', (req, res) => {
  const models = Object.entries(FIT_MODEL_LABELS).map(([key, label]) => ({
    id: key,
    name: label
  }));
  res.json(models);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    let parsedData;

    if (req.file.originalname.endsWith('.json')) {
      parsedData = JSON.parse(content);
    } else if (req.file.originalname.endsWith('.csv') || req.file.originalname.endsWith('.txt')) {
      parsedData = parseTextData(content);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    res.json({
      filename: req.file.originalname,
      data: parsedData,
      numPoints: parsedData.time?.length || 0
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function parseTextData(content) {
  const lines = content.trim().split('\n');
  const time = [];
  const signal = [];
  const reference = [];

  let hasReference = false;

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('%')) continue;
    
    const parts = line.trim().split(/[\s,]+/);
    if (parts.length >= 2) {
      time.push(parseFloat(parts[0]));
      signal.push(parseFloat(parts[1]));
      if (parts.length >= 3) {
        reference.push(parseFloat(parts[2]));
        hasReference = true;
      }
    }
  }

  const result = { time, signal };
  if (hasReference) {
    result.reference = reference;
  }

  return result;
}

function sanitizeTask(task) {
  const sanitized = { ...task };
  
  if (sanitized.fftData?.signalFFT) {
    sanitized.fftData = {
      ...sanitized.fftData,
      signalFFT: undefined,
      referenceFFT: undefined
    };
  }
  
  return sanitized;
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function initializeDemoData() {
  const materials = [
    { id: 'mat_001', name: 'GaAs 砷化镓', category: 'semiconductor' },
    { id: 'mat_002', name: 'Si 硅片', category: 'semiconductor' },
    { id: 'mat_003', name: 'PET 聚对苯二甲酸', category: 'polymer' },
    { id: 'mat_004', name: 'SiO2 二氧化硅', category: 'dielectric' }
  ];

  materials.forEach(mat => {
    taskManager.materialDatabase.set(mat.id, {
      id: mat.id,
      name: mat.name,
      category: mat.category,
      records: []
    });
  });

  for (let i = 0; i < 5; i++) {
    const material = materials[i % materials.length];
    const synthetic = generateSyntheticTHzSignal({
      numPoints: 1024,
      timeStep: 0.05,
      peakTime: 2 + Math.random() * 0.5,
      noiseLevel: 0.02 + Math.random() * 0.02
    });

    const task = taskManager.createTask({
      name: `分析任务_${i + 1}`,
      materialId: material.id,
      materialName: material.name,
      materialCategory: material.category,
      batchNumber: `BATCH-${String(2024001 + i).padStart(6, '0')}`,
      temperature: 298 + Math.random() * 10,
      humidity: 45 + Math.random() * 10,
      thickness: 1e-3 + Math.random() * 0.5e-3,
      rawData: {
        time: synthetic.time,
        signal: synthetic.signal,
        reference: synthetic.reference
      }
    });

    taskManager.processTask(task.id).catch(err => {
      console.error(`Demo task ${task.id} error:`, err);
    });
  }
}

setTimeout(initializeDemoData, 500);

export default app;
