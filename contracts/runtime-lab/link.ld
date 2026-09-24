ENTRY(_start)
SECTIONS {
  . = 0x10000;
  .text : { *(.text.entry) *(.text*) }
  . = ALIGN(4096);
  .rodata : { *(.rodata*) }
  . = ALIGN(4096);
  .data : { *(.data*) }
  .sdata : { __global_pointer$ = . + 0x800; *(.sdata*) }
  .bss : { *(.sbss*) *(.bss*) *(COMMON) }
  . = ALIGN(16);
  _end = .;
}
