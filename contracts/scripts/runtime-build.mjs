import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  root,
  output,
  gcc,
  wasm2c,
  wabtRoot,
  run,
  hash,
} from "./runtime-tools.mjs";
process.chdir(root);
mkdirSync(output, { recursive: true });
const versions = {
  node: process.version,
  assemblyscript: run(process.execPath, [
    "node_modules/assemblyscript/bin/asc.js",
    "--version",
  ]).stdout.trim(),
  wabt: run(wasm2c, ["--version"]).stdout.trim(),
  gcc: run(gcc, ["--version"]).stdout.split("\n")[0],
};
run(
  process.execPath,
  [
    "node_modules/assemblyscript/bin/asc.js",
    "runtime-lab/fib.ts",
    "--outFile",
    "build/runtime-lab/fib.wasm",
    "--textFile",
    "build/runtime-lab/fib.wat",
    "--optimizeLevel",
    "3",
    "--runtime",
    "stub",
  ],
  { log: "assemblyscript.json" },
);
const module = new WebAssembly.Module(
  readFileSync("build/runtime-lab/fib.wasm"),
);
const imports = WebAssembly.Module.imports(module);
if (
  imports.length !== 1 ||
  imports[0].module !== "env" ||
  imports[0].name !== "abort"
)
  throw Error("Unexpected WASM imports; review runtime bindings");
run(
  wasm2c,
  [
    "build/runtime-lab/fib.wasm",
    "-o",
    "build/runtime-lab/fib.c",
    "--module-name",
    "fib",
  ],
  { log: "wasm2c.json" },
);
const common = [
  "-march=rv64imc",
  "-mabi=lp64",
  "-mcmodel=medany",
  "-std=c99",
  "-g",
  "-ffunction-sections",
  "-fdata-sections",
  "-nostartfiles",
  "-Wl,--gc-sections",
  "-Wl,-T,runtime-lab/link.ld",
  "runtime-lab/start.S",
];
const fib = [
  ...common,
  "-O2",
  "-DNDEBUG",
  "-DWASM_RT_USE_MMAP=0",
  "-DWASM_RT_NONCONFORMING_UNCHECKED_STACK_EXHAUSTION=1",
  "-I" + join(wabtRoot, "include"),
  "-Ibuild/runtime-lab",
  "runtime-lab/main.c",
  "runtime-lab/runtime.c",
  "build/runtime-lab/fib.c",
  "-lc",
  "-lgcc",
];
const missing = run(
  gcc,
  [
    ...fib,
    "-DOMIT_ABORT_BINDING",
    "-o",
    "build/runtime-lab/fib-missing-binding",
  ],
  { allowFailure: true, log: "missing-binding.json" },
);
if (missing.status === 0 || !missing.stderr.includes("w2c_env_abort"))
  throw Error("Controlled missing-import experiment did not fail as expected");
run(gcc, [...fib, "-o", "build/runtime-lab/fib"], { log: "riscv-build.json" });
for (const variant of ["bug", "fixed"])
  run(
    gcc,
    [
      ...common,
      "-O0",
      ...(variant === "bug" ? ["-DCARROT_BUG"] : []),
      "runtime-lab/carrot.c",
      "-lc",
      "-lgcc",
      "-o",
      `build/runtime-lab/carrot-${variant}`,
    ],
    { log: `carrot-${variant}-build.json` },
  );
const artifacts = Object.fromEntries(
  [
    "runtime-lab/fib.ts",
    "runtime-lab/main.c",
    "runtime-lab/runtime.c",
    "runtime-lab/start.S",
    "runtime-lab/link.ld",
    "runtime-lab/carrot.c",
    "build/runtime-lab/fib.wasm",
    "build/runtime-lab/fib.c",
    "build/runtime-lab/fib.h",
    "build/runtime-lab/fib",
    "build/runtime-lab/carrot-bug",
    "build/runtime-lab/carrot-fixed",
  ].map((p) => [p, hash(p)]),
);
writeFileSync(
  join(output, "manifest.json"),
  JSON.stringify(
    {
      versions,
      provenance: JSON.parse(
        readFileSync("runtime-lab/toolchain.json", "utf8"),
      ),
      imports,
      artifacts,
      scope:
        "Local runtime experiment; no deployment or transaction commitment",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Built WASM, generated C, RISC-V and debug-symbol carrot variants; hashes in build/runtime-lab/manifest.json",
);
