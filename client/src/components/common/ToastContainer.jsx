import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectToasts, removeToast } from '../../features/ui/uiSlice';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastItem = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const typeConfig = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-[#38765B]" />,
      border: 'border-[#38765B]/30',
      bg: 'bg-white',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-[#ba1a1a]" />,
      border: 'border-[#ba1a1a]/30',
      bg: 'bg-white',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-[#b77932]" />,
      border: 'border-[#b77932]/30',
      bg: 'bg-white',
    },
    info: {
      icon: <Info className="w-5 h-5 text-champagne" />,
      border: 'border-sand',
      bg: 'bg-white',
    },
  };

  const config = typeConfig[toast.type] || typeConfig.info;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded bg-white ${config.border} border shadow-warm transition-all duration-300 pointer-events-auto max-w-md w-full animate-in slide-in-from-top-2`}
    >
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className="font-serif text-sm font-semibold text-charcoal">
            {toast.title}
          </h4>
        )}
        <p className="text-sm text-on-surface-variant font-sans leading-relaxed">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-1 text-outline hover:text-charcoal transition-colors rounded"
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const dispatch = useDispatch();
  const toasts = useSelector(selectToasts);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={(id) => dispatch(removeToast(id))}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
