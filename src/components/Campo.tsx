import React from 'react'

interface CampoProps {
  label: string;
  helper?: string;
  className?: string;
  children:
    React.ReactNode;
}

function Campo({
  label,
  helper,
  className = "",
  children,
}: CampoProps) {
  return (
    <label
      className={`block ${className}`}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>

      <div className="mt-2">
        {children}
      </div>

      {helper && (
        <span className="mt-2 block text-[10px] font-medium leading-relaxed text-slate-400">
          {helper}
        </span>
      )}
    </label>
  );
}

export default Campo