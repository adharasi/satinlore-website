import assert from "node:assert/strict";
import { test } from "node:test";

const { default: sitemap } = await import(new URL("../app/sitemap.ts", import.meta.url).href) as typeof import("../app/sitemap");

test("search engines can discover the guides and only public canonical routes", () => {
  assert.deepEqual(sitemap().map(entry => entry.url), [
    "https://satinlore.com/",
    "https://satinlore.com/docs",
    "https://satinlore.com/contact",
    "https://satinlore.com/privacy",
    "https://satinlore.com/research-privacy",
  ]);
});
