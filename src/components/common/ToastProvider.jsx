import { useState, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { ToastContext } from "../../hooks/useToast";

let nextId = 0;

// Replaces the browser's native alert() for success/error feedback after an
// action — non-blocking, auto-dismissing, styled like the rest of the app
// instead of a jarring native dialog.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-20 inset-x-4 sm:inset-x-auto sm:right-4 z-[100] flex flex-col gap-2 sm:w-full sm:max-w-sm print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-2.5 bg-white border rounded-xl shadow-lg p-3.5 ${
              t.type === "error" ? "border-red-200" : "border-green-200"
            }`}
          >
            {t.type === "error" ? (
              <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-gray-700 flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-300 hover:text-gray-500 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
