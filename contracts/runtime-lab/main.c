#include "fib.h"
extern void lab_exit(int code) __attribute__((noreturn));
struct w2c_env { int unused; };
#ifndef OMIT_ABORT_BINDING
void w2c_env_abort(struct w2c_env *env, u32 message, u32 file, u32 line, u32 column) {
  (void)env; (void)message; (void)file; (void)line; (void)column;
  lab_exit(72);
}
#endif
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  // Bound the example to avoid ambiguity between an i32 result and exit i8.
  unsigned n = 0;
  if (!argv[1][0]) return 2;
  for (const char *s = argv[1]; *s; s++) {
    if (*s < '0' || *s > '9' || n > 10) return 2;
    n = n * 10 + (unsigned)(*s - '0');
  }
  if (n > 10) return 2;
  struct w2c_env env = {0};
  w2c_fib instance;
  wasm_rt_init();
  wasm2c_fib_instantiate(&instance, &env);
  unsigned value = w2c_fib_checkedFib(&instance, n);
  wasm2c_fib_free(&instance);
  wasm_rt_free();
  return (int)value;
}
