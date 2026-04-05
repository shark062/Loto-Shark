import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectSharkOption {
  value: string;
  label: string;
}

interface SelectSharkProps {
  options: SelectSharkOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SelectShark({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  className,
  disabled,
}: SelectSharkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div ref={ref} className={cn("relative select-shark-root", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={cn(
          "select-shark-trigger",
          "w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl",
          "text-sm font-medium text-left outline-none",
          "transition-all duration-200",
          isOpen
            ? "border border-[#00ffcc] shadow-[0_0_14px_rgba(0,255,204,0.25)] bg-[rgba(18,18,42,0.98)]"
            : "border border-white/15 bg-[rgba(18,18,42,0.90)] hover:border-[#00ffcc]/50 hover:shadow-[0_0_8px_rgba(0,255,204,0.12)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className={selectedOption ? "text-white" : "text-white/40"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[#00ffcc]/70 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "select-shark-dropdown",
          "absolute z-[999] left-0 right-0 top-[calc(100%+6px)]",
          "rounded-xl overflow-hidden",
          "transition-all duration-200 origin-top",
          isOpen
            ? "opacity-100 scale-y-100 translate-y-0 pointer-events-auto border border-[#00ffcc]/30 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(0,255,204,0.12)]"
            : "opacity-0 scale-y-95 -translate-y-1 pointer-events-none border border-transparent"
        )}
        style={{
          background: "rgba(10,10,30,0.97)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="select-shark-list max-h-[220px] overflow-y-auto py-1">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-sm text-left",
                  "transition-colors duration-150",
                  isSelected
                    ? "bg-[rgba(0,255,204,0.12)] text-[#00ffcc] font-semibold"
                    : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                )}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] shadow-[0_0_8px_#00ffcc] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
