import { join } from "@std/path";
import "@std/dotenv/load";
import { existsSync } from "@std/fs";

export type Config = {
  serverAddress: string;
  configPath: string;
  mangasPath: string;

  tachideskGraphQLUrl: string;
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

  tachideskGraphQLUrl: "http://localhost:4567/api/graphql",
};

const configFilePath = join(defaultConfig.configPath, "config.json");

const config = setupConfigFile(configFilePath, defaultConfig);

config.serverAddress = Deno.env.get("SERVER_ADDRESS") || config.serverAddress;
config.configPath = Deno.env.get("CONFIG_PATH") || config.configPath;
config.mangasPath = Deno.env.get("MANGAS_PATH") || config.mangasPath;
config.tachideskGraphQLUrl =
  Deno.env.get("TACHIDESK_GRAPHQL_URL") || config.tachideskGraphQLUrl;

export default config;
