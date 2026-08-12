import PDFDocument from "pdfkit";

type PackingListTrip = {
  trip_name: string | null;
  destinations: string | null;
  departure_date: string | null;
  return_date: string | null;
};

type PackingListNote = {
  title: string | null;
  content: string | null;
  updated_at?: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "TBD";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u2022/g, "-");
}

function addFooter(doc: PDFKit.PDFDocument, pageNumber: number) {
  const bottom = doc.page.height - 42;

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#8a9aa3")
    .text(`Cozy Adventure Vacations | Page ${pageNumber}`, 54, bottom, {
      align: "center",
      width: doc.page.width - 108,
    });
}

export function buildPackingListFileName(tripName: string | null | undefined) {
  const base =
    String(tripName ?? "trip")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trip";

  return `${base}-packing-list.pdf`;
}

export async function renderPackingListPdf({
  trip,
  note,
}: {
  trip: PackingListTrip;
  note: PackingListNote;
}) {
  const title = cleanText(note.title) || "Packing List";
  const content = sanitizePdfText(cleanText(note.content));
  const tripName = cleanText(trip.trip_name) || "Trip";
  const destinations = cleanText(trip.destinations) || "Destination TBD";

  if (!content) {
    throw new Error("This trip does not have a packing list to download.");
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: 54,
        right: 54,
        bottom: 70,
        left: 54,
      },
      info: {
        Title: title,
        Author: "Cozy Adventure Vacations",
        Subject: `${tripName} packing list`,
      },
    });

    const chunks: Buffer[] = [];
    let pageNumber = 1;

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("pageAdded", () => {
      pageNumber += 1;
      addFooter(doc, pageNumber);
      doc.moveDown(1.5);
    });

    addFooter(doc, pageNumber);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#1f4f59")
      .text("COZY ADVENTURE VACATIONS");

    doc.moveDown(0.6);

    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#172a31")
      .text(title, { lineGap: 2 });

    doc.moveDown(0.5);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#44545c")
      .text(tripName)
      .text(destinations)
      .text(`${formatDate(trip.departure_date)} to ${formatDate(trip.return_date)}`);

    doc.moveDown(1);
    doc
      .strokeColor("#d9ecf2")
      .lineWidth(1)
      .moveTo(54, doc.y)
      .lineTo(doc.page.width - 54, doc.y)
      .stroke();
    doc.moveDown(1);

    const blocks = content.split(/\n{2,}/).filter(Boolean);

    blocks.forEach((block, index) => {
      const lines = block.split("\n").filter(Boolean);
      const firstLine = lines[0]?.trim() ?? "";
      const rest = lines.slice(1).join("\n").trim();
      const isHeading =
        lines.length > 1 &&
        firstLine.length <= 70 &&
        !/^[-*]\s+/.test(firstLine) &&
        !/[.!?]$/.test(firstLine);

      if (index > 0) doc.moveDown(0.7);

      if (isHeading) {
        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#1f4f59")
          .text(firstLine.replace(/:$/, ""));
        doc.moveDown(0.25);
        doc
          .font("Helvetica")
          .fontSize(10.5)
          .fillColor("#243840")
          .text(rest, { lineGap: 4 });
      } else {
        doc
          .font("Helvetica")
          .fontSize(10.5)
          .fillColor("#243840")
          .text(block, { lineGap: 4 });
      }
    });

    doc.moveDown(1.2);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#667085")
      .text(
        "Please review official supplier confirmations, airline baggage rules, TSA/security rules, and destination entry requirements before departure.",
        { lineGap: 3 },
      );

    doc.end();
  });
}
