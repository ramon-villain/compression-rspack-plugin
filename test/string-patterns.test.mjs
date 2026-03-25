import { CompressionRspackPlugin } from "../dist/index.js";

import compile from "./helpers/compile.mjs";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.mjs";
import getCompiler from "./helpers/getCompiler.mjs";
import getErrors from "./helpers/getErrors.mjs";

describe("pattern matching for test/include/exclude", () => {
  it('should work with "test" as a RegExp', async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      test: /\.js$/,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    expect(gzFiles.length).toBeGreaterThan(0);
    for (const [name] of gzFiles) {
      expect(name).toContain(".js");
    }
    expect(getErrors(stats)).toHaveLength(0);
  });

  it('should work with "include" as a RegExp', async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      include: /\.svg$/,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    expect(gzFiles.length).toBeGreaterThan(0);
    for (const [name] of gzFiles) {
      expect(name).toContain(".svg");
    }
  });

  it('should work with "exclude" as a RegExp', async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      exclude: /\.png$/,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    for (const [name] of gzFiles) {
      expect(name).not.toContain(".png");
    }
  });

  it('should work with "test" as an array of RegExps', async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      test: [/\.js$/, /\.svg$/],
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    expect(gzFiles.length).toBeGreaterThan(0);
  });

  it("should work with mixed patterns in array", async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      test: [/\.js$/, /\.svg$/],
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    expect(gzFiles.length).toBeGreaterThan(0);
  });
});
