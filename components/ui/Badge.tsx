interface BadgeProps {
  variant: "success" | "warning" | "destructive" | "processing" | "neutral";
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant, size = "md", className = "", children }: BadgeProps) {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full font-medium";
  
  const variantStyles = {
    success: "bg-[var(--color-accent-success-bg)] text-[var(--color-accent-success)]",
    warning: "bg-[var(--color-accent-warning-bg)] text-[var(--color-accent-warning)]",
    destructive: "bg-[var(--color-accent-destructive-bg)] text-[var(--color-accent-destructive)]",
    processing: "bg-[var(--color-accent-processing-bg)] text-[var(--color-accent-processing)]",
    neutral: "bg-gray-100 text-gray-800",
  };
  
  const sizeStyles = {
    sm: "text-xs",
    md: "text-sm",
  };
  
  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {children}
    </span>
  );
}