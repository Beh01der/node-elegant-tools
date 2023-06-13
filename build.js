import { build } from "esbuild";
import dts from "npm-dts";

new dts.Generator({
  entry: "src/index.ts",
  output: "dist/index.d.ts",
}).generate();

build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  platform: "node",
  target: "es2020",
  bundle: true,
});
