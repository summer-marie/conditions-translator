interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // "primary" is the default navy action (Sign In, Create Account, Send, New Document, general
  // primary actions). "confirm" is the green success action, reserved for Save/Confirm/Complete
  // (e.g. "Save workspace") per the approved semantic color rules.
  variant?: "primary" | "confirm" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    // General primary action = deep navy (identity), NOT green.
    primary: "bg-(--color-brand-primary) text-(--color-text-inverse) hover:bg-(--color-brand-primary-light) focus:ring-(--color-brand-primary)",
    // Green success action, self-contained solid button (Save/Confirm/Complete only).
    confirm: "bg-(--color-accent-success) text-white hover:bg-emerald-700 focus:ring-(--color-accent-success)",
    secondary: "border border-(--color-border-strong) text-(--color-text-body) hover:bg-(--color-background-subtle) focus:ring-(--color-border-strong)",
    // A solid button's own bg/text contrast is self-contained and shouldn't shift with
    // page theme, unlike text-on-page-background uses of --color-accent-destructive
    // (which does need a lighter dark-mode value -- see tokens.css). Uses a fixed strong
    // red so this button looks identical in both themes.
    danger: "bg-red-700 text-white hover:bg-red-800 focus:ring-(--color-accent-destructive)",
    ghost: "text-(--color-text-body) hover:bg-(--color-background-subtle) focus:ring-(--color-border-strong)",
  };
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  
  const widthStyles = fullWidth ? "w-full" : "";
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
}