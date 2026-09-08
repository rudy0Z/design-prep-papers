import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 26, className = '' }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DesignPrep Studio Monogram"
    >
      <defs>
        <linearGradient id="coralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff3366" />
          <stop offset="100%" stopColor="#ff5e7e" />
        </linearGradient>
        <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00dfd8" />
          <stop offset="100%" stopColor="#00b4d8" />
        </linearGradient>
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7928ca" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>

      {/* Outer rounded plate */}
      <rect x="4" y="4" width="92" height="92" rx="24" fill="#121319" stroke="rgba(255,255,255,0.14)" strokeWidth="2.5" />

      {/* Drafting lines */}
      <circle cx="50" cy="50" r="34" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="18" y1="50" x2="82" y2="50" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <line x1="50" y1="18" x2="50" y2="82" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      {/* Isometric Interlocking Prism Planes */}
      {/* Top Face */}
      <polygon points="50,23 74,36.5 50,50 26,36.5" fill="url(#coralGrad)" />
      {/* Left Face */}
      <polygon points="26,36.5 50,50 50,77 26,63.5" fill="url(#purpleGrad)" />
      {/* Right Face */}
      <polygon points="50,50 74,36.5 74,63.5 50,77" fill="url(#cyanGrad)" />

      {/* Inner aperture hexagon cutout */}
      <polygon points="50,43 56,46.5 56,53.5 50,57 44,53.5 44,46.5" fill="#121319" />

      {/* Central Focal Compass Point */}
      <circle cx="50" cy="50" r="4.5" fill="#ffffff" />
      <circle cx="50" cy="50" r="2" fill="#ff3366" />
    </svg>
  );
};
