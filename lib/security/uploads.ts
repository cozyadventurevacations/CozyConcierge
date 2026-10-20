export async function validateDocumentUpload(file: File): Promise<string> {
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("Choose a file under 15MB.");
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const text = new TextDecoder().decode(bytes);
  let detected = "";
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) detected = "application/pdf";
  else if (starts(0xff, 0xd8, 0xff)) detected = "image/jpeg";
  else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) detected = "image/png";
  else if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") detected = "image/webp";
  else if (starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1) && /\.doc$/i.test(file.name)) detected = "application/msword";
  else if (starts(0x50, 0x4b, 0x03, 0x04) && /\.docx$/i.test(file.name)) {
    const tail = new TextDecoder().decode(await file.slice(Math.max(0, file.size - 65536)).arrayBuffer());
    if (tail.includes("word/document.xml") && tail.includes("[Content_Types].xml")) {
      detected = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
  }
  if (!detected || (file.type && file.type !== "application/octet-stream" && file.type !== detected)) {
    throw new Error("The file contents do not match a supported JPG, PNG, WEBP, PDF, DOC, or DOCX document.");
  }
  return detected;
}
