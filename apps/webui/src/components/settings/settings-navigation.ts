export type SettingsCategory =
  | "runtime"
  | "analytics"
  | "access"
  | "installed-plugins"
  | "data";

export function shouldConfirmSettingsCategoryChange(
  category: SettingsCategory,
  hasUnsavedChanges: boolean,
): boolean {
  return category === "data" && hasUnsavedChanges;
}

export function shouldShowSettingsSaveAction(
  category: SettingsCategory,
): boolean {
  return category !== "data";
}
