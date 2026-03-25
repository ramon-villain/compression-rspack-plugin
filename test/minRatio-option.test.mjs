import { CompressionRspackPlugin } from "../dist/index.js";

import compile from "./helpers/compile.mjs";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.mjs";
import getCompiler from "./helpers/getCompiler.mjs";
import getErrors from "./helpers/getErrors.mjs";
import getWarnings from "./helpers/getWarnings.mjs";

describe('"minRatio" option', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler("./entry.js");
  });

  it("matches snapshot for `0` value ({Number})", async () => {
    new CompressionRspackPlugin({
      minRatio: 0,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for `1` value ({Number})", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
