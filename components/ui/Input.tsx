interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "heading";
  fullWidth?: boolean;
}

export function Input({
  variant = "default",
  fullWidth = true,
  className = "",
  ...props
}: InputProps) {
  const variantStyles = {
    default:
      "rounded-md border border-(--color-border-card) bg-(--color-background-page) text-(--color-text-body) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring) focus:border-(--color-brand-primary)",
    heading:
      "rounded px-2 py-1 font-bold border-2 border-(--color-brand-primary) text-(length:--font-size-h2) text-(--color-text-heading) focus:outline-none focus:ring-2",
  };

  const widthStyles = fullWidth ? "w-full" : "";

  return (
    <input
      className={`${variantStyles[variant]} ${widthStyles} ${className}`}
      {...props}
    />
  );
}
