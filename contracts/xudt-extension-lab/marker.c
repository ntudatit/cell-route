/* Local-only teaching rule, adapted from the pinned official extension_script_0.c.
 * No signature, secrecy or governance claim: the marker is public and copyable.
 * ABI: ckb-production-scripts abdcb117... tests/xudt_rce/extension_script_0.c.
 */
#include "ckb_syscalls.h"
#include "xudt_rce_mol.h"

#define BAD_ARGS 91
#define MISSING_WITNESS 92
#define BAD_SCHEMA 93
#define BAD_MARKER 94

__attribute__((visibility("default")))
int validate(int is_owner_mode, size_t extension_index,
             const uint8_t *args, size_t args_len) {
  if (args_len != 1) return BAD_ARGS;
  ckb_debug(is_owner_mode ? "marker:owner" : "marker:normal");
  uint8_t witness[4096];
  uint64_t len = sizeof(witness);
  int output = 0;
  int ret = ckb_load_witness(witness, &len, 0, 0, CKB_SOURCE_GROUP_INPUT);
  if (ret == CKB_INDEX_OUT_OF_BOUND) {
    output = 1;
    len = sizeof(witness);
    ret = ckb_load_witness(witness, &len, 0, 0, CKB_SOURCE_GROUP_OUTPUT);
  }
  if (ret != CKB_SUCCESS) return MISSING_WITNESS;
  if (len == 0) return MISSING_WITNESS;
  if (len > sizeof(witness)) return BAD_SCHEMA;
  mol_seg_t w = {witness, (mol_num_t)len};
  if (MolReader_WitnessArgs_verify(&w, false) != MOL_OK) return BAD_SCHEMA;
  mol_seg_t opt = output ? MolReader_WitnessArgs_get_output_type(&w)
                        : MolReader_WitnessArgs_get_input_type(&w);
  if (MolReader_BytesOpt_is_none(&opt)) return MISSING_WITNESS;
  mol_seg_t payload = MolReader_Bytes_raw_bytes(&opt);
  if (MolReader_XudtWitnessInput_verify(&payload, false) != MOL_OK)
    return BAD_SCHEMA;
  mol_seg_t entries = MolReader_XudtWitnessInput_get_extension_data(&payload);
  /* This lab requires exactly one data entry per configured extension. */
  if (MolReader_BytesVec_length(&entries) != extension_index + 1)
    return BAD_SCHEMA;
  mol_seg_res_t item = MolReader_BytesVec_get(&entries, extension_index);
  if (item.errno != MOL_OK) return BAD_SCHEMA;
  mol_seg_t marker = MolReader_Bytes_raw_bytes(&item.seg);
  if (marker.size != 1 || marker.ptr[0] != args[0]) return BAD_MARKER;
  return 0;
}

/* Deliberately permissive standalone lock entry, solely to exercise xUDT's
 * already-validated-input-lock shortcut. Never use this artifact to protect funds. */
__attribute__((visibility("default"), noreturn)) void _start(void) {
  ckb_exit(0);
  __builtin_unreachable();
}
