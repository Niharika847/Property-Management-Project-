import { type SelectHTMLAttributes, forwardRef, useId } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, className = "", id, children, ...rest }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={`h-10 rounded-(--radius-field) border border-line bg-card px-3 text-sm text-ink ${className}`}
          {...rest}
        >
          {children}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";
