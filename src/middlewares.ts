import type { Context, Middleware, Next } from "@oak/oak";
import { logInfo, logSuccess } from "@popov/logger";
import * as http from "@std/http";

export function oakLogger(): Middleware {
  return async ({ request, response }: Context, next: Next) => {
    await next();

    const { method, url } = request;
    const { status } = response;

    const prefix = `[${status}]`;

    const message = `${prefix} ${method} ${url.pathname} from ${request.ip}`;
    if (http.isSuccessfulStatus(status)) {
      logSuccess(message, "API");
    } else {
      logInfo(message, "API");
    }
  };
}
