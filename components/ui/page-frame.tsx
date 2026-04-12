import type { ReactNode } from "react";

type Metric = {
  label: string;
  value: string;
  hint: string;
};

type PageFrameProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Metric[];
  children?: ReactNode;
};

export function PageFrame({
  eyebrow,
  title,
  description,
  metrics = [],
  children,
}: PageFrameProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {eyebrow}
        </p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--muted)]">
              {description}
            </p>
          </div>

          {metrics.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {metric.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{metric.value}</div>
                  <div className="mt-1 text-sm leading-5 text-[var(--muted)]">
                    {metric.hint}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

