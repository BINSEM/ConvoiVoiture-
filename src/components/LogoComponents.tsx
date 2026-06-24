import React, { useRef, useState, useEffect } from 'react';

/**
 * Custom hook to dynamically monitor and track a container's width/height in real time.
 * Perfect for responsive SVGs and components that must scale to prevent any parent container overflow.
 */
export function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize && entry.contentBoxSize[0]) {
          setSize({
            width: entry.contentBoxSize[0].inlineSize,
            height: entry.contentBoxSize[0].blockSize,
          });
        } else {
          setSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}

interface LogoProps {
  theme?: 'light' | 'dark';
  maxWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable LogoLong Component (Full branding: "SE Logistique")
 * Implements fluid sizing matching the container's width with fallback scales.
 */
export const LogoLong: React.FC<LogoProps> = ({ 
  theme = 'light', 
  maxWidth = 400, 
  className = '',
  style = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);
  
  // Design dimensions: 600px width by 150px height
  const baseWidth = 600;
  
  // Compute proportionate scaling ratio
  const activeWidth = width || baseWidth;
  const scaleRatio = Math.min(1, activeWidth / baseWidth);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#0f172a' : '#f8fafc'; // slate-900 / slate-50

  return (
    <div 
      ref={containerRef} 
      className={`w-full flex items-center justify-center overflow-hidden transition-all duration-300 logo-long-container ${className}`}
      style={{ 
        maxWidth: `${maxWidth}px`,
        ...style 
      }}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 600 150"
        style={{
          width: '100%',
          height: 'auto',
          maxWidth: '100%',
          transform: `scale(${scaleRatio})`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease-out'
        }}
        className="select-none pointer-events-none logo-long"
      >
        <defs>
          <style>
            {`
              .logo-s-long {
                font-family: 'Playfair Display', serif;
                font-size: 110px;
                font-style: italic;
                font-weight: 600;
                fill: ${textColor};
              }
              .logo-e-long {
                font-family: 'Cinzel', serif;
                font-size: 90px;
                font-weight: 500;
                fill: ${textColor};
              }
              .logo-text-long {
                font-family: 'Inter', sans-serif;
                font-size: 76px;
                font-weight: 950;
                letter-spacing: -2px;
                fill: ${textColor};
              }
              .divider {
                fill: ${textColor};
              }
            `}
          </style>
          <mask id={`s-cut-long-${theme}`}>
            <rect x="0" y="0" width="200" height="150" fill="white" />
            <text x="25" y="112" className="logo-s-long" fill="black" stroke="black" strokeWidth="3">S</text>
          </mask>
        </defs>
        
        <g transform="translate(10, 5)">
          <text x="48" y="104" className="logo-e-long" mask={`url(#s-cut-long-${theme})`}>E</text>
          <text x="25" y="112" className="logo-s-long">S</text>
        </g>
        
        <rect x="175" y="25" width="4" height="100" className="divider" />
        
        <text x="200" y="102" className="logo-text-long">Logistique</text>
      </svg>
    </div>
  );
};

/**
 * Reusable LogoShort Component (Monogram / Icon branding: "SE")
 * Keeps constraints inside any narrow space like headers or avatars.
 */
export const LogoShort: React.FC<LogoProps> = ({ 
  theme = 'light', 
  maxWidth = 80, 
  className = '',
  style = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);
  
  const baseSize = 150;
  const activeWidth = width || baseSize;
  const scaleRatio = Math.min(1, activeWidth / baseSize);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#0f172a' : '#f8fafc';

  return (
    <div 
      ref={containerRef} 
      className={`w-full flex items-center justify-center overflow-hidden transition-all duration-300 logo-short-container ${className}`}
      style={{ 
        maxWidth: `${maxWidth}px`,
        ...style 
      }}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 150 150"
        style={{
          width: '100%',
          height: 'auto',
          maxWidth: '100%',
          transform: `scale(${scaleRatio})`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease-out'
        }}
        className="select-none pointer-events-none logo-short"
      >
        <defs>
          <style>
            {`
              .logo-s-short {
                font-family: 'Playfair Display', serif;
                font-size: 110px;
                font-style: italic;
                font-weight: 600;
                fill: ${textColor};
              }
              .logo-e-short {
                font-family: 'Cinzel', serif;
                font-size: 90px;
                font-weight: 500;
                fill: ${textColor};
              }
            `}
          </style>
          <mask id={`s-cut-mono-short-${theme}`}>
            <rect x="0" y="0" width="150" height="150" fill="white" />
            <text x="25" y="112" className="logo-s-short" fill="black" stroke="black" strokeWidth="3">S</text>
          </mask>
        </defs>
        
        <g transform="translate(5, 5)">
          <text x="48" y="104" className="logo-e-short" mask={`url(#s-cut-mono-short-${theme})`}>E</text>
          <text x="25" y="112" className="logo-s-short">S</text>
        </g>
      </svg>
    </div>
  );
};
