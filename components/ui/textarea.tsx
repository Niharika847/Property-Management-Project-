import { type TextareaHTMLAttributes, forwardRef, useId } from "react";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, className = "", id, ...rest }, ref) => {
    const autoId = useId();
    const areaId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={areaId} className="text-sm font-medium text-ink">
          {label}
        </label>
        <textarea
          ref={ref}
          id={areaId}
          rows={3}
          className={`rounded-(--radius-field) border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted/70 ${className}`}
          {...rest}
        />
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
