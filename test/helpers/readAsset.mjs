import path from "node:path";

export default function readAsset(asset, compiler, stats) {
  const usedFs = compiler.outputFileSystem;
  const outputPath = stats.compilation.outputOptions.path;

  let targetFile = asset;
  const queryStringIdx = targetFile.indexOf("?");
  if (queryStringIdx >= 0) {
    targetFile = targetFile.slice(0, queryStringIdx);
  }

  try {
    return usedFs.readFileSync(path.join(outputPath, targetFile));
  } catch (error) {
    return error.toString();
  }
}
