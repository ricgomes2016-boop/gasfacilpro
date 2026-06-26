import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const FOOTER_CENTER_ID = "system-footer-center";
export const FOOTER_ACTIONS_ID = "system-footer-actions";

/**
 * Renders children inside the DOM node with the given id (if mounted).
 * Watches the body for that node so portals work even when the footer
 * mounts after the consumer.
 */
export function PortalToId({ id, children }: { id: string; children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const find = () => {
      const node = document.getElementById(id);
      if (node !== el) setEl(node);
    };
    find();
    const obs = new MutationObserver(find);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!el) return null;
  return createPortal(children, el);
}

/** Notifies SystemFooter to hide the motivational quote while mounted. */
export function useFooterCenterOverride(active: boolean) {
  useEffect(() => {
    if (!active) return;
    window.dispatchEvent(new CustomEvent("system-footer:center", { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent("system-footer:center", { detail: false }));
    };
  }, [active]);
}
