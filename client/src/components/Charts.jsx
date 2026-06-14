import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

export function TimeDomainChart({ time, signal, reference, height = 300 }) {
  const data = time.map((t, i) => ({
    time: t.toFixed(3),
    signal: signal[i],
    reference: reference ? reference[i] : undefined
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 11 }}
          label={{ value: '时间 (ps)', position: 'insideBottom', offset: -5, fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => value.toFixed(6)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line 
          type="monotone" 
          dataKey="signal" 
          name="样品信号" 
          stroke="#0ea5e9" 
          strokeWidth={1.5}
          dot={false}
        />
        {reference && (
          <Line 
            type="monotone" 
            dataKey="reference" 
            name="参考信号" 
            stroke="#8b5cf6" 
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FrequencyDomainChart({ frequency, magnitude, phase, height = 300 }) {
  const halfLen = Math.floor(frequency.length / 2);
  const data = frequency.slice(0, halfLen).map((f, i) => ({
    frequency: (f / 1e12).toFixed(3),
    magnitude: magnitude[i],
    phase: phase ? phase[i] : undefined
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="frequency" 
          tick={{ fontSize: 11 }}
          label={{ value: '频率 (THz)', position: 'insideBottom', offset: -5, fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => typeof value === 'number' ? value.toFixed(6) : value}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line 
          type="monotone" 
          dataKey="magnitude" 
          name="幅值" 
          stroke="#10b981" 
          strokeWidth={1.5}
          dot={false}
        />
        {phase && (
          <Line 
            type="monotone" 
            dataKey="phase" 
            name="相位" 
            stroke="#f59e0b" 
            strokeWidth={1.5}
            dot={false}
            yAxisId={1}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DielectricChart({ frequency, epsilonReal, epsilonImag, modelReal, modelImag, height = 350 }) {
  const data = frequency.slice(0, Math.floor(frequency.length / 2)).map((f, i) => ({
    frequency: (f / 1e12).toFixed(3),
    '实部(实验)': epsilonReal[i],
    '虚部(实验)': epsilonImag[i],
    '实部(拟合)': modelReal ? modelReal[i] : undefined,
    '虚部(拟合)': modelImag ? modelImag[i] : undefined
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="frequency" 
          tick={{ fontSize: 11 }}
          label={{ value: '频率 (THz)', position: 'insideBottom', offset: -5, fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => typeof value === 'number' ? value.toFixed(4) : value}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="实部(实验)" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="虚部(实验)" stroke="#ef4444" strokeWidth={2} dot={false} />
        {modelReal && (
          <Line type="monotone" dataKey="实部(拟合)" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="8 4" dot={false} />
        )}
        {modelImag && (
          <Line type="monotone" dataKey="虚部(拟合)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="8 4" dot={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ResidualChart({ frequency, residuals, height = 200 }) {
  const data = frequency.slice(0, Math.floor(frequency.length / 2)).map((f, i) => ({
    frequency: (f / 1e12).toFixed(3),
    residual: residuals[i]
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="frequency" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip 
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => value.toFixed(6)}
        />
        <Area 
          type="monotone" 
          dataKey="residual" 
          name="残差" 
          stroke="#f59e0b" 
          fill="#fef3c7"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data, height = 250 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="completed" name="完成任务数" stroke="#10b981" strokeWidth={2} />
        <Line type="monotone" dataKey="avgChiSquare" name="平均卡方值" stroke="#f59e0b" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarChartSimple({ data, dataKey, name, color = '#0ea5e9', height = 250 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
