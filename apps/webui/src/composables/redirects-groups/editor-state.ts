'use client';

import {
  createEmptyEntry,
  createEmptyGroup,
  type RedirectEntryDraft,
  type RedirectGroup,
} from "./model";
import type { ParsedRedirectConfig } from "./serialization";
import {
  ensureUniqueGroupName,
  findGroupById,
  findParentOf,
  removeGroupById,
  updateGroupById,
} from "./state";

export type GroupsEditorState = {
  slotsKey: string;
  baseConfig: Record<string, unknown>;
  rootGroup: RedirectGroup;
  selectedGroupId: string | null;
  editingGroupId: string | null;
  editingName: string;
};

export type GroupsSnapshot = Pick<
  GroupsEditorState,
  "slotsKey" | "baseConfig" | "rootGroup" | "selectedGroupId"
>;

export function createInitialGroupsEditorState(): GroupsEditorState {
  return {
    slotsKey: "slots",
    baseConfig: {},
    rootGroup: createEmptyGroup("slots"),
    selectedGroupId: null,
    editingGroupId: null,
    editingName: "",
  };
}

export function toSnapshot(state: GroupsEditorState): GroupsSnapshot {
  return {
    slotsKey: state.slotsKey,
    baseConfig: state.baseConfig,
    rootGroup: state.rootGroup,
    selectedGroupId: state.selectedGroupId,
  };
}

export function applySnapshot(
  state: GroupsEditorState,
  snapshot: GroupsSnapshot
): GroupsEditorState {
  return {
    ...state,
    slotsKey: snapshot.slotsKey,
    baseConfig: snapshot.baseConfig,
    rootGroup: snapshot.rootGroup,
    selectedGroupId: snapshot.selectedGroupId,
    editingGroupId: null,
    editingName: "",
  };
}

export function applyParsedConfig(
  state: GroupsEditorState,
  parsed: ParsedRedirectConfig
): GroupsEditorState {
  const nextSelected = parsed.rootGroup.children.at(0)?.id ?? parsed.rootGroup.id;
  return {
    ...state,
    slotsKey: parsed.slotsKey,
    baseConfig: parsed.baseConfig,
    rootGroup: parsed.rootGroup,
    selectedGroupId: nextSelected,
    editingGroupId: null,
    editingName: "",
  };
}

export function getSelectedGroup(state: GroupsEditorState): RedirectGroup | null {
  if (!state.selectedGroupId) {
    return null;
  }
  return findGroupById(state.rootGroup, state.selectedGroupId);
}

export function getGroupById(state: GroupsEditorState, groupId: string): RedirectGroup | null {
  return findGroupById(state.rootGroup, groupId);
}

export function selectGroup(state: GroupsEditorState, groupId: string): GroupsEditorState {
  return { ...state, selectedGroupId: groupId };
}

export function beginRename(state: GroupsEditorState, groupId: string): GroupsEditorState {
  const group = findGroupById(state.rootGroup, groupId);
  if (!group) {
    return state;
  }
  return { ...state, editingGroupId: groupId, editingName: group.name };
}

export function cancelRename(state: GroupsEditorState): GroupsEditorState {
  return { ...state, editingGroupId: null, editingName: "" };
}

export function commitRename(
  state: GroupsEditorState,
  groupId: string,
  fallbackNewGroupName: string
): GroupsEditorState {
  const parent = findParentOf(state.rootGroup, groupId);
  if (!parent) {
    return cancelRename(state);
  }

  const nextName = ensureUniqueGroupName(
    parent,
    groupId,
    state.editingName,
    fallbackNewGroupName
  );

  const [nextRoot] = updateGroupById(state.rootGroup, groupId, (group) => ({
    ...group,
    name: nextName,
  }));

  return {
    ...state,
    rootGroup: nextRoot,
    editingGroupId: null,
    editingName: "",
  };
}

export function addGroup(
  state: GroupsEditorState,
  parentId: string,
  defaultNewGroupName: string
): GroupsEditorState {
  const parent = findGroupById(state.rootGroup, parentId);
  if (!parent) {
    return state;
  }

  const name = ensureUniqueGroupName(parent, null, defaultNewGroupName, defaultNewGroupName);
  const group = createEmptyGroup(name);

  const [nextRoot] = updateGroupById(state.rootGroup, parentId, (g) => ({
    ...g,
    children: [...g.children, group],
  }));

  return {
    ...state,
    rootGroup: nextRoot,
    selectedGroupId: group.id,
    editingGroupId: group.id,
    editingName: group.name,
  };
}

export function addEntry(
  state: GroupsEditorState,
  groupId: string,
  draft?: RedirectEntryDraft,
): GroupsEditorState {
  const [nextRoot] = updateGroupById(state.rootGroup, groupId, (group) => ({
    ...group,
    entries: [...group.entries, createEmptyEntry(draft)],
  }));
  return { ...state, rootGroup: nextRoot };
}

export function removeEntry(
  state: GroupsEditorState,
  groupId: string,
  entryId: string
): GroupsEditorState {
  const [nextRoot] = updateGroupById(state.rootGroup, groupId, (group) => {
    const nextEntries = group.entries.filter((entry) => entry.id !== entryId);
    const normalizedEntries =
      nextEntries.length === 0 && group.children.length === 0
        ? [createEmptyEntry()]
        : nextEntries;
    return { ...group, entries: normalizedEntries };
  });
  return { ...state, rootGroup: nextRoot };
}

export function updateEntry(
  state: GroupsEditorState,
  groupId: string,
  entryId: string,
  draft: RedirectEntryDraft,
): GroupsEditorState {
  const [nextRoot] = updateGroupById(state.rootGroup, groupId, (group) => ({
    ...group,
    entries: group.entries.map((entry) =>
      entry.id === entryId ? { ...entry, ...draft } : entry
    ),
  }));
  return { ...state, rootGroup: nextRoot };
}

export function removeGroupConfirmed(state: GroupsEditorState, groupId: string): GroupsEditorState {
  if (groupId === state.rootGroup.id) {
    return state;
  }

  const [nextRoot, changed] = removeGroupById(state.rootGroup, groupId);
  if (!changed) {
    return state;
  }

  const nextSelectedGroupId = state.selectedGroupId === groupId ? nextRoot.id : state.selectedGroupId;
  const isEditingRemoved = state.editingGroupId === groupId;

  return {
    ...state,
    rootGroup: nextRoot,
    selectedGroupId: nextSelectedGroupId,
    editingGroupId: isEditingRemoved ? null : state.editingGroupId,
    editingName: isEditingRemoved ? "" : state.editingName,
  };
}
