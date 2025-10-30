import React from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi, testsApi, faultsApi } from '../lib/client.ts';
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
  const engines = useQuery(() => enginesApi.getAll(), []);
  const tests = useQuery(() => testsApi.getAll(), []);
  const faults = useQuery(() => faultsApi.getAll(), []);
  
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
                      id: `${engine.serialNumber}-${comp.serialNumber}`,
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
  const aogEnginesCount = engines?.filter(e => e.status === 'AOG').length ?? 0;

  const kpiData = [
    { title: 'Total Engines', value: engineCount ?? '...', color: 'text-blue-400' },
    { title: 'Active Alerts', value: lifecycleAlerts?.length ?? '...', color: 'text-red-400' },
    { title: 'Fleet Hours', value: totalFleetHours ?? '...', color: 'text-white' },
    { title: 'Engines AOG', value: aogEnginesCount, color: aogEnginesCount > 0 ? 'text-red-400' : 'text-green-400' },
  ];

  // Engine Status Distribution
  const engineStatusData = React.useMemo(() => {
    if (!engines) return [];
    const statusCount: Record<string, number> = {};
    engines.forEach(e => {
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (!engines) return <LoadingSpinner text="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-brand-light">Global overview and key performance indicators.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi) => (
          <div key={kpi.title} className="bg-brand-card p-6 rounded-lg border border-brand-border">
            <p className="text-sm text-brand-light">{kpi.title}</p>
            <p className={`text-4xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engine Status Distribution */}
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
          <h2 className="text-lg font-bold text-white mb-4">Engine Status Distribution</h2>
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
            <p className="text-brand-light text-center py-20">No data available</p>
          )}
        </div>

        {/* Fault Severity Distribution */}
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
          <h2 className="text-lg font-bold text-white mb-4">Open Faults by Severity</h2>
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
            <p className="text-brand-light text-center py-20">No open faults</p>
          )}
        </div>

        {/* Test Activity by Type */}
        <div className="bg-brand-card p-6 rounded-lg border border-brand-border lg:col-span-2">
          <h2 className="text-lg font-bold text-white mb-4">Test Activity by Type</h2>
          {testActivityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={testActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1d29', border: '1px solid #2d3748' }} />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" name="Tests Performed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-brand-light text-center py-20">No test data available</p>
          )}
        </div>
      </div>

      <div className="bg-brand-card p-6 rounded-lg border border-brand-border">
        <h2 className="text-lg font-bold text-white mb-4">Component Lifecycle Alerts</h2>
        <div className="space-y-4">
          {!lifecycleAlerts ? (
            <p>Loading alerts...</p>
          ) : lifecycleAlerts.length === 0 ? (
            <p className="text-brand-light">No components are currently approaching their life limits.</p>
          ) : (
            lifecycleAlerts.map((alert) => (
              <div key={alert.id} className="grid grid-cols-12 items-center gap-4 p-3 bg-brand-dark rounded-md">
                <div className="col-span-3">
                  <p className="font-semibold text-white">{alert.description}</p>
                  <p className="text-xs text-brand-light">SN: {alert.serialNumber} on {alert.engineSerialNumber}</p>
                </div>
                <div className="col-span-7 flex items-center space-x-4">
                   <span className="text-sm w-24 text-right">{alert.currentHours.toFixed(1)} hrs</span>
                  <ProgressBar current={alert.currentHours} limit={alert.lifeLimit} />
                  <span className="text-sm w-20">{alert.lifeLimit} hrs</span>
                </div>
                <div className="col-span-2 text-right">
                  <p className={`font-bold ${alert.remaining < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                    {alert.remaining.toFixed(1)}
                  </p>
                  <p className="text-xs text-brand-light">hours remaining</p>
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
