import type { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  type?: 'success' | 'error' | 'info' | 'warning';
}

export default function Alert({ children, type = 'info' }: AlertProps) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div className={`border rounded-lg p-4 mb-4 ${styles[type]}`}>
      <div className="flex items-start">
        <span className="mr-2 font-bold">{icons[type]}</span>
        <div>{children}</div>
      </div>
    </div>
  );
}
