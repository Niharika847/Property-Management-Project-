import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "bg-card text-ink border border-line hover:bg-brand-soft/60 disabled:opacity-50",
  ghost: "text-muted hover:text-ink hover:bg-brand-soft/50",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", loading, className = "", children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-field) px-4 text-sm font-semibold transition-colors ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";
