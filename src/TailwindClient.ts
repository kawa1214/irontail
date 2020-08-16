import * as ts from "typescript/lib/tsserverlibrary";
import * as fs from "fs";
import * as path from "path";
import importFrom = require("import-from");
import resolveFrom = require("resolve-from");
import { extractClassNames } from "./extractClassNames";
import { getTailwindConfigPath } from "./getTailwindConfigPath";

export class TailwindClient {
  static currentClasses?: Record<string, unknown>;

  static lastUpdatedAt?: number;

  getLastUpdatedAt() {
    return fs.statSync(this.getConfigPath()).mtimeMs;
  }

  isFresh() {
    return TailwindClient.lastUpdatedAt === this.getLastUpdatedAt();
  }

  constructor(private readonly project: ts.server.Project) {}

  getClassNames() {
    return TailwindClient.currentClasses ?? {};
  }

  getConfigPath() {
    return getTailwindConfigPath(this.project);
  }

  async requestCompileCss() {
    const configPath = this.getConfigPath();
    const postcss = this.requirePostCss();
    const tailwindcss = this.requireTailwindCss();

    this.project.projectService.logger.info(
      `start compile ${new Date().toISOString()}`
    );
    return Promise.all(
      ["base", "components", "utilities"].map((group) =>
        postcss([tailwindcss(configPath)]).process(`@tailwind ${group};`, {
          from: undefined,
          to: undefined,
          map: false,
        })
      )
    ).then((result) => {
      TailwindClient.lastUpdatedAt = this.getLastUpdatedAt();
      TailwindClient.currentClasses = extractClassNames(result);

      this.project.projectService.logger.info(
        JSON.stringify(TailwindClient.currentClasses)
      );
    });
  }

  private _postcss?: typeof import("postcss");
  private requirePostCss() {
    if (this._postcss) {
      return this._postcss;
    }

    const configPath = this.getConfigPath();
    const tailwindRootPath = path.dirname(
      resolveFrom(configPath, "tailwindcss/package.json")
    );

    this._postcss = importFrom(
      tailwindRootPath,
      "postcss"
    ) as typeof import("postcss");

    return this._postcss;
  }

  private _tailwindcss?: Function;
  private requireTailwindCss() {
    if (this._tailwindcss) {
      return this._tailwindcss;
    }

    this._tailwindcss = importFrom(
      path.dirname(this.getConfigPath()),
      "tailwindcss"
    ) as Function;

    return this._tailwindcss;
  }
}
