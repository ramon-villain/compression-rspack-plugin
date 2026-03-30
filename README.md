# compression-rspack-plugin

Rust-native parallel compression plugin for [Rspack](https://rspack.dev). Drop-in replacement for [compression-webpack-plugin](https://github.com/webpack/compression-webpack-plugin).

Compresses assets **in parallel** across all CPU cores via Rust + [rayon](https://github.com/rayon-rs/rayon), instead of serially on the Node.js main thread.

## Install

```bash
npm install compression-rspack-plugin
# or
pnpm add compression-rspack-plugin
# or
yarn add compression-rspack-plugin
```

Prebuilt binaries are available for macOS (arm64, x64), Linux (x64 glibc, arm64 glibc, x64 musl). The correct binary is installed automatically via platform-specific optional dependencies.

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

## Benchmarks

Tested on a production Rspack build (~1,400 assets, Apple M3 Pro 14-core).

| | compression-webpack-plugin | compression-rspack-plugin |
|---|---|---|
| **Build time** (avg of 3) | 82.7s | **37.3s** (2.2x faster) |
| **Compression phase** (RsDoctor) | 61.1s | **20.3s** (3.0x faster) |
| .gz files | 1,410 | 1,411 |
| .br files | 1,444 | 1,444 |
| gzip-6 / 1 KB | 106 MiB/s | 143 MiB/s (1.4x) |
| gzip-6 / 100 KB | 0.66 GiB/s | 2.77 GiB/s (4.2x) |
| gzip-6 / 1 MB | 0.66 GiB/s | 3.30 GiB/s (5.0x) |
| deflate-6 / 1 MB | 0.69 GiB/s | 2.03 GiB/s (2.9x) |

## How it works

Built-in algorithms (`gzip`, `brotliCompress`, `deflate`, `deflateRaw`) are handled by [flate2](https://github.com/rust-lang/flate2-rs) and [brotli](https://github.com/dropbox/rust-brotli) in Rust via a single napi-rs FFI call. Custom algorithms fall back to Node.js `zlib`.

## Differences from compression-webpack-plugin

| | compression-webpack-plugin | compression-rspack-plugin |
|---|---|---|
| Compression | Node.js zlib (serial) | Rust rayon (parallel) + zlib fallback |
| Compilation cache | Yes | Not yet |
| Child compilations | Yes (scoped via `thisCompilation`) | Yes |
| `[compressed]` stats flag | Yes | Registered, not rendered by rspack 2.0 beta |

## Development

```bash
pnpm install        # install deps
pnpm build          # native addon + TypeScript
pnpm test           # JS tests (120 tests)
pnpm test:rust      # Rust unit tests
pnpm lint           # biome
pnpm lint:rs        # cargo fmt + clippy
pnpm typecheck      # tsc --noEmit
```

## License

[MIT](LICENSE)
