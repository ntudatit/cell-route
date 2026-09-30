#include "wasm-rt.h"
// Verify all bytes on first allocation AND after free/reallocation.
int main(void) {
  wasm_rt_memory_t mem;
  wasm_rt_init();
  for (int pass = 0; pass < 2; ++pass) {
    wasm_rt_allocate_memory(&mem, 1, 1, false, 65536);
    for (unsigned i = 0; i < 65536; ++i) {
      if (mem.data[i] != 0) return 72;
      mem.data[i] = 0xa5;
    }
    wasm_rt_free_memory(&mem);
    wasm_rt_free();
    wasm_rt_init();
  }
  return 0;
}
