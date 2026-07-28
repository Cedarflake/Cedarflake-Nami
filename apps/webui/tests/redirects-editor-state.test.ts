import assert from "node:assert/strict";
import test from "node:test";

import {
  updateEntry,
  type GroupsEditorState,
} from "../src/composables/redirects-groups/editor-state";

test("updates an entire path entry atomically without mutating the source state", () => {
  const state: GroupsEditorState = {
    slotsKey: "slots",
    baseConfig: {},
    rootGroup: {
      id: "root",
      name: "Main",
      entries: [
        {
          id: "entry",
          key: "/old",
          value: "https://old.example.com",
        },
      ],
      children: [],
    },
    selectedGroupId: "root",
    editingGroupId: null,
    editingName: "",
  };
  const value = {
    type: "proxy",
    target: "https://new.example.com",
  };

  const next = updateEntry(state, "root", "entry", {
    key: "/new",
    value,
  });

  assert.deepEqual(next.rootGroup.entries[0], {
    id: "entry",
    key: "/new",
    value,
  });
  assert.equal(state.rootGroup.entries[0]?.key, "/old");
  assert.equal(state.rootGroup.entries[0]?.value, "https://old.example.com");
});
