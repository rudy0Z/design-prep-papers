import path from 'path';
import { promises as fs } from 'fs';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Reusable header builder
function getPdfHeaders(contentLength: number) {
  return {
    'Content-Type': 'application/pdf',
    'Content-Length': String(contentLength),
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'none', // Tell PDF.js not to attempt range requests
    // Prevent browser caching of any partial/bad responses during development
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const base = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'data');
  const file = path.join(base, ...slug);

  // Prevent path traversal
  if (!file.startsWith(base)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const data = await fs.readFile(file);
    return new Response(data, {
      status: 200,
      headers: getPdfHeaders(data.length),
    });
  } catch (err) {
    console.error(`[/api/pdf] GET - Cannot read file: ${file}`, err);
    return new Response('Not found', { status: 404 });
  }
}

export async function HEAD(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const base = path.join(/* turbopackIgnore: true */ process.cwd(), 'public', 'data');
  const file = path.join(base, ...slug);

  // Prevent path traversal
  if (!file.startsWith(base)) {
    return new Response(null, { status: 403 });
  }

  try {
    const stats = await fs.stat(file);
    return new Response(null, {
      status: 200,
      headers: getPdfHeaders(stats.size),
    });
  } catch (err) {
    console.error(`[/api/pdf] HEAD - Cannot stat file: ${file}`, err);
    return new Response(null, { status: 404 });
  }
}
