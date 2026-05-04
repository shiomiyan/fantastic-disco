import { readFileSync, writeFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const targetVersion = packageJson.version;

if (typeof targetVersion !== "string" || targetVersion.length === 0) {
	throw new Error("package.json version must be a non-empty string");
}

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, "\t")}\n`);

// update versions.json with target version and minAppVersion from manifest.json
// but only write the file if the target version mapping changed
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
if (versions[targetVersion] !== minAppVersion) {
	versions[targetVersion] = minAppVersion;
	writeFileSync("versions.json", `${JSON.stringify(versions, null, "\t")}\n`);
}
