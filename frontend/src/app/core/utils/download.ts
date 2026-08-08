import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// A plain <a href="/api/..."> triggers a raw browser navigation that never passes through
// Angular's HttpClient - so the auth interceptor (core/interceptors/auth.interceptor.ts) never
// attaches the Authorization header, and the request 401s with "Missing access token". Routing
// the download through HttpClient as a blob picks up the interceptor (including its 401
// auto-refresh) and never puts the access token in a URL, unlike the SSE tail workaround
// (EventSource genuinely can't set custom headers; a normal HTTP download isn't under that
// restriction, so there's no reason to accept that same tradeoff here).
export async function downloadFile(http: HttpClient, url: string, filename: string): Promise<void> {
  const blob = await firstValueFrom(http.get(url, { responseType: 'blob' }));
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
