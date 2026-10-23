import { Button } from "@/components/ui/button";
import { externalLinkProps } from "@/lib/documentation-links";

/** Matches primary `Report Issue` action button styling. */
export function ViewOnWebsiteButton({ href }: { href: string }) {
  if (!href) return null;
  return (
    <Button size="sm" asChild>
      <a {...externalLinkProps(href)}>View on Website</a>
    </Button>
  );
}
