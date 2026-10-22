# RGB++ read-only asset inspector

Open `/rgbpp` and supply a CKB OutPoint or Bitcoin txid/vout on the selected network pair. The portal contains no sample-data or offline-example mode.

See [Live Labs](live-labs.md) for configuration, supported lookups and evidence boundaries. Full RGB++ SPV validation and signed cross-chain transfers are not implemented.

Protocol regression vectors and their checker are isolated under `portal/tests/rgbpp/`, outside the live application. The `rgbpp:evidence` and `rgbpp:verify-source` commands are test/evidence tools; they do not populate the portal. Historical Week 10 screenshots describe an earlier UI.
