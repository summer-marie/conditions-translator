/** Props for {@link Card}; extends the native `<div>` attributes. */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `"default"` (bordered surface) or `"panel"` (borderless grouped region). Defaults to `"default"`. */
  variant?: "default" | "panel";
  /** Inner padding scale. Defaults to `"md"`. */
  padding?: "sm" | "md" | "lg";
  /** Whether to apply elevation shadow. Defaults to `true`. */
  shadow?: boolean;
  /** Whether hovering raises the card one elevation level. Defaults to `false`. */
  hover?: boolean;
}

/**
 * An elevated content surface for the blue-gray app canvas.
 *
 * Forwards remaining native `<div>` attributes. Cards separate from the canvas by a lighter
 * tone plus elevation and (for the default variant) a border — never a faint border alone.
 *
 * @param props - {@link CardProps}; `children` is the card content.
 * @returns The rendered card container.
 */
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
    // Default: lighter card tone plus a card border to lift it off the page.
    default: `bg-(--color-background-card) border border-(--color-border-card)`,
    // Panel: borderless grouped region that lifts off the page by tone + shadow alone.
    panel: "bg-(--color-background-card)",
  };

  // Navy-derived elevation via globals.css utilities; hover bumps it up one level.
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
