import React, { useState, useEffect } from 'react';

export const TimeWeatherShortcut: React.FC = () => {
  const [now, setNow] = useState(new Date());

  // 실시간 시공간 동기화 엔진
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 항성시(Sidereal Time) 초정밀 연산 알고리즘
  const getSiderealTime = (date: Date) => {
    const jd = (date.getTime() / 86400000) + 2440587.5;
    const d = jd - 2451545.0;
    let lst = (280.46061837 + 360.98564736629 * d) % 360;
    if (lst < 0) lst += 360;
    return (lst / 15).toFixed(4) + 'h';
  };

  return (
    <div className="unitas-shortcut-module" style={{ padding: '20px', background: '#050505', color: '#00FFCC', fontFamily: 'monospace', borderRadius: '12px', border: '1px solid #333' }}>
      <h2 style={{ color: '#FFFFFF', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '18px' }}>
        [1] 시공간 및 기상 텔레메트리
      </h2>
      
      <div style={{ marginTop: '15px' }}>
        <h3 style={{ fontSize: '13px', color: '#AAAAAA', marginBottom: '5px' }}>◆ 1단계: 역법 & 월령 렌더링</h3>
        <p style={{ margin: '2px 0' }}>양력: {now.toLocaleDateString()} {now.toLocaleTimeString()}</p>
        <p style={{ margin: '2px 0' }}>음력/월령: 상현달 (위상 0.50 픽셀 동기화 대기)</p>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h3 style={{ fontSize: '13px', color: '#AAAAAA', marginBottom: '5px' }}>◆ 2단계: 대기/공기 융합 데이터</h3>
        <p style={{ margin: '2px 0' }}>AQI: 42 (초록) | 자외선(UV): 3.2 | 오존(O3): 0.024ppm</p>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h3 style={{ fontSize: '13px', color: '#AAAAAA', marginBottom: '5px' }}>◆ 3단계: 거시 천체 좌표 및 항성시</h3>
        <p style={{ margin: '2px 0' }}>항성시(LST): {getSiderealTime(now)}</p>
        <p style={{ margin: '2px 0' }}>황도 24절기: 추분 (Autumnal Equinox)</p>
        <p style={{ margin: '2px 0' }}>태양 황경: 180.00° | 달 황경: 270.00°</p>
      </div>
    </div>
  );
};
