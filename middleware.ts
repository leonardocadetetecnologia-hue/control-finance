import { auth } from '@/auth'

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth)
  const isApiRoute = req.nextUrl.pathname.startsWith('/api')
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')

  if (isApiRoute) {
    return
  }

  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL('/', req.nextUrl))
  }

  if (!isAuthPage && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
