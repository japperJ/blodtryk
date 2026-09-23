import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/bpClassification.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const classifier = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { BP_CLASSIFICATION_METADATA: metadata, getBPStatus } = classifier;

const severity = (systolic, diastolic) => getBPStatus(systolic, diastolic).severity;

test("classification metadata identifies the reviewed source and version", () => {
  assert.equal(metadata.ruleVersion, "dcs-nbv-2026-4-table-27-1-v1");
  assert.equal(metadata.verifiedOn, "2026-09-23");
  assert.equal(metadata.source.organization, "Dansk Cardiologisk Selskab (DCS)");
  assert.equal(metadata.source.revision, "2026/4");
  assert.equal(metadata.source.table, "27.1");
  assert.equal(metadata.source.url, "https://nbv.cardio.dk/kapitel/hypertension/");
  assert.deepEqual(metadata.thresholds.normal, {
    systolicMin: 100,
    systolicMax: 129,
    diastolicMin: 60,
    diastolicMax: 79,
    join: "and",
  });
});

test("normal requires both components to be in the normal interval", () => {
  assert.equal(severity(100, 60), "normal");
  assert.equal(severity(129, 79), "normal");
  assert.equal(severity(129, 80), "elevated");
  assert.equal(severity(130, 79), "elevated");
  assert.equal(severity(99, 60), "unclassified");
  assert.equal(severity(100, 59), "unclassified");
});

test("systolic boundary values map to the DCS table categories", () => {
  const cases = [
    [129, "normal"],
    [130, "elevated"],
    [134, "elevated"],
    [135, "grade1"],
    [154, "grade1"],
    [155, "grade2"],
    [174, "grade2"],
    [175, "grade3"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(severity(value, 70), expected, `systolic ${value}`);
  }
});

test("diastolic boundary values map to the DCS table categories", () => {
  const cases = [
    [79, "normal"],
    [80, "elevated"],
    [84, "elevated"],
    [85, "grade1"],
    [94, "grade1"],
    [95, "grade2"],
    [104, "grade2"],
    [105, "grade3"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(severity(120, value), expected, `diastolic ${value}`);
  }
});

test("either component can indicate a category and the higher indicated category wins", () => {
  assert.equal(severity(120, 85), "grade1");
  assert.equal(severity(135, 70), "grade1");
  assert.equal(severity(150, 95), "grade2");
  assert.equal(severity(155, 85), "grade2");
  assert.equal(severity(175, 60), "grade3");
  assert.equal(severity(120, 105), "grade3");
});

test("raw decimal values are compared without rounding", () => {
  assert.equal(severity(129.99, 70), "normal");
  assert.equal(severity(130, 70), "elevated");
  assert.equal(severity(129, 79.99), "normal");
  assert.equal(severity(129, 80), "elevated");
});

test("values below the table and non-finite values stay unclassified", () => {
  assert.equal(severity(99, 59), "unclassified");
  assert.equal(severity(Number.NaN, 80), "unclassified");
  assert.equal(severity(120, Number.POSITIVE_INFINITY), "unclassified");
  assert.equal(severity(Number.NEGATIVE_INFINITY, 70), "unclassified");
});
