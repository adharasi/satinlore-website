import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("experience dashboard and its masked preview deny unauthenticated rendering", async () => {
  for (const path of ["experience/page.tsx", "experience/preview/page.tsx"]) {
    const source = ts.transpileModule(readFileSync(new URL(`../app/admin/${path}`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    let checked = 0;
    const exports: { default?: () => Promise<{ props: { title: string } }> } = {};
    new Function("require", "exports", source)((name: string) => {
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      if (name === "@/lib/waitlist-server") return { isOwner: async () => { checked++; return false; } };
      if (["@/lib/PageFrame", "@/lib/AdminShell", "@/lib/AdminExperiencePanel", "@/lib/MarketingHome"].includes(name)) return { default: () => { throw new Error("Protected content must not render before authentication"); } };
      throw new Error(`Unexpected dependency: ${name}`);
    }, exports);
    const result = await exports.default!();
    assert.equal(checked, 1, path);
    assert.equal(result.props.title, "Founder access only.", path);
  }
});
