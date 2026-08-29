import { describe, expect, it } from "vitest";
import { validateBrowserPeerConnection } from "./runtime";

describe("validateBrowserPeerConnection", () => {
  it("accepts a browser-reachable WSS multi-address", () => {
    expect(validateBrowserPeerConnection({
      address: "/dns4/router.example/tcp/443/wss/p2p/QmExamplePeer",
    })).toEqual({
      address: "/dns4/router.example/tcp/443/wss/p2p/QmExamplePeer",
      pubkey: undefined,
    });
  });

  it("rejects a raw TCP address in a browser node", () => {
    expect(() => validateBrowserPeerConnection({
      address: "/ip4/127.0.0.1/tcp/8228/p2p/QmExamplePeer",
    })).toThrow(/\/ws or \/wss/);
  });

  it("accepts and normalizes a compressed Fiber pubkey", () => {
    const pubkey = `02${"ab".repeat(32)}`;
    expect(validateBrowserPeerConnection({ pubkey: `0x${pubkey}` })).toEqual({
      address: undefined,
      pubkey,
    });
  });

  it("does not confuse a libp2p peer ID with a Fiber pubkey", () => {
    expect(() => validateBrowserPeerConnection({ pubkey: "QmExamplePeer" })).toThrow(/compressed 33-byte key/);
  });
});
