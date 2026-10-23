/** Top-level Mintlify-style sections (display order). */
export const PRODUCT_GUIDE_CATEGORY_OPTIONS = [
  "Getting Started",
  "Integration",
  "Transactions",
  "Tax Report",
  "Tax Settings",
  "Portfolio tracker",
  "Account Management",
  "Billing",
  "ITR Filing Articles",
  "Insights",
  "Tax Professional",
  "FAQ's",
] as const;

export type ProductGuideCategoryOption = (typeof PRODUCT_GUIDE_CATEGORY_OPTIONS)[number];

export const PRODUCT_GUIDE_CREATE_CATEGORY_VALUE = "__create_new_category__";

const GROUP_PREFIX_RULES: { group: ProductGuideCategoryOption; test: (value: string) => boolean }[] = [
  { group: "Getting Started", test: (v) => /^getting started/i.test(v) },
  { group: "Integration", test: (v) => /^integrations/i.test(v) },
  { group: "Transactions", test: (v) => /^transactions/i.test(v) },
  { group: "Tax Report", test: (v) => /^tax reports/i.test(v) },
  { group: "Tax Settings", test: (v) => /^tax settings/i.test(v) },
  { group: "Portfolio tracker", test: (v) => /^portfolio tracker/i.test(v) },
  { group: "Account Management", test: (v) => /^account management/i.test(v) },
  { group: "Billing", test: (v) => /^billing/i.test(v) },
  { group: "ITR Filing Articles", test: (v) => /^itr filing articles/i.test(v) },
  { group: "Insights", test: (v) => /^insights/i.test(v) },
  { group: "Tax Professional", test: (v) => /^tax professional/i.test(v) },
  { group: "FAQ's", test: (v) => /^faqs/i.test(v) },
];

export function isPredefinedProductGuideCategory(value: string): value is ProductGuideCategoryOption {
  return (PRODUCT_GUIDE_CATEGORY_OPTIONS as readonly string[]).includes(value);
}

/** Maps stored `productArea` (including nested Mintlify paths) to a top-level section. */
export function resolveProductGuideCategoryGroup(productArea: string): string {
  const raw = (productArea || "").trim();
  if (!raw || raw === "(none)") return "Getting Started";
  if (isPredefinedProductGuideCategory(raw)) return raw;
  for (const rule of GROUP_PREFIX_RULES) {
    if (rule.test(raw)) return rule.group;
  }
  return raw;
}

export function productGuideCategorySortIndex(group: string): number {
  const idx = (PRODUCT_GUIDE_CATEGORY_OPTIONS as readonly string[]).indexOf(group);
  return idx === -1 ? PRODUCT_GUIDE_CATEGORY_OPTIONS.length + 1 : idx;
}

export function compareProductGuidesByCategory(a: { productArea: string; title: string }, b: { productArea: string; title: string }) {
  const ga = productGuideCategorySortIndex(resolveProductGuideCategoryGroup(a.productArea));
  const gb = productGuideCategorySortIndex(resolveProductGuideCategoryGroup(b.productArea));
  if (ga !== gb) return ga - gb;
  const area = a.productArea.localeCompare(b.productArea);
  if (area !== 0) return area;
  return a.title.localeCompare(b.title);
}

/** Sub-label under a section header (nested path tail). */
export function formatGuideCategoryDetail(productArea: string): string {
  const raw = (productArea || "").trim();
  if (!raw || raw === "(none)") return "—";
  if (isPredefinedProductGuideCategory(raw)) return raw;
  const parts = raw.split("›").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) return parts.slice(1).join(" › ");
  return raw;
}

export type ProductGuideCategorySection = { label: string; guides: { productArea: string; title: string }[] };

export function groupProductGuidesByCategory<T extends { productArea: string; title: string }>(
  guides: T[],
  categoryFilter: string,
): { label: string; guides: T[] }[] {
  const filtered =
    categoryFilter === "all"
      ? guides
      : guides.filter((g) => resolveProductGuideCategoryGroup(g.productArea) === categoryFilter);

  const sorted = [...filtered].sort(compareProductGuidesByCategory);

  const labels =
    categoryFilter !== "all"
      ? [categoryFilter]
      : [
          ...PRODUCT_GUIDE_CATEGORY_OPTIONS.filter((label) =>
            sorted.some((g) => resolveProductGuideCategoryGroup(g.productArea) === label),
          ),
          ...[
            ...new Set(
              sorted
                .map((g) => resolveProductGuideCategoryGroup(g.productArea))
                .filter((label) => !(PRODUCT_GUIDE_CATEGORY_OPTIONS as readonly string[]).includes(label)),
            ),
          ].sort((a, b) => a.localeCompare(b)),
        ];

  return labels
    .map((label) => ({
      label,
      guides: sorted.filter((g) => resolveProductGuideCategoryGroup(g.productArea) === label),
    }))
    .filter((section) => section.guides.length > 0);
}
