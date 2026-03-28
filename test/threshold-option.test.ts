import { CompressionRspackPlugin } from "../lib/index.ts";

import compile from "./helpers/compile.ts";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.ts";
import getCompiler from "./helpers/getCompiler.ts";
import getErrors from "./helpers/getErrors.ts";
import getWarnings from "./helpers/getWarnings.ts";

describe('"threshold" option', () => {
  let compiler: ReturnType<typeof getCompiler>;

  beforeEach(() => {
    compiler = getCompiler("./entry.js");
  });

  it("matches snapshot for `0` value ({Number})", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      threshold: 0,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for `8192` value ({Number})", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      threshold: 8192,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it('should compress all assets including assets with "0" bytes original size', async () => {
    compiler = getCompiler("./empty.js");

    new CompressionRspackPlugin({
      minRatio: Infinity,
      threshold: 0,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it('should compress all assets excluding assets with "0" bytes original size', async () => {
    compiler = getCompiler("./empty.js");

    new CompressionRspackPlugin({
      minRatio: Number.MAX_SAFE_INTEGER,
      threshold: 0,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
