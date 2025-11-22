import React from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi, testsApi, faultsApi, swapsApi } from '../lib/client.ts';
import { Engine } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AlertableComponent {
    id: string;
    engineSerialNumber: string;
    description: string;
    partNumber: string;
    serialNumber: string;
    currentHours: number;
    lifeLimit: number;
    remaining: number;
}

const ProgressBar: React.FC<{ current: number; limit: number }> = ({ current, limit }) => {
  const percentage = Math.min((current / limit) * 100, 100);
  let barColor = 'bg-green-500';
  if (percentage > 80) barColor = 'bg-yellow-500';
  if (percentage >= 100) barColor = 'bg-red-500';

  return (
    <div className="w-full bg-brand-border rounded-full h-2.5">
      <div className={`${barColor} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = React.useState<'7' | '30' | '90'>('30');
  const engines = useQuery(() => enginesApi.getAll(), []);
  const tests = useQuery(() => testsApi.getAll(), []);
  const faults = useQuery(() => faultsApi.getAll(), []);
  const swaps = useQuery(() => swapsApi.getAll(), []);
  
  const engineCount = engines?.length ?? 0;
  
  const totalFleetHours = engines 
    ? engines.reduce((sum, engine) => sum + engine.totalHours, 0).toFixed(1)
    : '0.0';

  const lifecycleAlerts = React.useMemo(() => {
      if (!engines) return [];
      const allComponents: AlertableComponent[] = [];

      const extractComponents = (engine: Engine, components: Engine['components']) => {
          for (const comp of components) {
              if (comp.lifeLimit > 0) { // Only consider components with a life limit
                  allComponents.push({
                      id: `${engine.id}-${comp.id}-${comp.serialNumber}`,
                      engineSerialNumber: engine.serialNumber,
                      description: comp.description,
                      partNumber: comp.partNumber,
                      serialNumber: comp.serialNumber,
                      currentHours: comp.currentHours,
                      lifeLimit: comp.lifeLimit,
                      remaining: comp.lifeLimit - comp.currentHours,
                  });
              }
              if (comp.children) {
                  extractComponents(engine, comp.children);
              }
          }
      };
      
      engines.forEach(engine => extractComponents(engine, engine.components));
      
      // Filter for alerts (remaining < 50 hours) and sort by most urgent
      return allComponents
        .filter(c => c.remaining < 50)
        .sort((a, b) => a.remaining - b.remaining);
  }, [engines]);

  const openFaultsCount = faults?.filter(f => f.status === 'Open').length ?? 0;

  const kpiData = [
    { title: 'Toplam Motor', value: engineCount ?? '...', color: 'text-blue-400' },
    { title: 'Aktif Uyarılar', value: lifecycleAlerts?.length ?? '...', color: 'text-red-400' },
    { title: 'Filo Saati', value: totalFleetHours ?? '...', color: 'text-white' },
    { title: 'Açık Arızalar', value: openFaultsCount, color: openFaultsCount > 0 ? 'text-orange-400' : 'text-green-400' },
  ];

  // Engine Status Distribution
  const engineStatusData = React.useMemo(() => {
    if (!engines) return [];
    const statusCount: Record<string, number> = {};
    engines
        .filter(e => e.status !== 'Active')
        .forEach(e => {
      statusCount[e.status] = (statusCount[e.status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([name, value]) => ({ name, value }));
  }, [engines]);

  // Fault Severity Distribution
  const faultSeverityData = React.useMemo(() => {
    if (!faults) return [];
    const severityCount: Record<string, number> = {};
    faults.filter(f => f.status === 'Open').forEach(f => {
      severityCount[f.severity] = (severityCount[f.severity] || 0) + 1;
    });
    return Object.entries(severityCount).map(([name, value]) => ({ name, value }));
  }, [faults]);

  // Test Activity by Type
  const testActivityData = React.useMemo(() => {
    if (!tests) return [];
    const testCount: Record<string, number> = {};
    tests.forEach(t => {
      testCount[t.testType] = (testCount[t.testType] || 0) + 1;
    });
    return Object.entries(testCount).map(([name, value]) => ({ name, value }));
  }, [tests]);

  // Timeline Data
  const timelineData = React.useMemo(() => {
    if (!tests || !faults || !swaps) return [];
    
    const days = parseInt(timeRange);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const data: Record<string, { date: string; tests: number; faults: number; swaps: number }> = {};
    
    // Initialize all days
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('tr-TR');
        data[dateStr] = { date: dateStr, tests: 0, faults: 0, swaps: 0 };
    }

    // Process tests
    tests.forEach(t => {
        const d = new Date(t.testDate);
        if (d >= startDate && d <= endDate) {
            const dateStr = d.toLocaleDateString('tr-TR');
            if (data[dateStr]) data[dateStr].tests++;
        }
    });

    // Process faults
    faults.forEach(f => {
        const d = new Date(f.reportDate);
        if (d >= startDate && d <= endDate) {
            const dateStr = d.toLocaleDateString('tr-TR');
            if (data[dateStr]) data[dateStr].faults++;
        }
    });

    // Process swaps
    swaps.forEach(s => {
        const d = new Date(s.swapDate);
        if (d >= startDate && d <= endDate) {
            const dateStr = d.toLocaleDateString('tr-TR');
            if (data[dateStr]) data[dateStr].swaps++;
        }
    });

    return Object.values(data);
  }, [tests, faults, swaps, timeRange]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (!engines) return <LoadingSpinner text="Yükleniyor..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gösterge Paneli</h1>
      <p className="text-brand-light">Genel bakış ve temel performans göstergeleri.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi) => (
          <div key={kpi.title} className="bg-brand-card p-6 rounded-lg border border-brand-border">
            <p className="text-sm text-brand-light">{kpi.title}</p>
            <p className={`text-4xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline Activity Chart */}
      <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Zaman Bazlı Aktivite</h2>
            <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-brand-dark border border-brand-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-primary"
            >
                <option value="7">Son 7 Gün</option>
                <option value="30">Son 30 Gün</option>
                <option value="90">Son 90 Gün</option>
            </select>
        </div>
        {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2d3748' }} />
                    <Legend />
                    <Line type="monotone" dataKey="tests" name="Testler" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="faults" name="Arızalar" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="swaps" name="Parça Değişimi" stroke="#f59e0b" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        ) : (
            <p className="text-brand-light text-center py-20">Seçilen aralıkta aktivite yok</p>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engine Status Distribution */}
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
          <h2 className="text-lg font-bold text-white mb-4">Motor Durumu Dağılımı</h2>
          {engineStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={engineStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {engineStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2d3748' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-brand-light text-center py-20">Veri yok</p>
          )}
        </div>

        {/* Fault Severity Distribution */}
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
          <h2 className="text-lg font-bold text-white mb-4">Önem Derecesine Göre Açık Arızalar</h2>
          {faultSeverityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={faultSeverityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2d3748' }} />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-brand-light text-center py-20">Açık arıza yok</p>
          )}
        </div>

        {/* Test Activity by Type */}
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border lg:col-span-2">
          <h2 className="text-lg font-bold text-white mb-4">Test Aktivitesi (Türe Göre)</h2>
          {testActivityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={testActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2d3748' }} />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" name="Yapılan Testler" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-brand-light text-center py-20">Test verisi yok</p>
          )}
        </div>
      </div>

      <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
        <h2 className="text-lg font-bold text-white mb-4">Parça Ömür Uyarıları</h2>
        <div className="space-y-4">
          {!lifecycleAlerts ? (
            <p>Uyarılar yükleniyor...</p>
          ) : lifecycleAlerts.length === 0 ? (
            <p className="text-brand-light">Ömür sınırına yaklaşan parça bulunmuyor.</p>
          ) : (
            lifecycleAlerts.map((alert) => (
              <div key={alert.id} className="grid grid-cols-12 items-center gap-4 p-3 bg-brand-dark rounded-md">
                <div className="col-span-3">
                  <p className="font-semibold text-white">{alert.description}</p>
                  <p className="text-xs text-brand-light">SN: {alert.serialNumber} / {alert.engineSerialNumber}</p>
                </div>
                <div className="col-span-7 flex items-center space-x-4">
                   <span className="text-sm w-24 text-right">{alert.currentHours.toFixed(1)} saat</span>
                  <ProgressBar current={alert.currentHours} limit={alert.lifeLimit} />
                  <span className="text-sm w-20">{alert.lifeLimit} saat</span>
                </div>
                <div className="col-span-2 text-right">
                  <p className={`font-bold ${alert.remaining < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                    {alert.remaining.toFixed(1)}
                  </p>
                  <p className="text-xs text-brand-light">kalan saat</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
