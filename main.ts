import { initLogger, logError, logInfo } from "@popov/logger";
initLogger(join(config.configPath, "logs.txt"), { tee: true });

import { Application, Status, isHttpError } from "@oak/oak";
import config from "./src/config.ts";
import { createErrorMessage } from "./src/errors.ts";
import { apiRouter } from "./src/routes.ts";
import { scanLibrary } from "./src/server.ts";
import { oakLogger } from "./src/middlewares.ts";
import { join } from "@std/path/join";

async function main() {
  setInterval(() => {
    scanLibrary({
      rescanManga: config.rescanManga,
      deep: config.deepScan,
      verbose: config.verbose,
    });
  }, config.scanInterval);

  const app = new Application()
    .use(oakLogger())
    .use(async (ctx, next) => {
      try {
        await next();
      } catch (e) {
        if (isHttpError(e)) {
          ctx.response.status = Status.BadRequest;
          ctx.response.body = createErrorMessage("Invalid request", e.message);
        }
      }
    })
    .use(apiRouter.routes());

  logInfo(`Listening to ${config.serverAddress}`, "Oak Application");

  await app.listen(config.serverAddress);
}

try {
  await main();
} catch (err) {
  logError(`Unkown Error: ${err}`, "Server");
}
