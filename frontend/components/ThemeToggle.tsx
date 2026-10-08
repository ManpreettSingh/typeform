"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { IconButton, Menu } from "@/components/ui";
import {
  setColorSchemePreference,
  useColorScheme,
  useColorSchemePreference,
  type ColorSchemePreference,
} from "@/lib/colorScheme";

const OPTIONS: { value: ColorSchemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / Dark / System switch for the creator UI. Respondent screens keep each form's own theme. */
export function ThemeToggle() {
  const preference = useColorSchemePreference();
  const scheme = useColorScheme();
  const Icon = scheme === "dark" ? Moon : Sun;

  return (
    <Menu
      items={OPTIONS.map(({ value, label, icon: OptionIcon }) => ({
        label,
        icon: <OptionIcon className="size-4 text-text-muted" aria-hidden />,
        hint: preference === value ? <Check className="size-4 text-accent" aria-label="(current)" /> : null,
        onSelect: () => setColorSchemePreference(value),
      }))}
      trigger={(props) => <IconButton {...props} label="Appearance" icon={<Icon className="size-4" />} />}
    />
  );
}
