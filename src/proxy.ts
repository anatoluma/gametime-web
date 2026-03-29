import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Track page visits (skip API routes and static assets)
  const pathname = request.nextUrl.pathname

  if (
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    // Send tracking request asynchronously
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`

    try {
      fetch(`${baseUrl}/api/stats/track-visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
          'x-real-ip': request.headers.get('x-real-ip') || '',
          'user-agent': request.headers.get('user-agent') || '',
        },
        body: JSON.stringify({
          pagePath: pathname,
          referrer: request.headers.get('referer') || null,
        }),
      }).catch((err) => {
        // Silently fail - don't block page rendering
        console.error('Failed to track visit:', err)
      })
    } catch (error) {
      // Silently fail
      console.error('Error triggering visit tracking:', error)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}