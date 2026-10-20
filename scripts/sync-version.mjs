import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageFile = path.join(projectDir, "package.json");
const manifestFile = path.join(projectDir, "manifest.xml");
const readmeFile = path.join(projectDir, "README.md");
const packageInfo = JSON.parse(await fs.readFile(packageFile, "utf8"));
const version = String(packageInfo.version || "");

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Expected package.json version in major.minor.patch form; received: ${version}`);
}

const manifest = await fs.readFile(manifestFile, "utf8");
const updatedManifest = manifest.replace(/<Version>[^<]+<\/Version>/, `<Version>${version}.0</Version>`);
if (updatedManifest === manifest && !manifest.includes(`<Version>${version}.0</Version>`)) {
  throw new Error("Could not find the Outlook manifest version element.");
}
if (updatedManifest !== manifest) await fs.writeFile(manifestFile, updatedManifest);

const readme = await fs.readFile(readmeFile, "utf8");
const updatedReadme = readme.replace(/^# MailCue(?: \d+\.\d+)?$/m, "# MailCue");
if (updatedReadme !== readme) await fs.writeFile(readmeFile, updatedReadme);

console.log(`Synchronized manifest.xml to MailCue ${version}.0; package.json is the canonical version source.`);
