'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  addEntry as addEntryState,
  addGroup as addGroupState,
  applyParsedConfig,
  applySnapshot,
  beginRename as beginRenameState,
  cancelRename as cancelRenameState,
  commitRename as commitRenameState,
  createInitialGroupsEditorState,
  getSelectedGroup,
  removeEntry as removeEntryState,
  removeGroupConfirmed,
  selectGroup as selectGroupState,
  toSnapshot,
  updateEntryKey as updateEntryKeyState,
  updateEntryValue as updateEntryValueState,
  type GroupsSnapshot,
} from "./editor-state";
import type { RedirectEntryDraft } from "./model";
import { useRedirectsConfigFile } from "./config-file";
import { useUndoRedo } from "./history";
import {
  buildConfig,
  DuplicateRedirectKeyError,
  InvalidRedirectConfigError,
  parseInitialContent,
} from "./serialization";

export function useRedirectsGroups() {
  const tGroups = useTranslations("groups");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState(createInitialGroupsEditorState);
  const configFile = useRedirectsConfigFile({
    fallbackLoadErrorText: tGroups("loadFail"),
    fallbackSaveErrorText: tGroups("saveFail"),
    saveOkText: tGroups("saveOk"),
    commitMessage: "chore(redirects): update rules",
  });

  const loadConfig = configFile.load;
  const saveConfig = configFile.save;
  const configSourceUrl = configFile.sourceUrl;

  const formatSerializationError = useCallback(
    (error: unknown) => error instanceof DuplicateRedirectKeyError
      ? tGroups("duplicateKey", { key: error.key, group: error.groupName })
      : error instanceof InvalidRedirectConfigError
        ? tGroups(error.reason === "json" ? "invalidJson" : "invalidRoot")
      : error instanceof Error
        ? error.message
        : tGroups("saveFail"),
    [tGroups],
  );

  const { canUndo, canRedo, pushCurrentSnapshot, undo, redo, resetHistory } = useUndoRedo<GroupsSnapshot>({
    maxHistory: 50,
    getCurrentSnapshot: () => toSnapshot(editorState),
    applySnapshot: (snapshot) => setEditorState((prev) => applySnapshot(prev, snapshot)),
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setLoadError(null);
      setSaveValidationError(null);

      try {
        const content = await loadConfig();
        const parsed = await parseInitialContent(content);

        if (cancelled) {
          return;
        }

        setEditorState((prev) => applyParsedConfig(prev, parsed));

        resetHistory();
      } catch (error) {
        if (!cancelled) {
          setLoadError(formatSerializationError(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [formatSerializationError, loadConfig, resetHistory]);

  const loadFromUrl = useCallback(
    async (sourceUrl: string) => {
      setIsLoading(true);
      setLoadError(null);
      setSaveValidationError(null);

      try {
        const content = await loadConfig(sourceUrl);
        const parsed = await parseInitialContent(content);
        setEditorState((prev) => applyParsedConfig(prev, parsed));
        resetHistory();
      } catch (error) {
        const message = formatSerializationError(error);
        setLoadError(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [formatSerializationError, loadConfig, resetHistory]
  );

  const selectedGroup = useMemo(() => {
    return getSelectedGroup(editorState);
  }, [editorState]);

  const slotsKey = editorState.slotsKey;
  const baseConfig = editorState.baseConfig;
  const rootGroup = editorState.rootGroup;
  const selectedGroupId = editorState.selectedGroupId;
  const editingGroupId = editorState.editingGroupId;
  const editingName = editorState.editingName;

  const selectGroup = useCallback((groupId: string) => {
    setEditorState((prev) => selectGroupState(prev, groupId));
  }, []);

  const beginRename = useCallback((groupId: string) => {
    setEditorState((prev) => beginRenameState(prev, groupId));
  }, []);

  const cancelRename = useCallback(() => {
    setEditorState((prev) => cancelRenameState(prev));
  }, []);

  const commitRename = useCallback(
    (groupId: string) => {
      pushCurrentSnapshot();
      setEditorState((prev) => commitRenameState(prev, groupId, tGroups("newGroup")));
    },
    [pushCurrentSnapshot, tGroups]
  );

  const addGroup = useCallback((parentId: string) => {
    pushCurrentSnapshot();
    setEditorState((prev) => addGroupState(prev, parentId, tGroups("newGroup")));
  }, [pushCurrentSnapshot, tGroups]);

  const addEntry = useCallback((groupId: string, draft?: RedirectEntryDraft) => {
    pushCurrentSnapshot();
    setEditorState((prev) => addEntryState(prev, groupId, draft));
  }, [pushCurrentSnapshot]);

  const removeEntry = useCallback((groupId: string, entryId: string) => {
    pushCurrentSnapshot();
    setEditorState((prev) => removeEntryState(prev, groupId, entryId));
  }, [pushCurrentSnapshot]);

  const updateEntryKey = useCallback((groupId: string, entryId: string, nextKey: string) => {
    pushCurrentSnapshot();
    setEditorState((prev) => updateEntryKeyState(prev, groupId, entryId, nextKey));
  }, [pushCurrentSnapshot]);

  const updateEntryValue = useCallback((groupId: string, entryId: string, nextValue: unknown) => {
    pushCurrentSnapshot();
    setEditorState((prev) => updateEntryValueState(prev, groupId, entryId, nextValue));
  }, [pushCurrentSnapshot]);

  const removeGroup = useCallback(
    (groupId: string) => {
      if (groupId === rootGroup.id) {
        return;
      }

      pushCurrentSnapshot();
      setEditorState((prev) => removeGroupConfirmed(prev, groupId));
    },
    [pushCurrentSnapshot, rootGroup]
  );

  const applyJson = useCallback(
    async (content: string) => {
      const parsed = await parseInitialContent(content).catch((error: unknown) => {
        throw new Error(formatSerializationError(error));
      });

      pushCurrentSnapshot();

      setEditorState((prev) => applyParsedConfig(prev, parsed));

      return JSON.stringify(
        buildConfig(parsed.rootGroup, parsed.baseConfig, parsed.slotsKey),
        null,
        2,
      );
    },
    [formatSerializationError, pushCurrentSnapshot]
  );

  const save = useCallback(async (overrideContent?: string): Promise<boolean> => {
    try {
      const content = overrideContent
        ?? JSON.stringify(buildConfig(rootGroup, baseConfig, slotsKey), null, 2);
      setSaveValidationError(null);
      return await saveConfig(content);
    } catch (error) {
      setSaveValidationError(formatSerializationError(error));
      return false;
    }
  }, [baseConfig, formatSerializationError, rootGroup, saveConfig, slotsKey]);

  const discardChanges = useCallback(async (): Promise<boolean> => {
    if (!configFile.lastSavedContent) {
      return false;
    }

    try {
      const parsed = await parseInitialContent(configFile.lastSavedContent);
      setEditorState((prev) => applyParsedConfig(prev, parsed));
      setSaveValidationError(null);
      resetHistory();
      return true;
    } catch (error) {
      setSaveValidationError(formatSerializationError(error));
      return false;
    }
  }, [
    configFile.lastSavedContent,
    formatSerializationError,
    resetHistory,
  ]);

  const previewJson = useMemo(() => {
    try {
      const config = buildConfig(rootGroup, baseConfig, slotsKey);
      return JSON.stringify(config, null, 2);
    } catch (error) {
      return tGroups("previewFailWithMessage", {
        message: formatSerializationError(error),
      });
    }
  }, [baseConfig, formatSerializationError, rootGroup, slotsKey, tGroups]);

  return {
    isLoading,
    loadError,
    configSourceUrl,
    loadFromUrl,
    slotsKey,
    rootGroup,
    selectedGroupId,
    selectedGroup,
    selectGroup,
    editingGroupId,
    editingName,
    setEditingName: (value: string) => setEditorState((prev) => ({ ...prev, editingName: value })),
    beginRename,
    cancelRename,
    commitRename,
    addGroup,
    addEntry,
    removeEntry,
    updateEntryKey,
    updateEntryValue,
    removeGroup,
    canUndo,
    canRedo,
    undo,
    redo,
    isPending: configFile.isPending,
    canonicalOrigin: configFile.canonicalOrigin,
    save,
    discardChanges,
    applyJson,
    previewJson,
    resultMessage: saveValidationError ?? configFile.resultMessage,
    resultStatus: saveValidationError ? "error" : configFile.resultStatus,
    lastCommitUrl: configFile.lastCommitUrl,
    lastSavedContent: configFile.lastSavedContent,
  };
}
