import { NextResponse } from "next/server";

export function GET() {
  const privilegedKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const scopedAccess = process.env.SUPABASE_PUBLISHABLE_KEY && process.env.FANTASY_DATABASE_API_SECRET;
  return NextResponse.json({ status: "ok", app: "Fantasy", databaseConfigured: Boolean(process.env.SUPABASE_URL && (privilegedKey || scopedAccess)), footballDataConfigured: Boolean(process.env.API_FOOTBALL_KEY) });
}
