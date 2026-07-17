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

  // Cards are elevated content surfaces on the blue-gray app canvas. They separate from the
  // canvas by tone (lighter than the page) + elevation + border, never a faint border alone.
  const variantStyles = {
    default: `bg-(--color-background-card) border border-(--color-border-card)`,
    // "panel" is a borderless elevated content surface (used for grouped workspace regions);
    // it lifts off the blue-gray page with its own tone + shadow rather than sitting flat on it.
    panel: "bg-(--color-background-card)",
  };

  // Semantic elevation (navy-derived --shadow-* via globals.css utilities); hover raises one level.
  const elevationStyles = shadow ? (hover ? "u-elevation-sm u-elevation-hover" : "u-elevation-sm") : "";

  return (
    <div
      className={`rounded-lg ${variantStyles[variant]} ${paddingStyles[padding]} ${elevationStyles} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
