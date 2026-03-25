export default class ChildCompilationPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("ChildCompilationPlugin", (compilation) => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: "ChildCompilationPlugin",
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        (_assets, callback) => {
          const child = compilation.createChildCompiler("child", {});
          const { RawSource } = compiler.webpack.sources;

          child.hooks.thisCompilation.tap("ChildCompilationPlugin", (childCompilation) => {
            childCompilation.hooks.processAssets.tap(
              {
                name: "ChildCompilationPlugin",
                stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
              },
              () => {
                childCompilation.emitAsset(
                  "child-asset.js",
                  new RawSource('console.log("child");'),
                );
              },
            );
          });

          child.runAsChild((err) => {
            callback(err);
          });
        },
      );
    });
  }
}
