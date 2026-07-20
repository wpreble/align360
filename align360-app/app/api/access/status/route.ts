import { NextResponse } from 'next/server';
import { getAccessStatus } from '@/lib/billing-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Whether the signed-in user may use the app. See lib/billing-access.ts.
export async function GET() {
  return NextResponse.json(await getAccessStatus());
}
