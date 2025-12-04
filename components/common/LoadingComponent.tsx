import React from "react";

interface LoadingProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

const Loading: React.FC<LoadingProps> = ({ message, size = "md", fullScreen = false }) => {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-10 h-10 border-3",
    lg: "w-16 h-16 border-4",
  };

  const containerClasses = fullScreen
    ? "fixed inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50"
    : "flex flex-col items-center justify-center p-8";

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div
          className={`${sizeClasses[size]} border-primary animate-spin rounded-full border-t-transparent`}
          role="status"
          aria-label="Loading"
        />

        {/* Message */}
        {message && <p className="text-muted-foreground animate-pulse text-sm">{message}</p>}
      </div>
    </div>
  );
};
export default Loading;