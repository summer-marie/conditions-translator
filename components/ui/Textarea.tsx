/** Props for {@link Textarea}; extends the native `<textarea>` attributes. */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Whether the textarea fills its container's width. Defaults to `true`. */
  fullWidth?: boolean;
  /** When true, applies destructive-tone borders and sets `aria-invalid`. Defaults to `false`. */
  invalid?: boolean;
}

/**
 * A themed multi-line text input wrapping the native `<textarea>`.
 *
 * @param props - {@link TextareaProps}; all native textarea attributes are forwarded.
 * @returns The rendered textarea element.
 */
export function Textarea({
  fullWidth = true,
  invalid = false,
  className = "",
  ...props
}: TextareaProps) {
  const baseStyles =
    "rounded-md border bg-(--color-surface-input) text-(--color-text-heading) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-(--color-brand-primary)";

  const borderStyles = invalid
    ? "border-(--color-accent-destructive) focus:ring-(--color-accent-destructive)"
    : "border-(--color-border-strong) focus:ring-(--color-border-focus-ring)";

  const widthStyles = fullWidth ? "w-full" : "";

  return (
    <textarea
      className={`${baseStyles} ${borderStyles} ${widthStyles} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
