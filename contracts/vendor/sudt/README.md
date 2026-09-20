# sUDT reference and executable

`simple_udt` is the unmodified sUDT executable bundled with `@offckb/cli@0.4.12`.
SHA-256: `b1a962cb43d88e777d9df0aa4e67270ee758d9abdd18b1c56b106a5eed149af9`.
The metadata export verifies its CKB data hash against the live Devnet dependency.

`simple_udt.c` is reference source from [ckb-production-scripts at e570c11](https://github.com/nervosnetwork/ckb-production-scripts/blob/e570c11aff3eca12a47237c21598429088c610d5/c/simple_udt.c).
The pinned upstream tree does not contain a top-level LICENSE/COPYING file; no new license is asserted here.
The executable's byte-for-byte correspondence to a build of this source has **not** been established.

Reproduce the lab artifact with `npm run week6:build` in `contracts`: this verifies and stages the pinned executable, without a compiler or network.
For a source build, clone the linked repository, checkout the exact commit, initialize its submodules and follow its Makefile/README with the required RISC-V toolchain. Docker was unavailable on the implementation host, so source compilation is not recorded as verified.
