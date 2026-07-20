/** Props for {@link Alert}. */
interface AlertProps {
  /** Semantic color tone, selecting the background and border token pair. */
  tone: "success" | "warning" | "destructive" | "processing";
  /** Whether to draw the tone-colored border. Defaults to `true`. */
  bordered?: boolean;
  /** Corner radius. Defaults to `"md"`. */
  radius?: "md" | "lg";
  /** Inner padding scale. Defaults to `"lg"`. */
  padding?: "xs" | "sm" | "md" | "lg";
  /** Extra classes appended to the computed class list. */
  className?: string;
  /**
   * ARIA live-region role. Set only on alerts that appear or change without a page
   * navigation (errors, warnings) so screen readers announce them; omit for static,
   * always-present status panels.
   */
  role?: "alert" | "status";
  /** Alert content. */
  children: React.ReactNode;
}

/**
 * A tonal, optionally-bordered callout box for status and error messaging.
 *
 * @param props - {@link AlertProps}.
 * @returns The rendered alert container.
 */
export function Alert({
  tone,
  bordered = true,
  radius = "md",
  padding = "lg",
  className = "",
  role,
  children,
}: AlertProps) {
  const toneBg = {
    success: "bg-(--color-accent-success-bg)",
    warning: "bg-(--color-accent-warning-bg)",
    destructive: "bg-(--color-accent-destructive-bg)",
    processing: "bg-(--color-accent-processing-bg)",
  };

  const toneBorder = {
    success: "border-(--color-accent-success)",
    warning: "border-(--color-accent-warning)",
    destructive: "border-(--color-accent-destructive)",
    processing: "border-(--color-accent-processing)",
  };

  const radiusStyles = {
    md: "rounded-md",
    lg: "rounded-lg",
  };

  const paddingStyles = {
    xs: "p-2",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      role={role}
      className={`${radiusStyles[radius]} ${toneBg[tone]} ${paddingStyles[padding]} ${
        bordered ? `border ${toneBorder[tone]}` : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
