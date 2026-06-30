import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchForecast, type ZoneForecast } from '../services/weatherService';
import { cameras } from '../services/mockData';
import { FlameIcon } from '../components/icons';
import './Analyses.css';

export const Analyses: React.FC = () => {
  const [forecasts, setForecasts] = useState<ZoneForecast[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>('cam-1');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchForecast();
      setForecasts(data);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const activeForecast = forecasts.find(f => f.id === selectedCamId)?.forecast || [];

  // Format the data for recharts
  const chartData = activeForecast.map(f => {
    const date = new Date(f.time);
    const timeLabel = `${date.getHours()}h`;
    return {
      time: timeLabel,
      fullTime: date.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
      temp: f.temperature,
      risk: f.risk_percentage,
      wind: f.wind_speed,
      humidity: f.humidity
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{payload[0].payload.fullTime}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="desc" style={{ color: entry.color }}>
              {entry.name} : {entry.value}{entry.name === 'Risque' || entry.name === 'Humidité' ? '%' : entry.name === 'Température' ? '°C' : 'km/h'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="analyses-page">
      <div className="analyses-header">
        <h1 className="brand">PRÉVISIONS</h1>
        <p className="analyses-subtitle">Analyse prédictive du risque d'incendie (H+48)</p>
      </div>

      <div className="zone-selector">
        {cameras.map(cam => (
          <button 
            key={cam.id} 
            className={`zone-btn ${selectedCamId === cam.id ? 'active' : ''}`}
            onClick={() => setSelectedCamId(cam.id)}
          >
            {cam.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '40px' }}>Chargement des modèles IA météo...</div>
      ) : chartData.length > 0 ? (
        <>
          <div className="chart-container">
            <div className="chart-title">
              <FlameIcon size={16} /> Évolution du Risque Incendie
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} tickMargin={10} minTickGap={20} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={80} stroke="var(--danger)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'DANGER', fill: 'var(--danger)', fontSize: 10 }} />
                  <ReferenceLine y={50} stroke="var(--warn)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'ALERTE', fill: 'var(--warn)', fontSize: 10 }} />
                  <Area type="monotone" name="Risque" dataKey="risk" stroke="var(--danger)" fillOpacity={1} fill="url(#colorRisk)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-title">
              🌡️ Température & Conditions
            </div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffaa00" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#ffaa00" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--text-faint)" fontSize={11} tickMargin={10} minTickGap={20} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" name="Température" dataKey="temp" stroke="#ffaa00" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} />
                  <Area type="monotone" name="Vent" dataKey="wind" stroke="#3b82f6" fillOpacity={1} fill="url(#colorWind)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '40px' }}>Données indisponibles</div>
      )}
    </div>
  );
};
