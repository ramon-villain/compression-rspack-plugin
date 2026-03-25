import { CompressionRspackPlugin } from "../dist/index.js";

import compile from "./helpers/compile.mjs";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.mjs";
import getCompiler from "./helpers/getCompiler.mjs";
import getErrors from "./helpers/getErrors.mjs";
import getWarnings from "./helpers/getWarnings.mjs";

describe('"algorithm" option', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler("./entry.js");
  });

  it("matches snapshot for `unknown` value ({String})", () => {
    expect(() => {
      new CompressionRspackPlugin({
        minRatio: 1,
        algorithm: "unknown",
      }).apply(compiler);
    }).toThrowErrorMatchingSnapshot();
  });

  it("matches snapshot for `gzip` value ({String})", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      algorithm: "gzip",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for custom function ({Function})", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      algorithm(input, compressionOptions, callback) {
        expect(compressionOptions).toMatchSnapshot("compressionOptions");

        return callback(null, input);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for custom function with error ({Function})", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      algorithm(input, compressionOptions, callback) {
        expect(compressionOptions).toMatchSnapshot("compressionOptions");

        return callback("Error", input);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
