"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { DataConfig } from "@i0c/config";

import { AppShell } from "@/components/ui/layout/app-shell";
import {
  AppSidebarPrimaryNavigation,
  AppSidebarSectionHeader,
  AppSidebarSettingsNavigation,
} from "@/components/ui/layout/app-sidebar-navigation";
import {
  ContentSkeleton,
  SettingsSkeleton,
  SidebarSkeletonBody,
  SidebarSkeletonCatalog,
  SidebarSettingsSkeleton,
} from "@/components/ui/feedback/skeletons";
import { ConfirmationDialog } from "@/components/ui/feedback/confirmation-dialog";
import { SaveNotification } from "@/components/ui/feedback/save-notification";
import { GroupEntriesEditor } from "@/components/editor/group-entries-editor";
import { JsonEditor } from "@/components/editor/json-editor";
import { NewRouteEntryDialog } from "@/components/editor/new-route-entry-dialog";
import { RightPanel, type EditorMode } from "@/components/editor/right-panel";
import { UnsavedChangesDialog } from "@/components/editor/unsaved-changes-dialog";
import {
  useRedirectsGroups,
  type RedirectsMutationResult,
} from "@/composables/redirects-groups";
import type {
  RedirectEntryDraft,
  RedirectGroup,
} from "@/composables/redirects-groups/model";
import { useDataConfigFile } from "@/composables/data-config/use-data-config-file";
import { RouteEntriesCatalog } from "@/components/redirects-groups/manager-sidebar/manager-sidebar-catalog";
import { RuntimeSettingsProvider } from "@/components/redirects-groups/runtime-settings-context";
import { InstanceSettingsEditor } from "@/components/settings/instance-settings-editor";
import {
  shouldConfirmSettingsCategoryChange,
  shouldShowSettingsSaveAction,
  type SettingsCategory,
} from "@/components/settings/settings-navigation";
import { validateInstanceDataConfig } from "@/lib/configuration/validation";
import { useRouter } from "@/i18n/navigation";

import { ManagerSidebarBody } from "./manager-sidebar/manager-sidebar-body";

interface RedirectsGroupsManagerProps {
  initialView?: "rules" | "settings";
  isReadOnly?: boolean;
  usesManualSave?: boolean;
  supportsJsonEditor?: boolean;
  supportsSourceOverride?: boolean;
}

interface PendingLeave {
  kind: "rules" | "settings";
  proceed: () => void;
}

