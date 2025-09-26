import { NextRequest, NextResponse } from 'next/server';
import acceptLanguage from 'accept-language';
import { fallbackLng, languages } from './i18n/settings';

acceptLanguage.languages(languages);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js|locales|.*\\..*).*)']
};

const cookieName = 'i18next';

export function middleware(req: NextRequest) {
  let lng;
  if (req.cookies.has(cookieName)) {
    lng = acceptLanguage.get(req.cookies.get(cookieName)?.value);
  }
  if (!lng) {
    lng = acceptLanguage.get(req.headers.get('Accept-Language'));
  }
  if (!lng) {
    lng = fallbackLng;
  }

  // Redirect if lng in path is not supported
  if (
    !languages.some(loc => req.nextUrl.pathname.startsWith(`/${loc}`)) &&
    !req.nextUrl.pathname.startsWith('/_next')
  ) {
    return NextResponse.redirect(new URL(`/${lng}${req.nextUrl.pathname}`, req.url));
  }

  // If path has supported lng but differs from cookie, align to cookie (persisted preference)
  const currentLng = languages.find((l) => req.nextUrl.pathname.startsWith(`/${l}`));
  if (currentLng && lng && currentLng !== lng) {
    const url = new URL(req.url);
    url.pathname = url.pathname.replace(`/${currentLng}`, `/${lng}`);
    return NextResponse.redirect(url);
  }

  if (req.headers.has('referer')) {
    const refererUrl = new URL(req.headers.get('referer') as string);
    const lngInReferer = languages.find((l) => refererUrl.pathname.startsWith(`/${l}`));
    const response = NextResponse.next();
    if (lngInReferer) {
      response.cookies.set(cookieName, lngInReferer);
    }
    return response;
  }

  // Ensure cookie reflects path language for first-time/anonymous visitors
  if (currentLng) {
    const res = NextResponse.next();
    res.cookies.set(cookieName, currentLng);
    return res;
  }

  return NextResponse.next();
}
