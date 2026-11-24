import * as React from "react";

import { cn } from "@/lib/utils";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** On phones, show each row as a stacked card (default). Pass false to keep horizontal scroll. */
  mobileStack?: boolean;
}

/** Copies each column header text into data-label on its body cells, for the mobile card layout. */
function labelCells(table: HTMLTableElement) {
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;
  const labels: string[] = [];
  Array.from(headRow.cells).forEach((th) => {
    const text = (th.textContent || "").trim();
    for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text);
  });
  Array.from(table.tBodies).forEach((tb) =>
    Array.from(tb.rows).forEach((tr) => {
      let col = 0;
      Array.from(tr.cells).forEach((td) => {
        const span = td.colSpan || 1;
        const label = span > 1 ? "" : labels[col] || "";
        if (td.getAttribute("data-label") !== label) td.setAttribute("data-label", label);
        col += span;
      });
    }),
  );
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, mobileStack = true, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTableElement | null>(null);
    const setRef = React.useCallback(
      (el: HTMLTableElement | null) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLTableElement | null>).current = el;
      },
      [ref],
    );
    React.useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el || !mobileStack) return;
      labelCells(el);
      const obs = new MutationObserver(() => labelCells(el));
      obs.observe(el, { childList: true, subtree: true, characterData: true });
      return () => obs.disconnect();
    }, [mobileStack]);
    return (
      <div className={cn("app-table-wrap relative w-full overflow-auto rounded-lg border border-border bg-card shadow-sm", mobileStack && "mobile-stack-wrap")}>
        <table
          ref={setRef}
          className={cn("saas-table w-full min-w-[720px] caption-bottom text-sm leading-[1.35] tabular-nums", mobileStack && "mobile-stack", className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("sticky top-0 z-10 border-b border-border bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60 [&_tr]:border-0", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";


const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("divide-y divide-border/60 [&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t border-border bg-muted/60 font-semibold [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "group border-b border-border/40 transition-colors duration-150 hover:bg-primary/[0.035] data-[state=selected]:bg-primary/10",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-10 px-4 text-left align-middle whitespace-nowrap text-[11px] font-semibold uppercase leading-[1.2] tracking-[0.04em] text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";



const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-3 align-middle text-[13px] leading-[1.35] text-foreground md:py-3 [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";


const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
