import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStudyTypeDisplay,
  STUDY_TYPE_LABELS,
} from "../../../../frontend/src/lib/study-types.ts";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const SUMMARY_PATH = "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx";
const UPLOAD_MODAL_PATH = "frontend/src/components/dashboard/UploadReportModal.tsx";

test("clinic reports ESTUDIO column shows accented uppercase catalog labels", () => {
  assert.equal(formatStudyTypeDisplay("histopatologia"), "HISTOPATOLOGÍA");
  assert.equal(formatStudyTypeDisplay("hemoparasitos"), "HEMOPARÁSITOS");
  assert.equal(formatStudyTypeDisplay("citologia"), "CITOLOGÍA");
  assert.equal(formatStudyTypeDisplay("necropsia"), "NECROPSIA");
});

test("study type identifiers stay intact and match the upload catalog", () => {
  assert.deepEqual([...STUDY_TYPE_LABELS.keys()], ["histopatologia", "citologia", "hemoparasitos"]);

  const uploadSource = read(UPLOAD_MODAL_PATH);
  for (const [value, label] of STUDY_TYPE_LABELS) {
    assert.ok(uploadSource.includes(`{ value: "${value}", label: "${label}" }`), value);
  }
});

test("clinic reports table formats only the visible cell, filters keep the raw value", () => {
  const source = read(SUMMARY_PATH);
  const display =
    '{report.studyType == null ? "Tipo sin registrar" : formatStudyTypeDisplay(report.studyType)}';
  const desktopStart = source.indexOf('data-clinic-reports-table-row="true"');
  const mobileStart = source.indexOf('data-clinic-reports-mobile-row="true"');

  assert.notEqual(desktopStart, -1);
  assert.notEqual(mobileStart, -1);
  assert.ok(source.indexOf(display, desktopStart) > desktopStart);
  assert.ok(source.indexOf(display, mobileStart) > mobileStart);
  assert.ok(source.includes('const studyDisplay = report.studyType ?? "Tipo sin registrar";'));
  assert.ok(source.includes("matchesFilterText(studyDisplay, filters.study)"));
});
