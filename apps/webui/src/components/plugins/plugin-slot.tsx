"use client";

import type { WebUiExtensionSlot } from "@nami/plugin-api";

import { installedWebUiExtensions } from "./extension-registry";

interface WebUiPluginSlotProps {
  context?: unknown;
  name: WebUiExtensionSlot;
}

export function WebUiPluginSlot({ context, name }: WebUiPluginSlotProps) {
  const extensions = installedWebUiExtensions.forSlot(name);
  if (extensions.length === 0) {
    return null;
  }

  return (
    <>
      {extensions.map((extension) => (
        <div key={extension.id} data-plugin-id={extension.pluginId}>
          {extension.value(context)}
        </div>
      ))}
    </>
  );
}
