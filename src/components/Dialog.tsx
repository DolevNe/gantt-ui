import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  description?: ReactNode;
  onClose?: () => void;
  role?: 'dialog' | 'alertdialog';
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

/** Modal with Escape to close, focus moved inside on open and restored on close. */
export function Dialog({ title, description, onClose, role = 'dialog', wide, children, footer }: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
    first?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div className="scrim">
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={id}
        className={wide ? 'dialog dialog-wide' : 'dialog'}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onClose) {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="dialog-head">
          <h2 id={id} className="h2">{title}</h2>
          {description && <p className="muted">{description}</p>}
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
