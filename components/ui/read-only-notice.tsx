type ReadOnlyNoticeProps = {
  message: string;
};

export function ReadOnlyNotice({ message }: ReadOnlyNoticeProps) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-[var(--shadow)]">
      <div className="font-medium">Hosted preview is read-only.</div>
      <div className="mt-1 leading-6">{message}</div>
    </div>
  );
}
