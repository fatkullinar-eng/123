import fs from "node:fs";
const text = fs.readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");
const front = text.split("---")[1];
let section = "",
  font = "";
const lines = [];
for (const line of front.split("\n")) {
  if (/^[a-z]+:/.test(line)) {
    section = line.split(":")[0];
    font = "";
  }
  const match = line.match(/^  ([\w-]+): ['"]([^'"]+)['"]/);
  if (match && ["colors", "rounded", "spacing"].includes(section)) {
    const prefix = { colors: "color", rounded: "radius", spacing: "space" }[
      section
    ];
    lines.push(`  --${prefix}-${match[1]}: ${match[2]};`);
  }
  const family = line.match(/^  (\w+):$/);
  if (section === "typography" && family) font = family[1];
  const value = line.match(/^    fontFamily: ['"]([^'"]+)['"]/);
  if (section === "typography" && value)
    lines.push(`  --font-${font}: ${value[1]};`);
}
const output = `/* Generated from DESIGN.md. Run node scripts/tokens.mjs. */\n:root {\n${lines.join("\n")}\n}\n`;
const target = new URL("../src/tokens.css", import.meta.url);
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== output)
    throw new Error("Token drift: regenerate tokens");
} else fs.writeFileSync(target, output);
