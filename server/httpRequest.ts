// Тонкая promise-обёртка вокруг node:https / node:http — обход бага undici
// (`fetch failed: ConnectTimeoutError`) с некоторыми Cloudflare-защищёнными
// хостами (api.elevenlabs.io, api.telegram.org). Используется в местах
// где undici fetch не дотягивается.

import { request as httpsRequest, type RequestOptions } from 'node:https';

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  bodyText: string;
  bodyBytes: Buffer;
}

export interface HttpRequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
}

export function httpRequest(
  url: string,
  opts: HttpRequestOpts = {}
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts: RequestOptions = {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: opts.method ?? 'GET',
      headers: opts.headers ?? {},
      family: 4, // IPv4 only — обходим висящий v6
    };

    const req = httpsRequest(reqOpts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          bodyText: buf.toString('utf8'),
          bodyBytes: buf,
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(opts.timeoutMs ?? 30_000, () => {
      req.destroy(new Error(`Request timeout after ${opts.timeoutMs ?? 30_000}ms`));
    });

    if (opts.body) req.write(opts.body);
    req.end();
  });
}
