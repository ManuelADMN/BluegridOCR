import React from 'react';

export const BluegridLogo = ({ className = "w-8 h-8" }: { className?: string }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 140 140" 
      className={className}
      fill="currentColor"
    >
      <defs>
        <path id="piece1" d="M 30 10 L 50 10 A 20 20 0 0 0 70 30 L 106 30 L 86 50 L 70 50 A 20 20 0 0 0 50 70 L 50 86 L 30 106 L 30 70 A 20 20 0 0 0 10 50 L 10 30 A 20 20 0 0 0 30 10 Z" />
      </defs>
      <g className="text-blue-600 dark:text-blue-500">
        <use href="#piece1" />
        <use href="#piece1" transform="rotate(180 70 70)" />
      </g>
    </svg>
  );
};
