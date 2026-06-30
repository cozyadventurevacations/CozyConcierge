(() => {
  const headers = [
    "Supplier Name",
    "Supplier Type",
    "Website URL",
    "Booking Portal URL",
    "Contact Name",
    "Contact Email",
    "Contact Phone",
    "Preferred Supplier",
    "BDM Phone",
    "BDM Contact",
    "BDM Notes",
    "Travel Agent Support Phone",
    "Travel Agent Support Contact",
    "Travel Agent Support Notes",
    "Groups Phone",
    "Groups Contact",
    "Groups Notes",
    "Customer Service Phone",
    "Customer Service Contact",
    "Customer Service Notes",
    "Emergency / In Travel Phone",
    "Emergency / In Travel Contact",
    "Emergency / In Travel Notes",
    "Commission Notes",
    "Internal Notes",
  ];

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function csvCell(value) {
    return `"${clean(value).replace(/"/g, '""')}"`;
  }

  function visibleText(element) {
    return clean(element?.innerText || element?.textContent || "");
  }

  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
    return "";
  }

  function guessSupplierType(text) {
    const lower = text.toLowerCase();
    if (lower.includes("cruise")) return "Cruise Line";
    if (lower.includes("hotel") || lower.includes("resort")) return "Hotel / Resort";
    if (lower.includes("tour")) return "Tour Operator";
    if (lower.includes("transfer") || lower.includes("transport")) return "Transfer Company";
    if (lower.includes("insurance")) return "Insurance";
    if (lower.includes("airline") || lower.includes("air ")) return "Airline";
    if (lower.includes("car rental") || lower.includes("rental car")) return "Rental Car";
    if (lower.includes("destination management") || lower.includes("dmc")) return "Destination Management Company";
    if (lower.includes("wholesaler")) return "Wholesaler";
    return "";
  }

  function extractEmail(text) {
    return firstMatch(text, [
      /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    ]);
  }

  function extractPhone(text) {
    return firstMatch(text, [
      /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?)/i,
      /(\+\d{1,3}[\s.-]?\d[\d\s().-]{7,})/i,
    ]);
  }

  function extractWebsite(element, text) {
    const link = Array.from(element.querySelectorAll("a[href]")).find((anchor) => {
      const href = anchor.getAttribute("href") || "";
      return /^https?:\/\//i.test(href);
    });
    if (link) return link.href;
    return firstMatch(text, [
      /(https?:\/\/[^\s]+)/i,
      /\b(www\.[^\s]+)/i,
    ]);
  }

  function extractLabeledPhone(text, labels) {
    const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const pattern = new RegExp(`(?:${escapedLabels})\\s*[:#-]?\\s*(\\+?1?[\\s.-]?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}(?:\\s*(?:x|ext\\.?)\\s*\\d+)?)`, "i");
    return firstMatch(text, [pattern]);
  }

  function bestNameFromElement(element, text) {
    const heading = element.querySelector("h1,h2,h3,h4,[class*='title' i],[class*='name' i]");
    const headingText = visibleText(heading);
    if (headingText && headingText.length <= 120) return headingText;

    const firstLine = text
      .split(/\n| {2,}/)
      .map(clean)
      .find((line) => line && line.length >= 2 && line.length <= 120);
    return firstLine || "";
  }

  function rowFromElement(element) {
    const text = visibleText(element);
    if (!text || text.length < 2) return null;

    const supplierName = bestNameFromElement(element, text);
    if (!supplierName) return null;

    const contactEmail = extractEmail(text);
    const contactPhone = extractPhone(text);
    const websiteUrl = extractWebsite(element, text);

    return {
      "Supplier Name": supplierName,
      "Supplier Type": guessSupplierType(text),
      "Website URL": websiteUrl,
      "Booking Portal URL": "",
      "Contact Name": "",
      "Contact Email": contactEmail,
      "Contact Phone": contactPhone,
      "Preferred Supplier": /preferred|preferred partner|preferred supplier/i.test(text) ? "Yes" : "",
      "BDM Phone": extractLabeledPhone(text, ["BDM", "Business Development", "Sales Manager"]),
      "BDM Contact": "",
      "BDM Notes": "",
      "Travel Agent Support Phone": extractLabeledPhone(text, ["Travel Agent Support", "Advisor Support", "Agent Support", "Reservations"]),
      "Travel Agent Support Contact": "",
      "Travel Agent Support Notes": "",
      "Groups Phone": extractLabeledPhone(text, ["Groups", "Group Sales", "Group Department"]),
      "Groups Contact": "",
      "Groups Notes": "",
      "Customer Service Phone": extractLabeledPhone(text, ["Customer Service", "Service", "Support"]),
      "Customer Service Contact": "",
      "Customer Service Notes": "",
      "Emergency / In Travel Phone": extractLabeledPhone(text, ["Emergency", "In Travel", "After Hours", "After-Hours"]),
      "Emergency / In Travel Contact": "",
      "Emergency / In Travel Notes": "",
      "Commission Notes": firstMatch(text, [
        /(commission[^.\n]*(?:\.|$))/i,
      ]),
      "Internal Notes": text.slice(0, 900),
    };
  }

  function tableRows() {
    const tables = Array.from(document.querySelectorAll("table"));
    const output = [];

    for (const table of tables) {
      const headerCells = Array.from(table.querySelectorAll("thead th")).map(visibleText);
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      if (rows.length === 0) continue;

      for (const tr of rows) {
        const cells = Array.from(tr.children).map(visibleText);
        if (cells.length === 0) continue;
        const text = cells.join(" ");
        output.push({
          "Supplier Name": cells[0] || bestNameFromElement(tr, text),
          "Supplier Type": cells.find((cell) => /cruise|hotel|resort|tour|insurance|airline|transfer/i.test(cell)) || guessSupplierType(text),
          "Website URL": extractWebsite(tr, text),
          "Booking Portal URL": "",
          "Contact Name": "",
          "Contact Email": extractEmail(text),
          "Contact Phone": extractPhone(text),
          "Preferred Supplier": /preferred/i.test(text) ? "Yes" : "",
          "BDM Phone": extractLabeledPhone(text, ["BDM", "Business Development", "Sales Manager"]),
          "BDM Contact": "",
          "BDM Notes": "",
          "Travel Agent Support Phone": extractLabeledPhone(text, ["Travel Agent Support", "Advisor Support", "Agent Support", "Reservations"]),
          "Travel Agent Support Contact": "",
          "Travel Agent Support Notes": "",
          "Groups Phone": extractLabeledPhone(text, ["Groups", "Group Sales", "Group Department"]),
          "Groups Contact": "",
          "Groups Notes": "",
          "Customer Service Phone": extractLabeledPhone(text, ["Customer Service", "Service", "Support"]),
          "Customer Service Contact": "",
          "Customer Service Notes": "",
          "Emergency / In Travel Phone": extractLabeledPhone(text, ["Emergency", "In Travel", "After Hours", "After-Hours"]),
          "Emergency / In Travel Contact": "",
          "Emergency / In Travel Notes": "",
          "Commission Notes": firstMatch(text, [/(commission[^.\n]*(?:\.|$))/i]),
          "Internal Notes": headerCells.length ? `${headerCells.join(" | ")}\n${cells.join(" | ")}` : text.slice(0, 900),
        });
      }
    }

    return output;
  }

  function cardRows() {
    const candidates = Array.from(document.querySelectorAll("article, section, li, [class*='card' i], [class*='supplier' i], [class*='vendor' i], [class*='partner' i]"))
      .filter((element) => {
        const text = visibleText(element);
        return text.length >= 8 && text.length <= 3500;
      });

    const rows = candidates.map(rowFromElement).filter(Boolean);
    const seen = new Set();

    return rows.filter((row) => {
      const key = clean(row["Supplier Name"]).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const rows = tableRows().length >= cardRows().length ? tableRows() : cardRows();

  if (rows.length === 0) {
    alert("No supplier rows were found on this page. Try expanding the list or selecting all supplier text, then run the extractor again.");
    return;
  }

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] || "")).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `worldvia-suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  alert(`Created CSV with ${rows.length} supplier row${rows.length === 1 ? "" : "s"}. Upload it in Cozy Concierge > Admin > Suppliers > Import.`);
})();
