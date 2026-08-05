import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // supabase.auth.getUser() faz uma chamada de rede pro Supabase sem timeout
  // próprio — se o Supabase estiver lento/pausado (comum no plano free após
  // um tempo sem uso), o middleware fica esperando até a Vercel derrubar a
  // função com 504 "Middleware Invocation Timeout". Isso garante que o
  // middleware sempre responde rápido: se a checagem de sessão não voltar
  // a tempo, trata como "não logado" (rota privada redireciona pro login,
  // que é o lado seguro) em vez de travar o site inteiro.
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

  const isPrivateRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                          request.nextUrl.pathname.startsWith('/trips') ||
                          request.nextUrl.pathname.startsWith('/perfil');

  if (isPrivateRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/cadastro') && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/trips/:path*', '/perfil/:path*', '/login', '/cadastro'],
};
