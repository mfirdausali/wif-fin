import React from 'react';

const BackgroundPattern: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.05]" aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="seigaiha" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
             <path d="M20 0 A20 20 0 0 0 0 20 A20 20 0 0 0 20 40 A20 20 0 0 0 40 20 A20 20 0 0 0 20 0 Z M20 5 A15 15 0 0 0 5 20 A15 15 0 0 0 20 35 A15 15 0 0 0 35 20 A15 15 0 0 0 20 5 Z M20 10 A10 10 0 0 0 10 20 A10 10 0 0 0 20 30 A10 10 0 0 0 30 20 A10 10 0 0 0 20 10 Z" fill="none" stroke="#ffffff" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#seigaiha)" />
      </svg>
    </div>
  );
};

export default BackgroundPattern;