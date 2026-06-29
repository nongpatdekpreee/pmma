import { NextRequest, NextResponse } from 'next/server';

function getBackendBase(): string {
  return (
    process.env.API_PROXY_TARGET ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:5000'
  ).replace(/\/$/, '');
}

async function proxyAuth(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const subPath = pathSegments.join('/');
  const target = `${getBackendBase()}/api/auth/${subPath}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    redirect: 'manual',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    init.duplex = 'half';
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyAuth(req, path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyAuth(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyAuth(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyAuth(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyAuth(req, path);
}

export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  const { path = [] } = await ctx.params;
  return proxyAuth(req, path);
}
