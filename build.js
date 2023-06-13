const esbuild = require("esbuild");
const dts = require("npm-dts");

new dts.Generator({
  entry: "src/index.ts",
  output: "dist/index.d.ts",
}).generate();

esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  platform: "node",
  target: "es2020",
  bundle: true,
});
