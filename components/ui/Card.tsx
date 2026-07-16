interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "panel";
  padding?: "sm" | "md" | "lg";
  shadow?: boolean;
  hover?: boolean;
}

export function Card({
  variant = "default",
  padding = "md",
  shadow = true,
  hover = false,
  className = "",
  style,
  children,
  ...props
}: CardProps) {
  const paddingStyles = {
    sm: "p-3",
    md: "p-6",
    lg: "p-8",
  };

  const variantStyles = {
    default: `bg-(--color-background-card) border border-(--color-border-card)${shadow ? " shadow-sm" : ""}`,
    panel: "bg-(--color-background-page)",
  };

  const hoverStyles = hover ? "hover:shadow-md transition-shadow" : "";

  // The "panel" variant matches workspace's pre-existing inline-style shadow
  // (var(--shadow-sm)), which is a different value than Tailwind's built-in
  // shadow-sm utility used by the "default" variant -- kept separate so neither
  // surface's existing shadow appearance shifts.
  const panelShadowStyle =
    variant === "panel" && shadow ? { boxShadow: "var(--shadow-sm)" } : undefined;

  return (
    <div
      className={`rounded-lg ${variantStyles[variant]} ${paddingStyles[padding]} ${hoverStyles} ${className}`}
      style={{ ...panelShadowStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
