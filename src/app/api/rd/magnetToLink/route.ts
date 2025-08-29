import { NextRequest, NextResponse } from "next/server";

type RDFile = { id: number; bytes: number; path: string };
type RDInfo = {
  status?: string;
  filename?: string;
  files?: RDFile[];
  links?: string[];
};

const VIDEO_RE = /\.(mp4|m4v|mov|webm|avi|ts)$/i;
const BAD_NAME_RE = /(sample|trailer|extras?)/i;

function extOf(path: string) {
  const p = path.toLowerCase();
  const i = p.lastIndexOf(".");
  return i === -1 ? "" : p.slice(i + 1);
}

function pickByExt(
  files: RDFile[],
  {
    allowedExts,
    disallowExts = ["mkv"],
    excludeSamples = true,
  }: { allowedExts?: string[]; disallowExts?: string[]; excludeSamples?: boolean }
) {
  let vids = files.filter((f) => VIDEO_RE.test(f.path));
  if (excludeSamples) vids = vids.filter((f) => !BAD_NAME_RE.test(f.path));

  if (allowedExts?.length) {
    const allow = new Set(allowedExts.map((e) => e.toLowerCase()));
    vids = vids.filter((f) => allow.has(extOf(f.path)));
  } else if (disallowExts?.length) {
    const deny = new Set(disallowExts.map((e) => e.toLowerCase()));
    vids = vids.filter((f) => !deny.has(extOf(f.path)));
  }

  // pick largest remaining file
  return vids.sort((a, b) => b.bytes - a.bytes)[0] ?? undefined;
}

export async function POST(request: NextRequest) {
  try {
    const {
      access_token,
      magnet,
      pollMS = 1000,
      timeoutMS = 30000,
      // new optional knobs:
      allowedExts,              // e.g. ["mp4","m4v"]
      disallowExts = ["mkv"],   // default: exclude mkv
      excludeSamples = true,    // default: skip sample/trailer/extras
    }: {
      access_token: string;
      magnet: string;
      pollMS?: number;
      timeoutMS?: number;
      allowedExts?: string[];
      disallowExts?: string[];
      excludeSamples?: boolean;
    } = await request.json();

    if (!access_token || !magnet) {
      return NextResponse.json(
        { error: "Missing access_token or magnet" },
        { status: 400 }
      );
    }

    // 1) addMagnet (unchanged)
    const form = new URLSearchParams({ magnet });
    const addRes = await fetch("https://api.real-debrid.com/rest/1.0/torrents/addMagnet", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const addText = await addRes.text();
    if (!addRes.ok) {
      return NextResponse.json(
        { step: "addMagnet", status: addRes.status, body: addText },
        { status: 502 }
      );
    }
    const { id } = JSON.parse(addText) as { id?: string };
    if (!id) {
      return NextResponse.json(
        { step: "addMagnet", error: "No id in RD response", body: addText },
        { status: 502 }
      );
    }

    const deadline = Date.now() + timeoutMS;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // 2) poll until file list is present (or links already exist)
    let info: RDInfo = {};
    while (Date.now() < deadline) {
      const res = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`info ${res.status}: ${text}`);
      info = JSON.parse(text);

      const haveFiles = Array.isArray(info.files) && info.files.length > 0;
      const haveLinks = Array.isArray(info.links) && info.links.length > 0;

      // even if links exist, we'll re-select below to force non-mkv
      if (haveFiles) break;
      if (haveLinks && info.status === "downloaded") break;

      await wait(pollMS);
    }

    // 3) force a selection that excludes mkv (or respects allowedExts)
    if (Array.isArray(info.files) && info.files.length > 0) {
      const pick = pickByExt(info.files, { allowedExts, disallowExts, excludeSamples });

      if (!pick) {
        return NextResponse.json(
          { step: "selectFiles", error: "no_supported_video", id },
          { status: 409 }
        );
      }

      const selRes = await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ files: String(pick.id) }).toString(),
        }
      );

      if (!selRes.ok) {
        const selText = await selRes.text().catch(() => "");
        return NextResponse.json(
          { step: "selectFiles", status: selRes.status, body: selText, id },
          { status: selRes.status }
        );
      }
    }

    // 4) poll until it’s downloaded & links available (unchanged)
    info = {};
    while (Date.now() < deadline) {
      const res = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`info ${res.status}: ${text}`);
      info = JSON.parse(text);
      if (info.status === "downloaded" && Array.isArray(info.links) && info.links.length > 0) break;
      await wait(pollMS);
    }
    if (!(Array.isArray(info.links) && info.links.length > 0)) {
      return NextResponse.json(
        { step: "poll-links", error: "No links before timeout", id, status: info.status },
        { status: 504 }
      );
    }

    // 5) unrestrict first link (unchanged)
    const unresRes = await fetch("https://api.real-debrid.com/rest/1.0/unrestrict/link", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ link: info.links[0] }),
    });
    const unresText = await unresRes.text();
    if (!unresRes.ok) {
      return NextResponse.json(
        { step: "unrestrict", status: unresRes.status, body: unresText, id, link: info.links[0] },
        { status: 502 }
      );
    }
    const unres = JSON.parse(unresText);

    return NextResponse.json({
      id,
      status: "ok",
      filename: info.filename,
      link: info.links[0],
      download: unres.download,
      host: unres.host,
      filesize: unres.filesize,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