export function RedirectsGroupsManager({
  initialView = "rules",
  isReadOnly = false,
  usesManualSave = true,
  supportsJsonEditor = false,
  supportsSourceOverride = false,
}: RedirectsGroupsManagerProps) {
  const tGroups = useTranslations("groups");
  const tEntries = useTranslations("entries");
  const tEditor = useTranslations("editor");
  const tConfig = useTranslations("instanceConfig");
  const tHeader = useTranslations("header");
  const router = useRouter();
  const hasHandledInitialSettings = useRef(false);

  const {
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
    setEditingName,
    beginRename,
    cancelRename,
    commitRename,
    addGroup,
    addEntry,
    removeEntry,
    updateEntry,
    removeGroup,
    canUndo,
    canRedo,
    undo,
    redo,
    isPending,
    canonicalOrigin,
    save,
    discardChanges,
    applyJson,
    previewJson,
    resultMessage,
    resultStatus,
    lastCommitUrl,
    lastSavedContent,
  } = useRedirectsGroups({ usesManualSave });

  const [editorMode, setEditorMode] = useState<EditorMode>(
    initialView === "settings" ? "settings" : "rules",
  );
  const [sidebarLayer, setSidebarLayer] = useState<"primary" | "section">(
    initialView === "settings" ? "primary" : "section",
  );
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState("");
  const [configValue, setConfigValue] = useState<DataConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [settingsCategory, setSettingsCategory] =
    useState<SettingsCategory>("runtime");
  const [lastSaveTarget, setLastSaveTarget] = useState<"rules" | "settings">("rules");
  const [localSaveError, setLocalSaveError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null);
  const [isResolvingLeave, setIsResolvingLeave] = useState(false);
  const [newEntryGroupId, setNewEntryGroupId] = useState<string | null>(null);
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | null>(null);
  const [deleteGroupError, setDeleteGroupError] = useState<string | null>(null);
  const dataConfigFile = useDataConfigFile({
    fallbackLoadErrorText: tConfig("loadFail"),
    fallbackSaveErrorText: tConfig("saveFail"),
    saveOkText: tConfig("saveOk"),
  });
  const savedRulesFingerprint = useMemo(
    () => createJsonFingerprint(lastSavedContent),
    [lastSavedContent],
  );
  const previewRulesFingerprint = useMemo(
    () => createJsonFingerprint(previewJson),
    [previewJson],
  );
  const jsonDraftFingerprint = useMemo(
    () => createJsonFingerprint(jsonDraft),
    [jsonDraft],
  );
  const savedSettingsFingerprint = useMemo(
    () => createJsonFingerprint(dataConfigFile.lastSavedContent),
    [dataConfigFile.lastSavedContent],
  );
  const settingsDraftFingerprint = useMemo(
    () => createJsonFingerprint(configDraft),
    [configDraft],
  );
  const isRulesDirty = savedRulesFingerprint !== null
    && (editorMode === "json" ? jsonDraftFingerprint : previewRulesFingerprint)
      !== savedRulesFingerprint;
  const hasUnappliedJsonDraft = editorMode === "json"
    && jsonDraftFingerprint !== previewRulesFingerprint;
  const isSettingsDirty = isConfigLoaded
    && savedSettingsFingerprint !== null
    && settingsDraftFingerprint !== savedSettingsFingerprint;

  useEffect(() => {
    if (isReadOnly || (!isRulesDirty && !isSettingsDirty)) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isReadOnly, isRulesDirty, isSettingsDirty]);

  const enterRulesMode = useCallback(() => {
    replaceBrowserView(null);
    setEditorMode("rules");
    setJsonError(null);
  }, []);

  const enterJsonMode = useCallback(() => {
    setEditorMode("json");
    setJsonDraft(previewJson);
    setJsonError(null);
  }, [previewJson]);

  const parseConfigContent = useCallback((content: string): DataConfig => {
    const parsed = JSON.parse(content) as unknown;
    const validation = validateInstanceDataConfig(parsed);
    if (validation.status === "invalid") {
      const details = validation.issues
        .slice(0, 5)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ");
      throw new Error(tConfig("validationFail", { details }));
    }
    return validation.config;
  }, [tConfig]);

  const enterSettingsMode = useCallback(() => {
    replaceBrowserView("settings");
    setEditorMode("settings");
    setSidebarLayer("primary");
    setJsonError(null);
    if (isConfigLoaded || isConfigLoading) {
      return;
    }

    setIsConfigLoading(true);
    setConfigError(null);
    void dataConfigFile.load()
      .then((content) => {
        setConfigDraft(content);
        setIsConfigLoaded(true);
        setConfigValue(parseConfigContent(content));
      })
      .catch((error: unknown) => {
        setConfigValue(null);
        setConfigError(error instanceof Error ? error.message : tConfig("loadFail"));
      })
      .finally(() => {
        setIsConfigLoading(false);
      });
  }, [
    dataConfigFile,
    isConfigLoaded,
    isConfigLoading,
    parseConfigContent,
    tConfig,
  ]);

  useEffect(() => {
    if (initialView !== "settings" || hasHandledInitialSettings.current) {
      return;
    }
    hasHandledInitialSettings.current = true;
    enterSettingsMode();
  }, [enterSettingsMode, initialView]);

  const handleSave = useCallback(async () => {
    if (isReadOnly) {
      return false;
    }

    setSaveAttempt((value) => value + 1);
    setLastSaveTarget(editorMode === "settings" ? "settings" : "rules");
    setLocalSaveError(null);

    if (editorMode === "settings") {
      try {
        const nextConfig = configValue ?? parseConfigContent(configDraft);
        const normalized = JSON.stringify(nextConfig, null, 2);
        setConfigDraft(normalized);
        setConfigValue(nextConfig);
        setConfigError(null);
        return await dataConfigFile.save(normalized);
      } catch (error) {
        const message = error instanceof Error ? error.message : tEditor("jsonParseFail");
        setConfigError(message);
        setLocalSaveError(message);
        return false;
      }
    }

    if (editorMode === "json") {
      try {
        const normalized = JSON.stringify(JSON.parse(jsonDraft), null, 2);
        setJsonError(null);
        const hydrated = await applyJson(normalized);
        setJsonDraft(hydrated);
        return await save(hydrated);
      } catch (error) {
        const message = error instanceof Error ? error.message : tEditor("jsonParseFail");
        setJsonError(message);
        setLocalSaveError(message);
        return false;
      }
    }

    return await save();
  }, [
    applyJson,
    configDraft,
    configValue,
    dataConfigFile,
    editorMode,
    isReadOnly,
    jsonDraft,
    parseConfigContent,
    save,
    tEditor,
  ]);

  const runRulesAction = useCallback(
    (action: () => void) => {
      const dirtyKind = editorMode === "settings" && isSettingsDirty
        ? "settings"
        : hasUnappliedJsonDraft
          ? "rules"
          : null;
      if (dirtyKind) {
        setPendingLeave({ kind: dirtyKind, proceed: action });
        return;
      }
      action();
    },
    [editorMode, hasUnappliedJsonDraft, isSettingsDirty],
  );

  const runRuleMutation = useCallback(
    async (
      mutation: () => Promise<RedirectsMutationResult>,
    ): Promise<RedirectsMutationResult> => {
      if (!usesManualSave) {
        setSaveAttempt((value) => value + 1);
        setLastSaveTarget("rules");
        setLocalSaveError(null);
      }
      const result = await mutation();
      if (!result.isSuccess && result.errorMessage) {
        setLocalSaveError(result.errorMessage);
      }
      return result;
    },
    [usesManualSave],
  );

  const handleEnterRulesMode = useCallback(() => {
    runRulesAction(enterRulesMode);
  }, [enterRulesMode, runRulesAction]);

  const handleEnterSettingsMode = useCallback(() => {
    if (editorMode === "settings") {
      return;
    }
    if (isRulesDirty) {
      setPendingLeave({
        kind: "rules",
        proceed: enterSettingsMode,
      });
      return;
    }
    enterSettingsMode();
  }, [editorMode, enterSettingsMode, isRulesDirty]);

  const handleSettingsCategoryChange = useCallback(
    (category: SettingsCategory) => {
      if (category === settingsCategory) {
        return;
      }
      if (shouldConfirmSettingsCategoryChange(category, isSettingsDirty)) {
        setPendingLeave({
          kind: "settings",
          proceed: () => setSettingsCategory(category),
        });
        return;
      }
      setSettingsCategory(category);
    },
    [isSettingsDirty, settingsCategory],
  );

  const handleOpenRulesSection = useCallback(() => {
    runRulesAction(() => {
      enterRulesMode();
      setSidebarLayer("section");
    });
  }, [enterRulesMode, runRulesAction]);

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      runRulesAction(() => {
        enterRulesMode();
        selectGroup(groupId);
      });
    },
    [enterRulesMode, runRulesAction, selectGroup],
  );

  const handleAddGroup = useCallback(
    (parentId: string) => {
      runRulesAction(() => {
        enterRulesMode();
        void runRuleMutation(() => addGroup(parentId));
      });
    },
    [addGroup, enterRulesMode, runRuleMutation, runRulesAction],
  );

  const handleCommitRename = useCallback(
    (groupId: string) => {
      void runRuleMutation(() => commitRename(groupId));
    },
    [commitRename, runRuleMutation],
  );

  const handleAddEntry = useCallback(
    (groupId: string) => {
      runRulesAction(() => {
        enterRulesMode();
        setNewEntryGroupId(groupId);
      });
    },
    [enterRulesMode, runRulesAction],
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      runRulesAction(() => {
        enterRulesMode();
        setDeleteGroupError(null);
        setPendingDeleteGroupId(groupId);
      });
    },
    [enterRulesMode, runRulesAction],
  );

  const handleConfirmRemoveGroup = useCallback(async () => {
    if (!pendingDeleteGroupId) {
      return;
    }
    setDeleteGroupError(null);
    try {
      const result = await runRuleMutation(() =>
        removeGroup(pendingDeleteGroupId)
      );
      if (result.isSuccess) {
        setPendingDeleteGroupId(null);
        return;
      }
      setDeleteGroupError(result.errorMessage ?? tGroups("saveFail"));
    } catch (error) {
      setDeleteGroupError(
        error instanceof Error ? error.message : tGroups("saveFail"),
      );
    }
  }, [pendingDeleteGroupId, removeGroup, runRuleMutation, tGroups]);

  const handleCreateEntry = useCallback(
    async (draft: RedirectEntryDraft): Promise<RedirectsMutationResult> => {
      if (!newEntryGroupId) {
        return {
          errorMessage: tGroups("saveFail"),
          isSuccess: false,
        };
      }
      return await runRuleMutation(() => addEntry(newEntryGroupId, draft));
    },
    [addEntry, newEntryGroupId, runRuleMutation, tGroups],
  );

  const handleRemoveEntry = useCallback(
    (groupId: string, entryId: string) => {
      return runRuleMutation(() => removeEntry(groupId, entryId));
    },
    [removeEntry, runRuleMutation],
  );

  const handleUpdateEntry = useCallback(
    (
      groupId: string,
      entryId: string,
      draft: RedirectEntryDraft,
    ) => {
      return runRuleMutation(() => updateEntry(groupId, entryId, draft));
    },
    [runRuleMutation, updateEntry],
  );

  const handleLocateEntry = useCallback(
    (entryId: string) => {
      runRulesAction(() => {
        enterRulesMode();
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const target = document.getElementById(`entry-${entryId}`);
            target?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        });
      });
    },
    [enterRulesMode, runRulesAction],
  );

  const handleSectionNavigate = useCallback(
    (href: string): boolean => {
      const dirtyKind = editorMode === "settings" && isSettingsDirty
        ? "settings"
        : isRulesDirty
          ? "rules"
          : null;
      if (!dirtyKind) {
        return true;
      }
      setPendingLeave({
        kind: dirtyKind,
        proceed: () => router.push(href),
      });
      return false;
    },
    [editorMode, isRulesDirty, isSettingsDirty, router],
  );

  const handleHeaderNavigate = useCallback(
    (proceed: () => void) => {
      const dirtyKind = editorMode === "settings" && isSettingsDirty
        ? "settings"
        : isRulesDirty
          ? "rules"
          : null;
      if (!dirtyKind) {
        proceed();
        return;
      }
      setPendingLeave({
        kind: dirtyKind,
        proceed,
      });
    },
    [editorMode, isRulesDirty, isSettingsDirty],
  );

  const handlePendingSave = useCallback(async () => {
    if (!pendingLeave || isResolvingLeave) {
      return;
    }
    setIsResolvingLeave(true);
    const didSave = await handleSave();
    if (didSave) {
      const proceed = pendingLeave.proceed;
      setPendingLeave(null);
      proceed();
    }
    setIsResolvingLeave(false);
  }, [handleSave, isResolvingLeave, pendingLeave]);

  const handlePendingDiscard = useCallback(async () => {
    if (!pendingLeave || isResolvingLeave) {
      return;
    }
    setIsResolvingLeave(true);

    let didDiscard = false;
    if (pendingLeave.kind === "settings") {
      const savedContent = dataConfigFile.lastSavedContent;
      if (savedContent) {
        try {
          const savedConfig = parseConfigContent(savedContent);
          setConfigDraft(savedContent);
          setConfigValue(savedConfig);
          setConfigError(null);
          didDiscard = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : tConfig("loadFail");
          setConfigError(message);
          setLocalSaveError(message);
        }
      }
    } else {
      didDiscard = await discardChanges();
      if (didDiscard) {
        setJsonDraft(lastSavedContent ?? "");
        setJsonError(null);
      }
    }

    if (didDiscard) {
      const proceed = pendingLeave.proceed;
      setPendingLeave(null);
      proceed();
    }
    setIsResolvingLeave(false);
  }, [
    dataConfigFile.lastSavedContent,
    discardChanges,
    isResolvingLeave,
    lastSavedContent,
    parseConfigContent,
    pendingLeave,
    tConfig,
  ]);

  const handlePendingCancel = useCallback(() => {
    if (!isResolvingLeave) {
      setPendingLeave(null);
    }
  }, [isResolvingLeave]);

  if (isLoading) {
    return (
      <AppShell
        navigation={
          <div className="flex h-full min-h-0 flex-col">
            <AppSidebarSectionHeader
              title={tHeader("rules")}
              onBack={() => setSidebarLayer("primary")}
            />
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="border-b border-line pb-5">
                <SidebarSkeletonBody />
              </div>
              <div className="border-b border-line pb-5">
                <SidebarSkeletonCatalog />
              </div>
            </div>
            <SidebarSettingsSkeleton />
          </div>
        }
      >
        <main data-layout-region="content" className="mx-auto w-full max-w-[var(--app-content-max-width)] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:pb-10 lg:pt-4">
          <ContentSkeleton />
        </main>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell
        navigation={
          <div>
            <AppSidebarSectionHeader
              title={tHeader("rules")}
              onBack={() => setSidebarLayer("primary")}
            />
            <div className="space-y-5 p-5 sm:p-6">
              <div className="border-b border-line pb-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {tGroups("group")}
                </h2>
                <div className="mt-3 text-sm text-muted">{tGroups("cannotLoad")}</div>
              </div>
            </div>
          </div>
        }
      >
        <main data-layout-region="content" className="mx-auto w-full max-w-[var(--app-content-max-width)] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:pb-10 lg:pt-4">
          <div className="border-l-2 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        </main>
      </AppShell>
    );
  }

  const readOnlyNoticeNode = isReadOnly ? (
    <div className="border-l-2 border-line-strong px-3 py-1">
      <p className="text-sm font-semibold text-ink">{tGroups("readOnlyTitle")}</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        {tGroups("readOnlyDescription")}
      </p>
    </div>
  ) : null;

  const sidebarBodyNode = (
    <ManagerSidebarBody
      rootGroup={rootGroup}
      slotsKey={slotsKey}
      selectedGroupId={selectedGroupId}
      editingGroupId={editingGroupId}
      editingName={editingName}
      isReadOnly={isReadOnly}
      onAddGroup={handleAddGroup}
      onSelectGroup={handleSelectGroup}
      onBeginRename={beginRename}
      onEditingNameChange={setEditingName}
      onCommitRename={handleCommitRename}
      onCancelRename={cancelRename}
      onRemoveGroup={handleRemoveGroup}
    />
  );

  const catalogNode = selectedGroup && selectedGroup.entries.length > 0 ? (
    <RouteEntriesCatalog
      entries={selectedGroup.entries}
      title={tEditor("entries") ?? "Entries"}
      className="max-h-[38vh] border-b border-line pb-5"
      onAddRule={isReadOnly ? undefined : () => handleAddEntry(selectedGroup.id)}
      addRuleLabel={tEntries("addRule")}
      onLocateEntry={handleLocateEntry}
      onRemoveEntry={
        isReadOnly
          ? undefined
          : (entryId) => handleRemoveEntry(selectedGroup.id, entryId)
      }
      showLocateButton
    />
  ) : null;

  const navigationNode = (
    <div className="flex h-full min-h-0 flex-col">
      {sidebarLayer === "primary" || editorMode === "settings" ? (
        <AppSidebarPrimaryNavigation
          activeSection={editorMode === "settings" ? "settings" : "rules"}
          onBeforeNavigate={handleSectionNavigate}
          onSelectRules={handleOpenRulesSection}
          onSelectSettings={handleEnterSettingsMode}
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col animate-[fade-left_180ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
          <AppSidebarSectionHeader
            title={tHeader("rules")}
            onBack={() => setSidebarLayer("primary")}
          />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            <div className="border-b border-line pb-5">
              {sidebarBodyNode}
            </div>
            {catalogNode}
            {readOnlyNoticeNode}
          </div>
          <AppSidebarSettingsNavigation
            onBeforeNavigate={handleSectionNavigate}
            onSelect={handleEnterSettingsMode}
          />
        </div>
      )}
    </div>
  );
  const notificationMessage = localSaveError
    ?? (lastSaveTarget === "settings"
      ? dataConfigFile.resultMessage
      : resultMessage);
  const notificationCommitUrl = localSaveError
    ? null
    : lastSaveTarget === "settings"
      ? dataConfigFile.lastCommitUrl
      : lastCommitUrl;
  const notificationStatus = localSaveError
    ? "error"
    : lastSaveTarget === "settings"
      ? dataConfigFile.resultStatus ?? "error"
      : resultStatus ?? "error";
  const newEntryGroup = newEntryGroupId
    ? findGroupById(rootGroup, newEntryGroupId)
    : null;
  const pendingDeleteGroup = pendingDeleteGroupId
    ? findGroupById(rootGroup, pendingDeleteGroupId)
    : null;

  return (
    <RuntimeSettingsProvider canonicalOrigin={canonicalOrigin}>
      <>
        <AppShell
          navigation={navigationNode}
          onBeforeNavigate={handleHeaderNavigate}
        >
          <main data-layout-region="content" className="mx-auto w-full max-w-[var(--app-content-max-width)] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:pb-10 lg:pt-4">
            <section className="min-w-0">
              <RightPanel
                editorMode={editorMode}
                canUndo={canUndo}
                canRedo={canRedo}
                isPending={editorMode === "settings" ? dataConfigFile.isPending : isPending}
                onUndo={undo}
                onRedo={redo}
                onSave={handleSave}
                onEnterRulesMode={handleEnterRulesMode}
                onEnterJsonMode={enterJsonMode}
                jsonDraft={jsonDraft}
                onJsonDraftChange={setJsonDraft}
                jsonError={jsonError}
                isReadOnly={isReadOnly}
                showSaveAction={
                  editorMode === "settings"
                    ? shouldShowSettingsSaveAction(settingsCategory)
                    : usesManualSave
                }
                showRuleHistoryActions={usesManualSave}
                supportsJsonEditor={supportsJsonEditor}
                supportsSourceOverride={supportsSourceOverride}
                sourceUrl={configSourceUrl}
                onLoadSourceUrl={loadFromUrl}
                settingsContent={
                  isConfigLoading ? (
                    <SettingsSkeleton />
                  ) : configValue ? (
                    <>
                      <InstanceSettingsEditor
                        hasUnsavedChanges={isRulesDirty || isSettingsDirty}
                        value={configValue}
                        isReadOnly={isReadOnly}
                        onCategoryChange={handleSettingsCategoryChange}
                        onChange={(nextConfig) => {
                          setConfigValue(nextConfig);
                          setConfigDraft(JSON.stringify(nextConfig, null, 2));
                          setConfigError(null);
                        }}
                        selectedCategory={settingsCategory}
                      />
                    </>
                  ) : (
                    <>
                      <div className="mb-5 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {tConfig("visualUnavailable")}
                      </div>
                      <JsonEditor
                        jsonDraft={configDraft}
                        onJsonDraftChange={setConfigDraft}
                        jsonError={configError}
                        isReadOnly={isReadOnly}
                        tipText={tConfig("recoveryTip")}
                        validateJson={validateInstanceDataConfig}
                      />
                    </>
                  )
                }
                rulesContent={
                  selectedGroup ? (
                    <GroupEntriesEditor
                      group={selectedGroup}
                      onAddEntry={handleAddEntry}
                      onRemoveEntry={handleRemoveEntry}
                      onUpdateEntry={handleUpdateEntry}
                      savesImmediately={!usesManualSave}
                      isReadOnly={isReadOnly}
                    />
                  ) : (
                    <div>
                      <h1 className="text-lg font-semibold text-ink">{tGroups("group")}</h1>
                      <p className="mt-1 text-sm text-muted">{tGroups("selectHint")}</p>
                    </div>
                  )
                }
              />
            </section>
          </main>
        </AppShell>
        <SaveNotification
          key={saveAttempt}
          message={notificationMessage}
          commitUrl={notificationCommitUrl}
          status={notificationStatus}
        />
        {newEntryGroup ? (
          <NewRouteEntryDialog
            groupName={newEntryGroup.name}
            isOpen
            savesImmediately={!usesManualSave}
            onClose={() => setNewEntryGroupId(null)}
            onCreate={handleCreateEntry}
          />
        ) : null}
        <UnsavedChangesDialog
          isOpen={pendingLeave !== null}
          isSaving={isResolvingLeave}
          kind={pendingLeave?.kind ?? "rules"}
          onCancel={handlePendingCancel}
          onDiscard={() => void handlePendingDiscard()}
          onSave={() => void handlePendingSave()}
        />
        <ConfirmationDialog
          isOpen={pendingDeleteGroup !== null}
          title={tGroups("deleteGroupTitle")}
          description={tGroups("confirmDelete", {
            label: pendingDeleteGroup?.name?.trim() || tGroups("unnamed"),
          })}
          cancelLabel={tGroups("cancelDelete")}
          confirmLabel={tGroups("delete")}
          errorMessage={deleteGroupError}
          isPending={isPending}
          pendingLabel={tGroups("saving")}
          tone="danger"
          onCancel={() => {
            setDeleteGroupError(null);
            setPendingDeleteGroupId(null);
          }}
          onConfirm={() => void handleConfirmRemoveGroup()}
        />
      </>
    </RuntimeSettingsProvider>
  );
}

function createJsonFingerprint(content: string | null): string | null {
  if (content === null) {
    return null;
  }
  try {
    return JSON.stringify(JSON.parse(content) as unknown);
  } catch {
    return content.trim();
  }
}

function findGroupById(group: RedirectGroup, groupId: string): RedirectGroup | null {
  if (group.id === groupId) {
    return group;
  }
  for (const child of group.children) {
    const match = findGroupById(child, groupId);
    if (match) {
      return match;
    }
  }
  return null;
}

function replaceBrowserView(view: "settings" | null) {
  const url = new URL(window.location.href);
  if (view) {
    url.searchParams.set("view", view);
  } else {
    url.searchParams.delete("view");
  }
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
