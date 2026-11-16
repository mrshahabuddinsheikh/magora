import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, resample, textureCompress, meshopt, getBounds } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

/**
 * Shrinks an uploaded 3D model so product pages stay fast:
 * duplicate data removed, textures resized to ≤1024px WebP, geometry
 * meshopt-compressed. A typical 5–10 MB model ends up around 0.5–1.5 MB.
 */
export async function optimizeGlb(input: Buffer) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const deps: Record<string, unknown> = { "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder };
  try {
    const draco = await import("draco3dgltf");
    deps["draco3d.decoder"] = await draco.default.createDecoderModule();
  } catch {
    /* Draco-compressed inputs just won't be readable */
  }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies(deps);
  const doc = await io.readBinary(new Uint8Array(input));
  const steps = [dedup(), prune(), weld(), resample()];
  try {
    const sharp = (await import("sharp")).default;
    steps.push(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }));
  } catch {
    /* sharp missing → keep textures as they are */
  }
  await doc.transform(...steps, meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const b = scene ? getBounds(scene) : null;
  const out = Buffer.from(await io.writeBinary(doc));
  const size = b ? b.max.map((v, i) => +(v - b.min[i]).toFixed(4)) : null;
  return { out, size };
}
