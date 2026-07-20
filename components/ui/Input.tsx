/** Props for {@link Input}; extends the native `<input>` attributes. */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** `"default"` field styling, or `"heading"` for an inline editable title. Defaults to `"default"`. */
  variant?: "default" | "heading";
  /** Whether the input fills its container's width. Defaults to `true`. */
  fullWidth?: boolean;
}

/**
 * A themed text input wrapping the native `<input>`.
 *
 * @param props - {@link InputProps}; all native input attributes are forwarded.
 * @returns The rendered input element.
 */
export function Input({
  variant = "default",
  fullWidth = true,
  className = "",
  ...props
}: InputProps) {
  const variantStyles = {
    default:
      "rounded-md border border-(--color-border-strong) bg-(--color-surface-input) text-(--color-text-heading) px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring) focus:border-(--color-brand-primary)",
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
