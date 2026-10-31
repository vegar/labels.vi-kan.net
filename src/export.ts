import { strToU8, zipSync } from "fflate";
import type { Manifold } from "manifold-3d";
import { bounds, footprint, packPlates, plateCount, type Bed } from "./bed";

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

/** One printable object: a label made of several coloured parts. */
export interface ExportObject {
  name: string;
  parts: ExportPart[];
}

/**
 * Filament slot (1-based) for each part: the first part gets slot 1 and every
 * further distinct colour gets the next slot, so same-coloured parts share one,
 * across all objects.
 */
function filamentSlots(objects: ExportObject[]): number[][] {
  const slots = new Map<string, number>();
  return objects.map((o) =>
    o.parts.map((p) => {
      const key = p.color.toLowerCase();
      if (!slots.has(key)) slots.set(key, slots.size + 1);
      return slots.get(key)!;
    }),
  );
}

/**
 * Which plate each object goes on and where, as a translation on that plate:
 * packed onto as many plates as the bed needs (see packPlates).
 */
export function plateLayout(objects: ExportObject[], bed: Bed): { plate: number; offset: [number, number, number] }[] {
  const boxes = objects.map((o) => bounds(o.parts.map((p) => p.manifold)));
  return packPlates(boxes.map(footprint), bed).map((p, i) => {
    const b = boxes[i];
    return { plate: p.plate, offset: [p.x - (b.min[0] + b.max[0]) / 2, p.y - (b.min[1] + b.max[1]) / 2, -b.min[2]] };
  });
}

/**
 * Bambu Studio / OrcaSlicer per-part settings. They ignore core-spec material
 * colours, but read this file even from 3MFs they did not write, and keep the
 * part names and filament ("extruder") assignments from it. Object ids are the
 * assembly ids and part ids are the component object ids.
 */
function bambuModelSettings(
  objects: ExportObject[],
  ids: { assembly: number; parts: number[] }[],
  slots: number[][],
): string {
  const body = objects
    .map((o, i) => {
      const volumes = o.parts
        .map(
          (p, j) => `  <part id="${ids[i].parts[j]}" subtype="normal_part">
    <metadata key="name" value="${escapeXml(p.name)}"/>
    <metadata key="extruder" value="${slots[i][j]}"/>
  </part>`,
        )
        .join("\n");
      return ` <object id="${ids[i].assembly}">
  <metadata key="name" value="${escapeXml(o.name)}"/>
  <metadata key="extruder" value="1"/>
${volumes}
 </object>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
${body}
</config>`;
}

/**
 * Build a core-spec 3MF holding one object per label, laid out on one plate.
 * Each object is made of several parts, each with its own colour, so slicers
 * open it with one part per colour; Bambu Studio and OrcaSlicer also get each
 * colour on its own filament slot, shared across all labels.
 */
export function to3mf(title: string, objects: ExportObject[], bed: Bed): Uint8Array {
  const layout = plateLayout(objects, bed);
  return model3mf(
    title,
    objects,
    layout.map((l) => l.offset),
    filamentSlots(objects),
  );
}

/** A file to download. */
export interface Download {
  filename: string;
  data: Uint8Array;
  type: string;
}

/**
 * The labels as one 3MF, or, when they need more than one plate, a zip with a
 * 3MF per plate. Slicers centre a 3MF that isn't their own project on the
 * plate as a whole, so plates can't share a file. Filament slots are numbered
 * across all labels, so a colour has the same slot in every file.
 */
export function export3mf(title: string, objects: ExportObject[], bed: Bed): Download {
  const layout = plateLayout(objects, bed);
  const slots = filamentSlots(objects);
  const plates = plateCount(layout);
  const plate = (n: number) => {
    const on = layout.flatMap((l, i) => (l.plate === n ? [i] : []));
    return model3mf(
      plates === 1 ? title : `${title} plate ${n + 1}`,
      on.map((i) => objects[i]),
      on.map((i) => layout[i].offset),
      on.map((i) => slots[i]),
    );
  };
  if (plates === 1) return { filename: `${title}.3mf`, data: plate(0), type: "model/3mf" };
  const files: Record<string, Uint8Array> = {};
  for (let n = 0; n < plates; n++) files[`${title}-plate-${n + 1}.3mf`] = plate(n);
  // 3MFs are zips already; storing them again saves time and gains nothing.
  return { filename: `${title}-${plates}-plates.zip`, data: zipSync(files, { level: 0 }), type: "application/zip" };
}

function model3mf(
  title: string,
  objects: ExportObject[],
  offsets: [number, number, number][],
  slots: number[][],
): Uint8Array {
  const allParts = objects.flatMap((o) => o.parts);
  const materials = allParts
    .map((p) => `<base name="${escapeXml(p.name)}" displaycolor="${p.color.toUpperCase()}FF"/>`)
    .join("");

  // Id 1 is the material group; then each object's parts, then its assembly.
  let nextId = 2;
  let pindex = 0;
  const ids: { assembly: number; parts: number[] }[] = [];
  const resources: string[] = [];
  for (const o of objects) {
    const partIds = o.parts.map((p) => {
      const id = nextId++;
      resources.push(
        `<object id="${id}" name="${escapeXml(p.name)}" type="model" pid="1" pindex="${pindex++}">${meshXml(p.manifold)}</object>`,
      );
      return id;
    });
    const assembly = nextId++;
    const components = partIds.map((id) => `<component objectid="${id}"/>`).join("");
    resources.push(
      `<object id="${assembly}" name="${escapeXml(o.name)}" type="model"><components>${components}</components></object>`,
    );
    ids.push({ assembly, parts: partIds });
  }

  const items = ids
    .map(({ assembly }, i) => {
      const [x, y, z] = offsets[i].map((c) => c.toFixed(4));
      return `<item objectid="${assembly}" transform="1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}"/>`;
    })
    .join("");

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${escapeXml(title)}</metadata>
<metadata name="Application">labels.vi-kan.net</metadata>
<resources><basematerials id="1">${materials}</basematerials>${resources.join("")}</resources>
<build>${items}</build>
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
    "Metadata/model_settings.config": strToU8(bambuModelSettings(objects, ids, slots)),
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

/** One STL per part, in a folder per object, zipped, for slicers or workflows that prefer STL. */
export function toStlZip(objects: ExportObject[]): Uint8Array {
  const used = new Set<string>();
  const files: Record<string, Uint8Array> = {};
  for (const o of objects) {
    // Labels with the same text would share a folder; number the repeats.
    let folder = o.name;
    for (let n = 2; used.has(folder); n++) folder = `${o.name}-${n}`;
    used.add(folder);
    for (const p of o.parts) files[`${folder}/${p.name}.stl`] = toStl(p.manifold);
  }
  return zipSync(files);
}
