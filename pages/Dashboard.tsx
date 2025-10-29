import React from 'react';
import { useQuery } from '../hooks/useData';
import { enginesApi } from '../lib/client.ts';
import { Engine } from '../types';

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

  const kpiData = [
    { title: 'Total Engines', value: engineCount ?? '...', color: 'text-blue-400' },
    { title: 'Active Alerts', value: lifecycleAlerts?.length ?? '...', color: 'text-red-400' },
    { title: 'Fleet Hours', value: totalFleetHours ?? '...', color: 'text-white' },
    { title: 'Engines AOG', value: 0, color: 'text-green-400' },
  ];

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
