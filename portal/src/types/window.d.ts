export {};

declare global {
 interface Window {
  __openCccWallet?: () => void;
 }
}