"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";

/**
 * Props for {@link PasswordInput}: native input attributes minus `type` (fixed to
 * password/text by the visibility toggle), plus `fullWidth`.
 */
type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Whether the input fills its container's width (forwarded to {@link Input}). */
  fullWidth?: boolean;
};

/**
 * A password field with a show/hide visibility toggle.
 *
 * Manages a single `visible` boolean that swaps the underlying input between
 * `type="password"` and `type="text"`; the toggle button exposes `aria-pressed` and a
 * descriptive `aria-label` for assistive tech. No side effects beyond local state.
 *
 * @param props - {@link PasswordInputProps}; native input attributes are forwarded to {@link Input}.
 * @returns The rendered password field with its toggle button.
 */
export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={`pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-(--color-text-meta) hover:text-(--color-text-body) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded-md"
      >
        {visible ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.86 21.86 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.86 21.86 0 0 1-3.22 4.56M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <path d="M1 1l22 22" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
