import type { TextareaHTMLAttributes } from "react";

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`textarea${className ? ` ${className}` : ""}`}
    />
  );
}
