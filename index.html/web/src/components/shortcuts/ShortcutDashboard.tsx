import React from 'react';
import { TimeWeatherShortcut } from './TimeWeatherShortcut';
import { MacroCosmosShortcut } from './MacroCosmosShortcut';
import { GastronomyShortcut } from './GastronomyShortcut';

export const ShortcutDashboard: React.FC = () => {
  return (
    <div className="unitas-omni-dashboard" style={{ 
      padding: '40px', 
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #0a0a12 0%, #000000 100%)',
      display: 'flex', 
      flexDirection: 'column', 
      gap: '40px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{ textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '24px' }}>
        <h1 style={{ 
          color: '#FFFFFF', 
          fontSize: '28px', 
          fontWeight: '800', 
          letterSpacing: '8px', 
          margin: '0',
          textTransform: 'uppercase',
          textShadow: '0 0 20px rgba(255, 255, 255, 0.2)'
        }}>
          THE UNITAS GLOBAL OÜ
        </h1>
        <p style={{ color: '#888', letterSpacing: '4px', fontSize: '12px', marginTop: '12px' }}>
          U-SQUARE HYPER-THEME : OMNI-SHORTCUT ECOSYSTEM
        </p>
      </header>

      {/* 초반응형(Responsive) 그리드 레이아웃 적용 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
        gap: '32px',
        alignItems: 'start'
      }}>
        <TimeWeatherShortcut />
        <MacroCosmosShortcut />
        <GastronomyShortcut />
      </div>

      <footer style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '40px', color: '#444', fontSize: '11px', letterSpacing: '2px' }}>
        [FAIL-CLOSED INTEGRATION VERIFIED] © 2026 DOOYEONG HWANG. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
};
