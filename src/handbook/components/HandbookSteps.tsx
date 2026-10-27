export function HandbookSteps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="my-4 list-none space-y-3 border-l-2 border-primary/25 pl-0 [counter-reset:step]">
      {children}
    </ol>
  );
}

export function HandbookStep({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-10 [counter-increment:step] before:absolute before:left-0 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-xs before:font-semibold before:text-primary-foreground before:content-[counter(step)]">
      {title ? <p className="mb-1 font-medium text-foreground">{title}</p> : null}
      <div className="text-sm text-foreground/90">{children}</div>
    </li>
  );
}
