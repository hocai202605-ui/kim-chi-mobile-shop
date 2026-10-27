"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Keep each grid's export behavior while placing its control beside the store filter. */
export function ExcelExportPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById("header-excel-exports"));
  }, []);

  return target ? createPortal(children, target) : null;
}
