import React, { useState, useEffect } from 'react';

export const MacroCosmosShortcut: React.FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 숏컷 1(시공간) 데이터 미러링을 위한 항성시 연산
  const getSiderealTime = (date: Date) => {
    const jd = (date.getTime() / 86400000) + 2440587.5;
    const d = jd - 2451545.0;
    let lst = (280.46061837 + 360.98564736629 * d) % 360;
    if (lst < 0) lst += 360;
    return (lst / 15).toFixed(4) + 'h';
  };

  return (
    <div className="unitas-shortcut-module" style={{ padding: '20px', background: '#020205', color: '#B388FF', fontFamily: 'monospace', borderRadius: '12px', border: '1px solid #333' }}>
      <h2 style={{ color: '#FFFFFF', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '18px' }}>
        [2] 거시 우주 텔레메트리
      </h2>
      
      <div style={{ marginTop: '15px' }}>
        <h3 style={{ fontSize: '13px', color: '#AAAAAA', marginBottom: '5px' }}>◆ 1, 2단계: 은하/심우주 텔레메트리</h3>
        <p style={{ margin: '2px 0' }}>안드로메다 은하 관측 지수: 98% (최적)</p>
        <p style={{ margin: '2px 0' }}>국부은하군 우주선 플럭스 밀도 안정적</p>
      </div>

      <div style={{ marginTop: '15px' }}>
        <h3 style={{ fontSize: '13px', color: '#AAAAAA', marginBottom: '5px' }}>◆ 3단계: 시간의 궤적 & 거시 척도 융합</h3>
        <p style={{ margin: '2px 0', color: '#00FFCC' }}>[미러링] 항성시(LST): {getSiderealTime(now)}</p>
        <p style={{ margin: '2px 0', color: '#00FFCC' }}>[미러링] 태양 황경: 180.00° | 달 황경: 270.00°</p>
        <p style={{ margin: '2px 0' }}>시간의 궤적: 138억 년 (CMB 투영 연산)</p>
        <p style={{ margin: '2px 0' }}>별의 유산: 수소 73%, 헬륨 25% (핵융합 역학)</p>
        <p style={{ margin: '2px 0' }}>거시 척도: 라니아케아 초은하단 중심 수렴 중</p>
      </div>
    </div>
  );
};
