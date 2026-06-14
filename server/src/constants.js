export const TASK_STATES = {
  PENDING_VALIDATION: 'pending_validation',
  PREPROCESSING: 'preprocessing',
  FFT: 'fft',
  MODEL_FITTING: 'model_fitting',
  PARAMETER_EXTRACTION: 'parameter_extraction',
  COMPLETED: 'completed',
  ABNORMAL: 'abnormal',
  APPROVAL_1: 'approval_1',
  APPROVAL_2: 'approval_2',
  ARCHIVED: 'archived',
  SUSPENDED: 'suspended'
};

export const TASK_STATE_LABELS = {
  [TASK_STATES.PENDING_VALIDATION]: '待校验',
  [TASK_STATES.PREPROCESSING]: '预处理中',
  [TASK_STATES.FFT]: '傅里叶变换中',
  [TASK_STATES.MODEL_FITTING]: '模型拟合中',
  [TASK_STATES.PARAMETER_EXTRACTION]: '参数提取中',
  [TASK_STATES.COMPLETED]: '已完成',
  [TASK_STATES.ABNORMAL]: '异常',
  [TASK_STATES.APPROVAL_1]: '博士后审批',
  [TASK_STATES.APPROVAL_2]: '负责人审批',
  [TASK_STATES.ARCHIVED]: '已归档',
  [TASK_STATES.SUSPENDED]: '已暂停'
};

export const WARNING_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

export const FIT_MODELS = {
  DRUDE_LORENTZ: 'drude_lorentz',
  COLE_COLE: 'cole_cole',
  DEBYE: 'debye',
  MAXWELL_GARNETT: 'maxwell_garnett'
};

export const FIT_MODEL_LABELS = {
  [FIT_MODELS.DRUDE_LORENTZ]: 'Drude-Lorentz模型',
  [FIT_MODELS.COLE_COLE]: 'Cole-Cole模型',
  [FIT_MODELS.DEBYE]: 'Debye模型',
  [FIT_MODELS.MAXWELL_GARNETT]: 'Maxwell-Garnett模型'
};

export const APPROVAL_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

export const MATERIAL_CATEGORIES = {
  SEMICONDUCTOR: 'semiconductor',
  DIELECTRIC: 'dielectric',
  POLYMER: 'polymer',
  METAMATERIAL: 'metamaterial',
  BIOMATERIAL: 'biomaterial'
};

export const DEFAULT_FIT_THRESHOLDS = {
  maxResidual: 100.0,
  maxChiSquare: 500,
  maxParameterDeviation: 0.15,
  stabilityWindowSize: 10
};
