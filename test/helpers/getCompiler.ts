import path from "node:path";
import { fileURLToPath } from "node:url";
import rspack from "@rspack/core";
import { createFsFromVolume, Volume } from "memfs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function getCompiler(fixture, _loaderOptions = {}, config = {}) {
  const fullConfig = {
    mode: "development",
    devtool: config.devtool || false,
    context: path.resolve(__dirname, "../fixtures"),
    entry: path.resolve(__dirname, "../fixtures", fixture),
    output: {
      path: path.resolve(__dirname, "../outputs"),
      filename: "[name].[contenthash].js",
      chunkFilename: "[id].[name].[contenthash].js",
      ...config.output,
    },
    module: {
      rules: [
        {
          test: /\.(png|jpg|gif|svg|txt)$/i,
          type: "asset/resource",
        },
        ...(config.module?.rules || []),
      ],
    },
    optimization: {
      minimize: false,
      ...config.optimization,
    },
    plugins: config.plugins || [],
    ...Object.fromEntries(
      Object.entries(config).filter(
        ([k]) => !["output", "optimization", "plugins", "module", "devtool"].includes(k),
      ),
    ),
  };

  const compiler = rspack(fullConfig);

  if (!config.outputFileSystem) {
    const outputFileSystem = createFsFromVolume(new Volume());
    outputFileSystem.join = path.join.bind(path);
    compiler.outputFileSystem = outputFileSystem;
  }

  return compiler;
}
