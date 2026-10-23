import { ModuleSubnav } from "@/components/bits";

const LINKS = [
  { to: "/product-guides", label: "Guides" },
  { to: "/product-guides/tasks", label: "Tasks" },
];

export function ProductGuideSubnav() {
  return <ModuleSubnav links={LINKS} />;
}
