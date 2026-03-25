export default class CopyPluginWithAssetInfo {
  apply(compiler) {
    const plugin = { name: this.constructor.name };
    const { RawSource } = compiler.webpack.sources;

    compiler.hooks.thisCompilation.tap(plugin, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: plugin.name,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          compilation.emitAsset("copied.js", new RawSource("Text".repeat(100)), {
            copied: true,
          });
        },
      );
    });
  }
}
