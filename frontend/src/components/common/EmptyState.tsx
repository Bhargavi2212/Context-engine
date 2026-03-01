import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  message: string;
  icon?: ReactNode;
  primaryButton?: { label: string; onClick: () => void };
  secondaryButton?: { label: string; onClick: () => void };
  actions?: ReactNode;
}

export default function EmptyState({
  title,
  message,
  icon,
  primaryButton,
  secondaryButton,
  actions,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="mb-4 text-gray-500">{icon}</div>}
      {title && (
        <h3 className="text-lg font-medium text-gray-100 mb-2">{title}</h3>
      )}
      <p className="text-gray-400 mb-6">{message}</p>
      {actions}
      {!actions && (primaryButton || secondaryButton) && (
        <div className="flex gap-3">
          {secondaryButton && (
            <button
              onClick={secondaryButton.onClick}
              className="px-4 py-2 border border-gray-600 text-gray-200 hover:bg-gray-800 rounded-lg"
            >
              {secondaryButton.label}
            </button>
          )}
          {primaryButton && (
            <button
              onClick={primaryButton.onClick}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
            >
              {primaryButton.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
