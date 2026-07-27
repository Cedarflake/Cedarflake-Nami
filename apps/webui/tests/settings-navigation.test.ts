import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldConfirmSettingsCategoryChange,
  shouldShowSettingsSaveAction,
} from "../src/components/settings/settings-navigation";

test("guards unsaved settings before opening data management", () => {
  assert.equal(shouldConfirmSettingsCategoryChange("data", true), true);
  assert.equal(shouldConfirmSettingsCategoryChange("data", false), false);
  assert.equal(shouldConfirmSettingsCategoryChange("analytics", true), false);
});

test("hides the settings save action only for data management", () => {
  assert.equal(shouldShowSettingsSaveAction("data"), false);
  assert.equal(shouldShowSettingsSaveAction("runtime"), true);
  assert.equal(shouldShowSettingsSaveAction("installed-plugins"), true);
});
