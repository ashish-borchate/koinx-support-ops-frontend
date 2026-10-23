import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PRODUCT_GUIDE_CATEGORY_OPTIONS,
  PRODUCT_GUIDE_CREATE_CATEGORY_VALUE,
  isPredefinedProductGuideCategory,
  resolveProductGuideCategoryGroup,
} from "@/lib/product-guide-categories";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function ProductGuideCategorySelect({ value, onChange, id }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");

  const selectValue = useMemo(() => {
    if (customMode) return PRODUCT_GUIDE_CREATE_CATEGORY_VALUE;
    if (isPredefinedProductGuideCategory(value)) return value;
    const group = resolveProductGuideCategoryGroup(value);
    if (isPredefinedProductGuideCategory(group) && value !== group) return group;
    if (value.trim() && !isPredefinedProductGuideCategory(value)) return PRODUCT_GUIDE_CREATE_CATEGORY_VALUE;
    return "";
  }, [customMode, value]);

  useEffect(() => {
    if (selectValue === PRODUCT_GUIDE_CREATE_CATEGORY_VALUE) {
      setCustomName(value);
      setCustomMode(true);
    } else if (isPredefinedProductGuideCategory(value)) {
      setCustomMode(false);
    }
  }, [selectValue, value]);

  return (
    <div className="space-y-2">
      <Select
        value={selectValue || undefined}
        onValueChange={(next) => {
          if (next === PRODUCT_GUIDE_CREATE_CATEGORY_VALUE) {
            setCustomMode(true);
            setCustomName("");
            onChange("");
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {PRODUCT_GUIDE_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={PRODUCT_GUIDE_CREATE_CATEGORY_VALUE}>Create new category…</SelectItem>
        </SelectContent>
      </Select>
      {customMode ? (
        <Input
          value={customName}
          onChange={(e) => {
            setCustomName(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="New category name"
          required
          minLength={2}
          autoFocus
        />
      ) : null}
    </div>
  );
}
