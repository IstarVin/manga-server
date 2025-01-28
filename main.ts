import { Application } from "@oak/oak";
import config from "./src/config.ts";
import { addCategory, getAllMangas } from "./src/db.ts";
import { apiRouter } from "./src/routes.ts";
import { scanLibrary } from "./src/server.ts";
import { syncTachidesk } from "./src/tachidesk.ts";
import { ChapterSchema, MangaSchema } from "./src/models.ts";
import { z } from "zod";

async function scanAndUpdate() {
  await scanLibrary(config.mangasPath);

  await Promise.all(
    (
      await getAllMangas()
    ).map(async (v) => {
      await syncTachidesk(v);
    })
  );
}

// setInterval(async () => {
//   const start = Date.now();
//   await scanAndUpdate();
//   console.log("Updated", new Date(Date.now() - start).getMilliseconds());
// }, 4000);
await scanAndUpdate();

const app = new Application();

app.use(apiRouter.routes());

await addCategory("eyy");
await addCategory("23er");

console.log(`Listening to ${config.serverAddress}`);

await app.listen(config.serverAddress);
