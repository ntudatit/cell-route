# Deployment records

`simple-lock.devnet.json` is the verified public metadata consumed by the portal. `scripts.json` is OffCKB's bytecode deployment record. `week5-evidence.json` records a funded Cell, expected node rejections, and a committed unlock. The `devnet/` directory contains OffCKB migration records. None of these files contains signing material.

Run `npm run export:metadata` from the contract directory after deployment. See `../README.md` for the complete workflow.
