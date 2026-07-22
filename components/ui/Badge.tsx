/** Props for {@link Badge}. */
interface BadgeProps {
  /** Semantic color variant selecting the background/text token pair. */
  variant: "success" | "warning" | "destructive" | "processing" | "neutral";
  /** Text size. Defaults to `"md"`. */
  size?: "sm" | "md";
  /** Extra classes appended to the computed class list. */
  className?: string;
  /** Badge label. */
  children: React.ReactNode;
}

/**
 * A small pill label for statuses and counts.
 *
 * @param props - {@link BadgeProps}.
 * @returns The rendered badge span.
 */
export function Badge({ variant, size = "md", className = "", children }: BadgeProps) {
  const baseStyles = "inline-flex items-center text-center px-2.5 py-0.5 rounded-full font-medium";
  
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