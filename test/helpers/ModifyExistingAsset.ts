export default class ModifyExistingAsset {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
    const plugin = { name: this.constructor.name };
    const { ConcatSource, RawSource } = compiler.webpack.sources;

    compiler.hooks.thisCompilation.tap(plugin, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: plugin.name,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const existing = compilation.assets[this.options.name];
          if (existing) {
            compilation.assets[this.options.name] = new ConcatSource(
              new RawSource(this.options.content),
              existing,
            );
          }
        },
      );
    });
  }
}
