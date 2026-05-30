import { type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  fullWidth?: boolean;
};

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
  secondary: "bg-slate-200 text-slate-800 hover:bg-slate-300 disabled:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
