// Adapted from Class 5: reject outputs beginning with "carrot".
// Compile with CARROT_BUG to deliberately reverse the memcmp condition.
#include <stdint.h>
#include <stddef.h>
#include <string.h>

static int load_output(void *buffer, uint64_t *len, size_t index) {
  register long a0 __asm__("a0") = (long)buffer;
  register long a1 __asm__("a1") = (long)len;
  register long a2 __asm__("a2") = 0;
  register long a3 __asm__("a3") = index;
  register long a4 __asm__("a4") = 2; // CKB_SOURCE_OUTPUT
  register long a7 __asm__("a7") = 2092; // ckb_load_cell_data
  __asm__ volatile("ecall" : "+r"(a0) : "r"(a1), "r"(a2), "r"(a3), "r"(a4), "r"(a7) : "memory");
  return (int)a0;
}

int main(void) {
  for (size_t index = 0; ; index++) {
    uint64_t len = 6;
    unsigned char buffer[6] = {0};
    int ret = load_output(buffer, &len, index);
    if (ret == 1) break; // CKB_INDEX_OUT_OF_BOUND
    if (ret != 0) return -2;
    int cmp = memcmp(buffer, "carrot", 6);
    // GDB_BREAKPOINT: inspect cmp, len and buffer before the decision.
#ifdef CARROT_BUG
    if (cmp) return -1;
#else
    if (len >= 6 && cmp == 0) return -1;
#endif
  }
  return 0;
}
