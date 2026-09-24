// Shifted Fibonacci as used by the CKB course: fib(5)=8, fib(10)=89.
export function fib(n: i32): i32 {
  let previous: i32 = 0;
  let current: i32 = 1;
  for (let step: i32 = 0; step < n; step++) {
    const next = previous + current;
    previous = current;
    current = next;
  }
  return current;
}

// Keep an explicit env.abort import so the binding exercise is reproducible.
export function checkedFib(n: i32): i32 {
  assert(n >= 0 && n <= 10, "Expected input in [0, 10]");
  return fib(n);
}
