import type { ReactNode } from 'react';

interface PagePlaceholderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function PagePlaceholder({ title, description, icon }: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in-up">
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-lg">
          {icon}
        </div>
      )}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="mt-2 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-2 text-xs text-muted-foreground">
        This page will be fully implemented in the next milestone.
      </div>
    </div>
  );
}
