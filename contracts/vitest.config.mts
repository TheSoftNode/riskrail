import { defineConfig } from "vitest/config";
import {
  getClarinetVitestsArgv,
  vitestSetupFilePath,
} from "@stacks/clarinet-sdk/vitest";

/**
 * The clarinet environment reads its manifest path and coverage/cost settings
 * from `environmentOptions.clarinet`, and needs the SDK's setup file to expose
 * `simnet` to the tests. Without both, every worker fails to start before a
 * single test runs.
 */
export default defineConfig({
  test: {
    environment: "clarinet",
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    setupFiles: [vitestSetupFilePath],
    environmentOptions: {
      clarinet: getClarinetVitestsArgv(),
    },
  },
});
