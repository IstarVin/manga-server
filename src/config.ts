import "@std/dotenv/load";
import { existsSync } from "@std/fs";
import { join } from "@std/path";

export type Config = {
  serverAddress: string;
  configPath: string;
  mangasPath: string;
  dbPath: string;

  verbose?: boolean;
  tachideskGraphQLUrl: string;
  deepScan?: boolean;
  rescanManga?: boolean;
  rescanChapters?: boolean;
  scanInterval: number;
};

function setupConfigFile(path: string, defaultConfig: Config): Config {
  if (existsSync(path)) {
    const configFile = JSON.parse(Deno.readTextFileSync(path)) as Config;
    return Object.assign(defaultConfig, configFile);
  } else {
    Deno.writeTextFile(path, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

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

const config = setupConfigFile(configFilePath, defaultConfig);

config.serverAddress = Deno.env.get("SERVER_ADDRESS") || config.serverAddress;
config.configPath = Deno.env.get("CONFIG_PATH") || config.configPath;
config.mangasPath = Deno.env.get("MANGAS_PATH") || config.mangasPath;
config.tachideskGraphQLUrl =
  Deno.env.get("TACHIDESK_GRAPHQL_URL") || config.tachideskGraphQLUrl;

export default config;
