# compression-rspack-plugin

Rust-native parallel compression plugin for [Rspack](https://rspack.dev). Drop-in replacement for [compression-webpack-plugin](https://github.com/webpack/compression-webpack-plugin).

Compresses assets **in parallel** across all CPU cores via Rust + [rayon](https://github.com/rayon-rs/rayon), instead of serially on the Node.js main thread.

## Benchmarks

Tested on a production Rspack build (~1,400 assets, Apple M3 Pro 14-core).

| | compression-webpack-plugin | compression-rspack-plugin |
|---|---|---|
| **Build time** (avg of 3) | 82.7s | **37.3s** (2.2x faster) |
| **Compression phase** (RsDoctor) | 61.1s | **20.3s** (3.0x faster) |
| .gz files | 1,410 | 1,411 |
| .br files | 1,444 | 1,444 |

## Install

```bash
pnpm add compression-rspack-plugin
```

Requires Rust toolchain (`rustc`, `cargo`) for the native addon. Install via [rustup](https://rustup.rs).

## Usage

```js
import { CompressionRspackPlugin } from 'compression-rspack-plugin'

export default {
  plugins: [
    new CompressionRspackPlugin({ test: /\.(js|css|html|json|svg)$/ }),
    new CompressionRspackPlugin({ algorithm: 'brotliCompress', test: /\.(js|css|html|json|svg)$/ }),
  ],
}
```

## Options

Same interface as [compression-webpack-plugin](https://github.com/webpack/compression-webpack-plugin#options). Validated via `schema-utils`.

| Option | Type | Default | Description |
|---|---|---|---|
| `algorithm` | `string \| Function` | `"gzip"` | `"gzip"`, `"brotliCompress"`, `"deflate"`, `"deflateRaw"`, or custom callback |
| `compressionOptions` | `object` | `{}` | Passed to the algorithm. Defaults to max quality per algorithm. |
| `filename` | `string \| Function` | `"[path][base].gz"` | Output template. `"[path][base].br"` for brotli. |
| `test` | `RegExp \| string \| Array` | — | Include matching assets |
| `include` | `RegExp \| string \| Array` | — | Include matching assets |
| `exclude` | `RegExp \| string \| Array` | — | Exclude matching assets |
| `threshold` | `number` | `0` | Min size in bytes |
| `minRatio` | `number` | `0.8` | Only emit if compressed/original < this |
| `deleteOriginalAssets` | `boolean \| "keep-source-map" \| Function` | `false` | Remove originals after compression |

## How it works

Built-in algorithms (`gzip`, `brotliCompress`, `deflate`, `deflateRaw`) are handled by [flate2](https://github.com/rust-lang/flate2-rs) and [brotli](https://github.com/dropbox/rust-brotli) in Rust via a single napi-rs FFI call. Custom algorithms fall back to Node.js `zlib`.

## Differences from compression-webpack-plugin

| | compression-webpack-plugin | compression-rspack-plugin |
|---|---|---|
| Compression | Node.js zlib (serial) | Rust rayon (parallel) + zlib fallback |
| Compilation cache | Yes | Yes |
| Child compilations | Yes (scoped via `thisCompilation`) | Yes |
| `[compressed]` stats flag | Yes | Registered, not rendered by rspack 2.0 beta |

## Development

```bash
pnpm install        # install deps
pnpm build          # native addon + TypeScript
pnpm test           # JS tests (118 tests)
pnpm test:rust      # Rust unit tests
pnpm lint           # biome
pnpm lint:rs        # cargo fmt + clippy
pnpm typecheck      # tsc --noEmit
```

## License

[MIT](LICENSE)
