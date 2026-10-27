import Module, { type ManifoldToplevel } from "manifold-3d";

let instance: Promise<ManifoldToplevel> | undefined;

/**
 * Load the manifold-3d WASM module once. `wasmUrl` is only needed in the
 * browser, where the bundler decides where the .wasm file ends up.
 */
export function loadManifold(wasmUrl?: string): Promise<ManifoldToplevel> {
  instance ??= Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined).then(
    (wasm) => {
      wasm.setup();
      return wasm;
    },
  );
  return instance;
}
