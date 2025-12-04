declare module 'https://deno.land/std@0.201.0/http/server.ts' {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: { port?: number }
  ): Promise<void>
}
