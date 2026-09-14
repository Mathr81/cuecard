import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/external/respond';
import { clearUsage, usageTotals } from '@/lib/usage/repository';

export async function GET() {
  try {
    return NextResponse.json({ totals: usageTotals() });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function DELETE() {
  try {
    clearUsage();
    return NextResponse.json({ totals: usageTotals() });
  } catch (cause) {
    return errorResponse(cause);
  }
}
