use std::io::{Cursor, Write};
use std::sync::Arc;

use brotli::enc::backward_references::BrotliEncoderParams;
use brotli::enc::BrotliCompress;
use flate2::write::{DeflateEncoder, GzEncoder, ZlibEncoder};
use flate2::Compression;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;

#[napi(object)]
pub struct AssetInput {
  pub name: String,
  pub buffer: Buffer,
}

#[napi(object)]
pub struct CompressOptions {
  pub algorithm: String,
  pub level: Option<u32>,
}

#[napi(object)]
pub struct CompressedAsset {
  pub name: String,
  pub buffer: Buffer,
  pub algorithm: String,
  pub original_size: u32,
  pub compressed_size: u32,
}

#[derive(Clone, Copy, Debug)]
enum Algorithm {
  Gzip,
  Brotli,
  Deflate,
  DeflateRaw,
}

impl Algorithm {
  fn compress(
    self,
    input: &[u8],
    level: u32,
    brotli_params: &BrotliEncoderParams,
  ) -> Result<Vec<u8>> {
    match self {
      Self::Gzip => {
        let mut enc = GzEncoder::new(Vec::with_capacity(input.len() / 2), Compression::new(level));
        enc
          .write_all(input)
          .and_then(|_| enc.finish())
          .map_err(|e| Error::new(Status::GenericFailure, format!("gzip failed: {e}")))
      }
      Self::Brotli => {
        let mut output = Vec::with_capacity(input.len() / 2);
        BrotliCompress(&mut Cursor::new(input), &mut output, brotli_params)
          .map_err(|e| Error::new(Status::GenericFailure, format!("brotli failed: {e}")))?;
        Ok(output)
      }
      // ZlibEncoder produces zlib-wrapped output (RFC 1950), matching Node's zlib.deflate
      Self::Deflate => {
        let mut enc =
          ZlibEncoder::new(Vec::with_capacity(input.len() / 2), Compression::new(level));
        enc
          .write_all(input)
          .and_then(|_| enc.finish())
          .map_err(|e| Error::new(Status::GenericFailure, format!("deflate failed: {e}")))
      }
      Self::DeflateRaw => {
        let mut enc =
          DeflateEncoder::new(Vec::with_capacity(input.len() / 2), Compression::new(level));
        enc
          .write_all(input)
          .and_then(|_| enc.finish())
          .map_err(|e| Error::new(Status::GenericFailure, format!("deflateRaw failed: {e}")))
      }
    }
  }
}

fn resolve_algorithm(name: &str) -> Result<Algorithm> {
  match name {
    "gzip" => Ok(Algorithm::Gzip),
    "brotli" | "brotliCompress" => Ok(Algorithm::Brotli),
    "deflate" => Ok(Algorithm::Deflate),
    "deflateRaw" => Ok(Algorithm::DeflateRaw),
    _ => Err(Error::new(
      Status::InvalidArg,
      format!("unsupported algorithm: {name}"),
    )),
  }
}

fn default_level(algorithm: &str) -> u32 {
  match algorithm {
    "gzip" | "deflate" | "deflateRaw" => 9,
    "brotli" | "brotliCompress" => 11,
    _ => 6,
  }
}

fn validate_level(algorithm: &str, level: u32) -> napi::Result<()> {
  let max = match algorithm {
    "brotli" | "brotliCompress" => 11,
    _ => 9,
  };
  if level > max {
    return Err(Error::new(
      Status::InvalidArg,
      format!("level {level} is out of range for {algorithm} (max {max})"),
    ));
  }
  Ok(())
}

fn compress_all(
  assets: Vec<AssetInput>,
  algo: Algorithm,
  algo_name: Arc<str>,
  level: u32,
) -> napi::Result<Vec<CompressedAsset>> {
  let brotli_params = BrotliEncoderParams {
    quality: level as i32,
    ..Default::default()
  };
  assets
    .into_par_iter()
    .map(|asset| {
      let content: &[u8] = &asset.buffer;
      let original_size = u32::try_from(content.len()).unwrap_or(u32::MAX);
      let compressed = algo.compress(content, level, &brotli_params)?;
      let compressed_size = u32::try_from(compressed.len()).unwrap_or(u32::MAX);

      Ok(CompressedAsset {
        name: asset.name,
        buffer: compressed.into(),
        algorithm: algo_name.to_string(),
        original_size,
        compressed_size,
      })
    })
    .collect()
}

