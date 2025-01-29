import { Application, Status, isHttpError } from "@oak/oak";
import config from "./src/config.ts";
import { createErrorMessage } from "./src/errors.ts";
import { apiRouter } from "./src/routes.ts";
import { scanLibrary } from "./src/server.ts";
import { runAndSetInterval } from "./src/utils.ts";

runAndSetInterval(
  () => {
    scanLibrary();
  },
  { delay: config.scanInterval }
);

const app = new Application()
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

console.log(`Listening to ${config.serverAddress}`);

await app.listen(config.serverAddress);
