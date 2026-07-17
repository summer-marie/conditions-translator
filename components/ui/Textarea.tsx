interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  fullWidth?: boolean;
  invalid?: boolean;
}

export function Textarea({
  fullWidth = true,
  invalid = false,
  className = "",
  ...props
}: TextareaProps) {
  const baseStyles =
    "rounded-md border bg-(--color-background-page) text-(--color-text-body) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-(--color-brand-primary)";

  const borderStyles = invalid
    ? "border-(--color-accent-destructive) focus:ring-(--color-accent-destructive)"
    : "border-(--color-border-card) focus:ring-(--color-border-focus-ring)";

  const widthStyles = fullWidth ? "w-full" : "";

  return (
    <textarea
      className={`${baseStyles} ${borderStyles} ${widthStyles} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
