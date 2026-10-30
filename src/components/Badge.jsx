import React from 'react';

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variantStyles = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700',
    success: 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60',
    warning: 'bg-amber-950/80 text-amber-400 border border-amber-800/60',
    danger: 'bg-rose-950/80 text-rose-400 border border-rose-800/60',
    purple: 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60',
    cyan: 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant] || variantStyles.default} ${className}`}
    >
      {children}
    </span>
  );
};
