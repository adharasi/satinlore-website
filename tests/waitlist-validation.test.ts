import assert from "node:assert/strict";
import test from "node:test";

const { validEmail, validToken, sourceName, csvCell } = await import(
  new URL("../lib/waitlist-validation.ts", import.meta.url).href
);

test("email addresses are normalised and header/markup injection is rejected", () => {
  assert.equal(validEmail("  Reader@Example.COM  "), "reader@example.com");
  for (const value of [null, {}, 123, "", "reader", "reader@local", "a@b.com\r\nBcc:x@y.com", "<reader@example.com>", "a".repeat(255) + "@example.com"]) {
    assert.equal(validEmail(value), null, `Rejected ${JSON.stringify(value)}`);
  }
});

test("management credentials accept only full-length hexadecimal tokens", () => {
  assert.equal(validToken("a0".repeat(32)), true);
  for (const value of [null, {}, "a".repeat(63), "a".repeat(65), "g".repeat(64), "A".repeat(64), "a0".repeat(32) + "\n"]) {
    assert.equal(validToken(value), false);
  }
});

test("acquisition source cannot contain URLs or arbitrary text", () => {
  assert.equal(sourceName("reddit_beta-1"), "reddit_beta-1");
  for (const value of ["https://example.com/private?story=sample", "email@example.com", "a b", "a".repeat(65), "<script>", null]) {
    assert.equal(sourceName(value), "direct");
  }
});

test("CSV export quotes delimiters and line breaks without extra cells", () => {
  assert.equal(csvCell('text,"quoted"\nnext'), '"text,""quoted""\nnext"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(123), '"123"');
});

test("CSV export neutralises spreadsheet formula prefixes", () => {
  for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
    assert.equal(csvCell(prefix + "untrusted"), '"\'' + prefix + 'untrusted"');
  }
});

test('first names allow real name forms but reject markup and controls', async () => {
  const { validFirstName } = await import(new URL('../lib/waitlist-validation.ts', import.meta.url).href);
  assert.equal(validFirstName('  Zoë  '), 'Zoë');
  assert.equal(validFirstName('Mary-Jane'), 'Mary-Jane');
  assert.equal(validFirstName('O’Neil'), 'O’Neil');
  assert.equal(validFirstName('李'), '李');
  assert.equal(validFirstName('<script>'), null);
  assert.equal(validFirstName('a'.repeat(61)), null);
  assert.equal(validFirstName(''), null);
});

test('toy answers accept any brand or no toy while bounding untrusted text', async () => {
  const { validToyModel } = await import(new URL('../lib/waitlist-validation.ts', import.meta.url).href);
  for (const name of ['We-Vibe Moxie+', 'Satisfyer', 'LELO', 'Lovense Lush 3', 'none yet', '新しいブランド']) {
    assert.equal(validToyModel(name), name);
  }
  assert.equal(validToyModel('  A  new brand  '), 'A new brand');
  assert.equal(validToyModel(''), '');
  assert.equal(validToyModel('   '), '');
  for (const name of [null, {}, 123, 'a'.repeat(121), '<script>', 'Toy\r\nOther', 'Toy\u0000']) {
    assert.equal(validToyModel(name), null);
  }
});
