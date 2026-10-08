import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { forwardRef, useId, type SelectHTMLAttributes } from "react";

export type SelectOption<T extends string | number> = { value: T; label: string };

export type SelectProps<T extends string | number> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> & {
  label?: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Native <select> (free keyboard + mobile support) styled to match Input. */
function SelectInner<T extends string | number>(
  { label, options, value, onChange, id, className, ...props }: SelectProps<T>,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            onChange((typeof value === "number" ? Number(raw) : raw) as T);
          }}
          className={clsx(
            "h-9 w-full appearance-none rounded-field border border-border-strong bg-field pr-9 pl-3 text-sm text-text",
            "transition-colors focus:border-text-muted focus:ring-2 focus:ring-accent-soft focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-bg-subtle",
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  );
}

export const Select = forwardRef(SelectInner) as <T extends string | number>(
  props: SelectProps<T> & { ref?: React.ForwardedRef<HTMLSelectElement> },
) => ReturnType<typeof SelectInner>;
