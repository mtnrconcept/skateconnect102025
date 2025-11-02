import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function Collapse({
  open,
  duration = 300,
  children,
}: { open: boolean; duration?: number; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setMaxHeight(open ? el.scrollHeight : 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  return (
    <div style={{ overflow: 'hidden', maxHeight, transition: `max-height ${duration}ms ease` }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

