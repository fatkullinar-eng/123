const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { getMakeNsisPath } = require("app-builder-lib/out/toolsets/windows");

(async () => {
  const projectDir = path.resolve(__dirname, "..");
  const { version } = JSON.parse(
    fs.readFileSync(path.join(projectDir, "package.json"), "utf8"),
  );
  const tool = await getMakeNsisPath(); // Official electron-builder download with its pinned checksums.
  const source = fs.readFileSync(
    path.join(projectDir, "build", "installer.nsi"),
    "utf8",
  );
  const generated = path.join(projectDir, "build", "installer.generated.nsi");
  fs.writeFileSync(generated, "\uFEFF" + source); // Preserve Russian installer strings in NSIS.
  const result = spawnSync(
    tool.path,
    ["-V3", `-DPROJECT_DIR=${projectDir}`, `-DVERSION=${version}`, generated],
    { stdio: "inherit", env: { ...process.env, ...tool.env } },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