#[napi]
pub fn compress_assets(
  assets: Vec<AssetInput>,
  options: CompressOptions,
) -> napi::Result<Vec<CompressedAsset>> {
  let level = options
    .level
    .unwrap_or_else(|| default_level(&options.algorithm));

  validate_level(&options.algorithm, level)?;

  let algo = resolve_algorithm(&options.algorithm)?;
  let algo_name: Arc<str> = Arc::from(options.algorithm.as_str());

  compress_all(assets, algo, algo_name, level)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn bp(quality: u32) -> BrotliEncoderParams {
    BrotliEncoderParams {
      quality: quality as i32,
      ..Default::default()
    }
  }

  #[test]
  fn test_gzip_roundtrip() {
    let input = b"Hello, world! This is a test of gzip compression.";
    let compressed = Algorithm::Gzip.compress(input, 6, &bp(6)).unwrap();
    assert!(!compressed.is_empty());

    use flate2::read::GzDecoder;
    use std::io::Read;
    let mut decoder = GzDecoder::new(&compressed[..]);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).unwrap();
    assert_eq!(decompressed, input);
  }

  #[test]
  fn test_brotli_roundtrip() {
    let input = b"Hello, world! This is a test of brotli compression.";
    let compressed = Algorithm::Brotli.compress(input, 6, &bp(6)).unwrap();

    let mut decompressed = Vec::new();
    brotli::BrotliDecompress(&mut Cursor::new(&compressed), &mut decompressed).unwrap();
    assert_eq!(decompressed, input);
  }

  #[test]
  fn test_deflate_roundtrip() {
    let input = b"Hello, world! This is a test of deflate compression.";
    let compressed = Algorithm::Deflate.compress(input, 6, &bp(6)).unwrap();

    use flate2::read::ZlibDecoder;
    use std::io::Read;
    let mut decoder = ZlibDecoder::new(&compressed[..]);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).unwrap();
    assert_eq!(decompressed, input);
  }

  #[test]
  fn test_deflate_raw_roundtrip() {
    let input = b"Hello, world! This is a test of raw deflate compression.";
    let compressed = Algorithm::DeflateRaw.compress(input, 6, &bp(6)).unwrap();

    use flate2::read::DeflateDecoder;
    use std::io::Read;
    let mut decoder = DeflateDecoder::new(&compressed[..]);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).unwrap();
    assert_eq!(decompressed, input);
  }

  #[test]
  fn test_gzip_levels_produce_different_output() {
    let input = b"Hello world! ".repeat(100);
    let fast = Algorithm::Gzip.compress(&input, 1, &bp(1)).unwrap();
    let best = Algorithm::Gzip.compress(&input, 9, &bp(9)).unwrap();
    assert!(best.len() <= fast.len());
  }

  #[test]
  fn test_brotli_levels_produce_different_output() {
    let input = b"Hello world! ".repeat(100);
    let fast = Algorithm::Brotli.compress(&input, 1, &bp(1)).unwrap();
    let best = Algorithm::Brotli.compress(&input, 11, &bp(11)).unwrap();
    assert!(best.len() <= fast.len());
  }

  #[test]
  fn test_resolve_algorithm() {
    assert!(resolve_algorithm("gzip").is_ok());
    assert!(resolve_algorithm("brotli").is_ok());
    assert!(resolve_algorithm("brotliCompress").is_ok());
    assert!(resolve_algorithm("deflate").is_ok());
    assert!(resolve_algorithm("deflateRaw").is_ok());
  }

  #[test]
  fn test_resolve_unknown_algorithm() {
    let result = resolve_algorithm("lzma");
    assert!(result.is_err());
    assert!(result
      .unwrap_err()
      .to_string()
      .contains("unsupported algorithm"));
  }

  #[test]
  fn test_validate_level_rejects_out_of_range() {
    assert!(validate_level("gzip", 10).is_err());
    assert!(validate_level("deflate", 10).is_err());
    assert!(validate_level("brotliCompress", 12).is_err());
    assert!(validate_level("gzip", 9).is_ok());
    assert!(validate_level("brotliCompress", 11).is_ok());
  }
}
