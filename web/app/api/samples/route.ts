import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const IDS = ["romeo_juliette", "amants_conakry", "saison_pluies"];

export async function GET() {
  const samples = IDS.map((id) => {
    const p = join(process.cwd(), "content/samples", `${id}.json`);
    const d = JSON.parse(readFileSync(p, "utf-8"));
    return { id, title: d.title, author: d.author, text: d.text };
  });
  return NextResponse.json({ samples });
}
