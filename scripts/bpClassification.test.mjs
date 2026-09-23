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
const { BP_CLASSIFICATION_METADATA: metadata, getBPStatus, getBPStatusForPeriodMean } = classifier;

const severity = (systolic, diastolic, age = 19) => getBPStatus(systolic, diastolic, age).severity;

test("classification metadata identifies the reviewed source and version", () => {
  assert.equal(metadata.ruleVersion, "dcs-nbv-2026-4-table-27-1-v1");
  assert.equal(metadata.ageEligibility.minimumRecordedAge, 19);
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

test("classification requires a recorded age of at least 19", () => {
  for (const age of [null, 1, 17, 18]) {
    const status = getBPStatus(135, 85, age);
    assert.equal(status.severity, "unclassified");
    assert.equal(status.descriptionKey, "bp.unclassified.ageDesc");
  }

  assert.equal(getBPStatus(135, 85, 19).severity, "grade1");
});

test("period means require every recorded age to be at least 19", () => {
  assert.equal(getBPStatusForPeriodMean(135, 85, [19, 64]).severity, "grade1");

  for (const ages of [[], [null], [18], [19, null], [18, 19]]) {
    const status = getBPStatusForPeriodMean(135, 85, ages);
    assert.equal(status.severity, "unclassified", `ages ${JSON.stringify(ages)}`);
    assert.equal(status.descriptionKey, "bp.unclassified.ageDesc", `ages ${JSON.stringify(ages)}`);
  }
});

test("values below the table and non-finite values stay unclassified", () => {
  const readings = [
    [99, 59],
    [Number.NaN, 80],
    [120, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 70],
  ];

  for (const [systolic, diastolic] of readings) {
    assert.equal(severity(systolic, diastolic), "unclassified");
    assert.equal(getBPStatus(systolic, diastolic, 19).descriptionKey, "bp.unclassified.desc");
    assert.equal(getBPStatus(systolic, diastolic, null).descriptionKey, "bp.unclassified.desc");
  }
});
