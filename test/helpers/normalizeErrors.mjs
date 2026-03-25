const HASH_RE = /[a-f0-9]{16,}/g;

function removeCWD(str) {
  const isWin = process.platform === "win32";
  let cwd = process.cwd();

  if (isWin) {
    str = str.replaceAll("\\", "/");
    cwd = cwd.replaceAll("\\", "/");
  }

  return str.replaceAll(new RegExp(cwd, "g"), "");
}

export default function normalizeErrors(errors) {
  return errors.map((error) =>
    removeCWD(error.toString().split("\n").slice(0, 2).join("\n")).replace(HASH_RE, "[hash]"),
  );
}
