interface BadgeProps {
  variant: "success" | "warning" | "destructive" | "processing" | "neutral";
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant, size = "md", className = "", children }: BadgeProps) {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full font-medium";
  
  const variantStyles = {
    success: "bg-(--color-accent-success-bg) text-(--color-accent-success)",
    warning: "bg-(--color-accent-warning-bg) text-(--color-accent-warning)",
    destructive: "bg-(--color-accent-destructive-bg) text-(--color-accent-destructive)",
    processing: "bg-(--color-accent-processing-bg) text-(--color-accent-processing)",
    neutral: "bg-(--color-background-subtle) text-(--color-text-body)",
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