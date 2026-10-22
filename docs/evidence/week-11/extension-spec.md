# Marker extension specification

Status: implemented, local-only. Source: [marker.c](../../../contracts/xudt-extension-lab/marker.c).

- ABI: exported `validate(int, size_t, const uint8_t*, size_t)` from the pinned official extension example.
- Profile: one inline or witness-hashed extension; args = one expected marker byte.
- Witness: first group input WitnessArgs.input_type, or first group output WitnessArgs.output_type for output-only mint. Parse pinned XudtWitnessInput; require one extension_data Bytes entry containing the expected byte.
- Maximum witness read: 4096 bytes. No unbounded allocation or provider request.
- Extension exits: 91 bad args, 92 missing witness, 93 invalid extension schema, 94 incorrect marker, 0 success. xUDT may reject malformed witnesses before invoking the extension (observed exit 7).
- The rule applies when validate is called. Owner mode still calls it in tested normal-extension routes, but the input-lock shortcut can skip it.
- A standalone permissive lock entry exists to demonstrate that shortcut. It is not an authorization policy. The marker, enhanced-owner fixture and all lock stubs are unsafe for custody.
- No signature validation, secret proof, governance guarantee, deployment, wallet signing or node commitment is claimed.

Reproduce and inspect the actual cases through [mode-matrix.md](mode-matrix.md). Full interface, source pins and integration decision: [project guide](../../xudt-extension-lab.md).
