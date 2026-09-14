import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/index';

/**
 * Sonde du conteneur : elle touche vraiment la base, parce qu'un serveur qui
 * répond mais dont le volume est mal monté n'est pas en bonne santé.
 */
export async function GET() {
  try {
    getDatabase().prepare('SELECT 1').get();
    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error('[cuecard] health', cause);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
