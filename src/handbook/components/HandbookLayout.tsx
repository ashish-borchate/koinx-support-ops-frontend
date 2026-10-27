import { Outlet } from "react-router-dom";
import { HandbookTopNav } from "./HandbookTopNav";

export function HandbookLayout() {
  return (
    <div className="min-w-0 w-full">
      <HandbookTopNav />
      <Outlet />
    </div>
  );
}
