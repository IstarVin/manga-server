import "@std/dotenv/load";
import { exists, existsSync } from "@std/fs";
import { join } from "@std/path";
import { logError, logInfo } from "@popov/logger";
import { z } from "zod";

const Config = z.object({
  serverAddress: z.string(),
  configPath: z.string(),
  mangasPath: z.string(),
  dbPath: z.string(),
  tachideskGraphQLUrl: z.string(),
  scanInterval: z.number(),
  verbose: z.boolean().optional(),
  deepScan: z.boolean().optional(),
  rescanManga: z.boolean().optional(),
  rescanChapters: z.boolean().optional(),
});
export type Config = z.infer<typeof Config>;

const defaultConfig: Config = {
  serverAddress: "0.0.0.0:8008",
  configPath: ".",
  mangasPath: "./mangas",
  dbPath: "./db.kv",

  verbose: true,
  tachideskGraphQLUrl: "http://localhost:4567/api/graphql",
  deepScan: false,
  rescanChapters: false,
  rescanManga: false,
  scanInterval: 43200000, // 12 hours
};

const configFilePath = join(defaultConfig.configPath, "config.json");

async function checkConfig(conf: Config) {
  const res: {
    ok: boolean;
    mangasPath?: string;
    tachideskGraphQLUrl?: string;
  } = { ok: true };
  if (!(await exists(conf.mangasPath, { isDirectory: true }))) {
    res.mangasPath = "Mangas folder does not exist";
    res.ok = false;
  }
  if ((await fetch(conf.tachideskGraphQLUrl)).status !== 200) {
    res.tachideskGraphQLUrl = "Tachidesk GraphQL Url cannot be reached";
    res.ok = false;
  }
  return res;
}

async function watchConfigFile() {
  const watch = Deno.watchFs(configFilePath);
  for await (const event of watch) {
    if (event.kind === "modify") {
      logInfo("Config file modified, refreshing configuration", "Watcher");
      await setupConfig();
    }
  }
}

function setupConfigFile(path: string): Config {
  if (existsSync(path)) {
    try {
      const configFile = Config.parse(JSON.parse(Deno.readTextFileSync(path)));
      return Object.assign(defaultConfig, configFile);
    } catch (e) {
      logError("Invalid config file, using default config", "Config Setup");
      console.error(e);
      return defaultConfig;
    }
  } else {
    logInfo("Writing new config file", "Config Setup");
    Deno.writeTextFile(path, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

let config: Config = defaultConfig;

watchConfigFile();

export async function setupConfig() {
  config = setupConfigFile(configFilePath);

  config.serverAddress = Deno.env.get("SERVER_ADDRESS") || config.serverAddress;
  config.configPath = Deno.env.get("CONFIG_PATH") || config.configPath;
  config.mangasPath = Deno.env.get("MANGAS_PATH") || config.mangasPath;
  config.tachideskGraphQLUrl =
    Deno.env.get("TACHIDESK_GRAPHQL_URL") || config.tachideskGraphQLUrl;

  const res = await checkConfig(config);
  if (!res.ok) {
    logError("Invalid configuration settings", "Config Setup");
    if (res.mangasPath) {
      logError(`${res.mangasPath} (${config.mangasPath})`);
    }
    if (res.tachideskGraphQLUrl) {
      logError(`${res.tachideskGraphQLUrl} (${config.tachideskGraphQLUrl})`);
    }

    Deno.exit(1);
  }
}

export default config;
