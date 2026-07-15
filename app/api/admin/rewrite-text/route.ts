import OpenAI from "openai";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  await requireAdmin();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI writing tools are not configured." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const label = String(body?.label ?? "travel text").trim();

  if (!text) {
    return NextResponse.json(
      { error: "Add text before asking AI to rewrite it." },
      { status: 400 },
    );
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "You rewrite travel agency CRM text for Cozy Adventure Vacations.",
          "Make the text flow better, easier to understand, warm, polished, and client-friendly.",
          "Preserve the original meaning, dates, prices, supplier names, policies, and caveats.",
          "Do not add facts, promises, guarantees, legal language, or supplier rules.",
          "Return only the rewritten text. No markdown fences.",
        ].join("\n"),
      },
      {
        role: "user",
        content: `Rewrite this ${label}:\n\n${text}`,
      },
    ],
    temperature: 0.35,
  });

  const rewritten = response.output_text?.trim();

  if (!rewritten) {
    return NextResponse.json(
      { error: "AI did not return rewritten text." },
      { status: 502 },
    );
  }

  return NextResponse.json({ rewritten });
}
