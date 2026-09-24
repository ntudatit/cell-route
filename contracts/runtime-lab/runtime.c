// Minimal wasm2c runtime adapter ONLY for this single-memory Fibonacci module.
// One fixed page, no grow, tables, threads, WASI or general allocator.
#include "wasm-rt.h"
#include <string.h>
static unsigned char memory[65536];
static bool initialized;
__attribute__((noreturn)) void lab_exit(int code) {
  register long a0 __asm__("a0") = code;
  register long a7 __asm__("a7") = 93;
  __asm__ volatile("ecall" : : "r"(a0), "r"(a7) : "memory");
  __builtin_unreachable();
}
void wasm_rt_init(void) { initialized = true; }
bool wasm_rt_is_initialized(void) { return initialized; }
void wasm_rt_free(void) { initialized = false; }
void wasm_rt_trap(wasm_rt_trap_t code) { (void)code; lab_exit(70); }
void wasm_rt_allocate_memory(wasm_rt_memory_t *mem, uint64_t initial,
                            uint64_t maximum, bool is64, uint32_t page_size) {
  if (initial != 1 || is64 || page_size != sizeof(memory)) lab_exit(71);
  memset(memory, 0, sizeof(memory));
  mem->data = memory; mem->data_end = memory + sizeof(memory);
  mem->pages = initial; mem->max_pages = maximum;
  mem->size = sizeof(memory); mem->is64 = false; mem->page_size = page_size;
}
void wasm_rt_free_memory(wasm_rt_memory_t *mem) { mem->data = 0; }
