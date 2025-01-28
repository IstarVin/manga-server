import { Application, Status, isHttpError } from "@oak/oak";
import config from "./src/config.ts";
import { addCategory } from "./src/db.ts";
import { apiRouter } from "./src/routes.ts";
import { scanLibrary } from "./src/server.ts";
import { createErrorMessage } from "./src/errors.ts";

async function scanAndUpdate() {
  await scanLibrary(config.mangasPath);

  // await Promise.all(
  //   (
  //     await getAllMangas()
  //   ).map(async (v) => {
  //     await syncTachidesk(v);
  //   })
  // );
}

scanAndUpdate();

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

await addCategory("eyy");
await addCategory("23er");

console.log(`Listening to ${config.serverAddress}`);

await app.listen(config.serverAddress);
