"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  pendingText: string;
  className?: string;
}

export function PendingSubmit({ children, pendingText, className = "btn" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
