"use client";
import jsPDF from "jspdf";
import type { Reading } from "@/types";
import { getBPStatus, getAgeGroupLabel, type Severity } from "@/lib/bpClassification";

interface Props {
  readings: Reading[];
  personName?: string;
}

export default function PdfExport({ readings, personName }: Props) {
  const exportPdf = () => {
    const doc = new jsPDF();
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    let y = margin;

    const addPageHeader = () => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Blodtryksrapport", margin, 8);
      doc.text(
        `Genereret: ${new Date().toLocaleString("da-DK")}`,
        pageWidth - margin,
        8,
        { align: "right" }
      );
      doc.setDrawColor(200);
      doc.line(margin, 10, pageWidth - margin, 10);
    };

    const checkPage = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        addPageHeader();
        y = margin + 5;
      }
    };

    // Farver styres af maskinlæsbar sværhedsgrad (ikke label-tekst),
    // så labels kan omdøbes frit uden at ødelægge PDF-farverne
    const setStatusColor = (severity: Severity) => {
      switch (severity) {
        case "crisis":
          doc.setTextColor(180, 0, 0);
          break;
        case "stage2":
          doc.setTextColor(200, 0, 0);
          break;
        case "stage1":
          doc.setTextColor(220, 100, 0);
          break;
        case "elevated":
          doc.setTextColor(200, 150, 0);
          break;
        default: // normal
          doc.setTextColor(0, 140, 0);
      }
    };

    // === Forside ===
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text("Blodtryksrapport", margin, y + 5);
    y += 15;

    doc.setFontSize(10);
    doc.setTextColor(100);

    // Persons navn
    if (personName) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(personName, margin, y);
      y += 7;

      doc.setFontSize(10);
      doc.setTextColor(100);
    }

    doc.text(`Genereret: ${new Date().toLocaleString("da-DK")}`, margin, y);
    y += 5;
    doc.text(`Antal maalinger: ${readings.length}`, margin, y);
    y += 5;

    // Alder info
    const ages = readings.map((r) => r.age).filter((a): a is number => a != null);
    if (ages.length > 0) {
      const uniqueAges = Array.from(new Set(ages));
      if (uniqueAges.length === 1) {
        doc.text(
          `Alder: ${uniqueAges[0]} aar (${getAgeGroupLabel(uniqueAges[0])})`,
          margin,
          y
        );
        y += 5;
      }
    }
    y += 5;

    // === Tabel ===
    // Note-kolonne vises kun hvis mindst én måling har en note
    const hasNotes = readings.some((r) => r.note != null && r.note.trim() !== "");

    const colDate = margin;
    const colTime = margin + 25;
    const colAge = margin + 48;
    const colSys = margin + 65;
    const colDia = margin + 85;
    const colPulse = margin + 105;
    const colStatus = margin + 125;
    const colNote = margin + 155;
    const noteWidth = pageWidth - margin - colNote;

    const drawTableHeader = () => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("Dato", colDate, y);
      doc.text("Tid", colTime, y);
      doc.text("Alder", colAge, y);
      doc.text("Sys", colSys, y);
      doc.text("Dia", colDia, y);
      doc.text("Puls", colPulse, y);
      doc.text("Vurdering", colStatus, y);
      if (hasNotes) {
        doc.text("Note", colNote, y);
      }
      y += 2;
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    };

    drawTableHeader();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    const sorted = [...readings].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const reading of sorted) {
      const date = new Date(reading.createdAt);
      const status = getBPStatus(reading.systolic, reading.diastolic, reading.age);

      // Note pakkes til kolonnebredden (maks. 2 linjer, … ved afkortning)
      let noteLines: string[] = [];
      if (hasNotes) {
        const noteText = reading.note?.trim() ?? "";
        if (noteText) {
          const wrapped = doc.splitTextToSize(noteText, noteWidth) as string[];
          if (wrapped.length > 2) {
            noteLines = [wrapped[0], `${wrapped[1].trimEnd()}…`];
          } else {
            noteLines = wrapped;
          }
        }
      }

      checkPage(10 + (noteLines.length - 1) * 4);

      const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;
      const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

      doc.setTextColor(0);
      doc.text(dateStr, colDate, y);
      doc.text(timeStr, colTime, y);

      doc.setTextColor(100);
      doc.text(reading.age != null ? `${reading.age}` : "-", colAge, y);

      doc.setTextColor(0);
      doc.text(String(reading.systolic), colSys, y);
      doc.text(String(reading.diastolic), colDia, y);
      doc.text(String(reading.pulse), colPulse, y);

      setStatusColor(status.severity);
      doc.text(status.label, colStatus, y);

      if (noteLines.length > 0) {
        doc.setTextColor(100);
        noteLines.forEach((line, i) => doc.text(line, colNote, y + i * 4));
      }

      y += 6 + (noteLines.length - 1) * 4;
      doc.setDrawColor(230);
      doc.line(margin, y - 2, pageWidth - margin, y - 2);
    }

    // === Sammenfatning ===
    if (readings.length > 1) {
      y += 5;
      checkPage(45);

      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("Sammenfatning", margin, y);
      y += 7;

      const avgSys = Math.round(readings.reduce((s, r) => s + r.systolic, 0) / readings.length);
      const avgDia = Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length);
      const avgPulse = Math.round(readings.reduce((s, r) => s + r.pulse, 0) / readings.length);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);

      doc.text(`Gennemsnitligt blodtryk: ${avgSys}/${avgDia} mmHg`, margin, y);
      y += 5;
      doc.text(`Gennemsnitlig puls: ${avgPulse} bpm`, margin, y);
      y += 5;

      const maxSys = Math.max(...readings.map((r) => r.systolic));
      const minSys = Math.min(...readings.map((r) => r.systolic));
      const maxDia = Math.max(...readings.map((r) => r.diastolic));
      const minDia = Math.min(...readings.map((r) => r.diastolic));

      doc.text(`Systolisk: ${minSys}-${maxSys} mmHg (spænd: ${maxSys - minSys})`, margin, y);
      y += 5;
      doc.text(`Diastolisk: ${minDia}-${maxDia} mmHg (spænd: ${maxDia - minDia})`, margin, y);
      y += 8;

      const avgStatus = getBPStatus(avgSys, avgDia, ages[0] || null);
      doc.setFont("helvetica", "bold");
      doc.text(`Samlet vurdering: ${avgStatus.label}`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(avgStatus.description, margin, y);
    }

    // Side-numre
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Side ${i} af ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    }

    const filename = personName
      ? `blodtryk-${personName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`
      : `blodtryk-${new Date().toISOString().split("T")[0]}.pdf`;

    doc.save(filename);
  };

  return (
    <button
      onClick={exportPdf}
      className="bg-white border text-sm px-4 py-2 rounded-lg font-medium
                 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
    >
      📄 PDF
    </button>
  );
}
