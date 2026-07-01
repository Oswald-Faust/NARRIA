import { NextResponse } from "next/server";
import { FUNCTION_REPERTOIRE, totalFunctions } from "@/lib/engine";

export async function GET() {
  const families = FUNCTION_REPERTOIRE.families.length;
  const african = FUNCTION_REPERTOIRE.families
    .flatMap((f) => f.functions)
    .filter((fn) => fn.african).length;
  return NextResponse.json({
    total: totalFunctions(),
    families,
    african,
    repertoire: FUNCTION_REPERTOIRE,
  });
}
