import type { NextRequest } from "next/server";
import { getDb } from "@/lib/mongodb";
import { importWorkbook } from "@/lib/importer";

/** Upload one .xlsx/.xls/.csv file (form field "file"); every sheet is read and merged by Instagram handle. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Attach a spreadsheet in the 'file' field." }, { status: 400 });
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return Response.json({ error: "Only .xlsx, .xls or .csv files are supported." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return Response.json({ error: "File is larger than 25 MB." }, { status: 400 });

  try {
    const summary = await importWorkbook(await getDb(), await file.arrayBuffer(), file.name);
    return Response.json(summary);
  } catch (e) {
    return Response.json({ error: `Could not read this file: ${(e as Error).message}` }, { status: 422 });
  }
}
