import type { ReactNode } from "react";

type InfoCardProps = {
  title: string;
  body: string;
  children?: ReactNode;
};

export function InfoCard({ title, body, children }: InfoCardProps) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)] backdrop-blur">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

