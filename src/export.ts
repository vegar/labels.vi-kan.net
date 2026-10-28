import { strToU8, zipSync } from "fflate";
import type { Manifold } from "manifold-3d";

export interface ExportPart {
  name: string;
  manifold: Manifold;
  /** CSS hex colour, e.g. "#1e1e1e". */
  color: string;
}

function meshXml(manifold: Manifold): string {
  const mesh = manifold.getMesh();
  const { vertProperties: v, triVerts: t, numProp } = mesh;
  const out: string[] = ["<mesh><vertices>"];
  for (let i = 0; i < v.length; i += numProp) {
    out.push(`<vertex x="${v[i].toFixed(4)}" y="${v[i + 1].toFixed(4)}" z="${v[i + 2].toFixed(4)}"/>`);
  }
  out.push("</vertices><triangles>");
  for (let i = 0; i < t.length; i += 3) {
    out.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
  }
  out.push("</triangles></mesh>");
  return out.join("");
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Filament slot (1-based) for each part: the first part gets slot 1 and every
 * further distinct colour gets the next slot, so same-coloured parts share one.
 */
function filamentSlots(parts: ExportPart[]): number[] {
  const slots = new Map<string, number>();
  return parts.map((p) => {
    const key = p.color.toLowerCase();
    if (!slots.has(key)) slots.set(key, slots.size + 1);
    return slots.get(key)!;
  });
}

/**
 * Bambu Studio / OrcaSlicer per-part settings. They ignore core-spec material
 * colours, but read this file even from 3MFs they did not write, and keep the
 * part names and filament ("extruder") assignments from it. Part ids are the
 * component object ids.
 */
function bambuModelSettings(assemblyId: number, name: string, parts: ExportPart[]): string {
  const slots = filamentSlots(parts);
  const volumes = parts
    .map(
      (p, i) => `  <part id="${i + 2}" subtype="normal_part">
    <metadata key="name" value="${escapeXml(p.name)}"/>
    <metadata key="extruder" value="${slots[i]}"/>
  </part>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
 <object id="${assemblyId}">
  <metadata key="name" value="${escapeXml(name)}"/>
  <metadata key="extruder" value="1"/>
${volumes}
 </object>
</config>`;
}

/**
 * Build a core-spec 3MF holding one object made of several parts, each with
 * its own colour. Slicers open it as a single object with one part per
 * colour; Bambu Studio and OrcaSlicer also get each colour on its own
 * filament slot.
 */
export function to3mf(name: string, parts: ExportPart[]): Uint8Array {
  const materials = parts
    .map((p) => `<base name="${escapeXml(p.name)}" displaycolor="${p.color.toUpperCase()}FF"/>`)
    .join("");
  const objects = parts
    .map(
      (p, i) =>
        `<object id="${i + 2}" name="${escapeXml(p.name)}" type="model" pid="1" pindex="${i}">${meshXml(p.manifold)}</object>`,
    )
    .join("");
  const assemblyId = parts.length + 2;
  const components = parts.map((_, i) => `<component objectid="${i + 2}"/>`).join("");

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${escapeXml(name)}</metadata>
<metadata name="Application">labels.vi-kan.net</metadata>
<resources><basematerials id="1">${materials}</basematerials>${objects}<object id="${assemblyId}" name="${escapeXml(name)}" type="model"><components>${components}</components></object></resources>
<build><item objectid="${assemblyId}"/></build>
</model>`;

  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`),
    "3D/3dmodel.model": strToU8(model),
    "Metadata/model_settings.config": strToU8(bambuModelSettings(assemblyId, name, parts)),
  });
}

/** Binary STL of a single solid. */
export function toStl(manifold: Manifold): Uint8Array {
  const { vertProperties: v, triVerts: t, numProp } = manifold.getMesh();
  const count = t.length / 3;
  const buf = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buf);
  view.setUint32(80, count, true);
  let off = 84;
  for (let i = 0; i < t.length; i += 3) {
    const p = [t[i], t[i + 1], t[i + 2]].map((k) => [v[k * numProp], v[k * numProp + 1], v[k * numProp + 2]]);
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
    const w = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const c of n) {
      view.setFloat32(off, c / len, true);
      off += 4;
    }
    for (const pt of p) {
      for (const c of pt) {
        view.setFloat32(off, c, true);
        off += 4;
      }
    }
    off += 2;
  }
  return new Uint8Array(buf);
}

/** One STL per part, zipped, for slicers or workflows that prefer STL. */
export function toStlZip(parts: ExportPart[]): Uint8Array {
  return zipSync(Object.fromEntries(parts.map((p) => [`${p.name}.stl`, toStl(p.manifold)])));
}
