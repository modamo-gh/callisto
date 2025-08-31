// app/api/rd/magnetToLink/route.ts
import { NextRequest, NextResponse } from "next/server";

type RDFile = { id: number; bytes: number; path: string };
type RDInfo = { status?: string; filename?: string; files?: RDFile[]; links?: string[] };

const inflight = new Map<string, Promise<NextResponse>>();
let lastCallAt = 0; // simple in-process throttle

const VIDEO_RE = /\.(mp4|m4v|mov|webm|avi|ts)$/i;
const BAD_NAME_RE = /(sample|trailer|extras?)/i;

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
async function rateLimitGate(minGapMs = 1200) {
  const now = Date.now();
  const wait = Math.max(0, lastCallAt + minGapMs - now);
  if (wait) await sleep(wait);
  lastCallAt = Date.now();
}

async function addMagnetWithRetry(accessToken: string, magnet: string, maxRetries = 6) {
  let attempt = 0;
  const base = 800; // backoff base

  // initial spacing
  await rateLimitGate();

  while (true) {
    const form = new URLSearchParams({ magnet });
    const res = await fetch("https://api.real-debrid.com/rest/1.0/torrents/addMagnet", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    if (res.status !== 429) return res;

    attempt++;
    if (attempt > maxRetries) return res;

    const ra = res.headers.get("Retry-After");
    const retryAfterMs = ra ? Math.max(0, Number(ra) * 1000) : 0;
    const backoffMs = Math.max(
      retryAfterMs,
      Math.min(8000, base * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 250)
    );

    await sleep(backoffMs);
    await rateLimitGate();
  }
}

function getHashFromMagnet(magnet: string) {
  try {
    // try xt param first
    const xt = magnet.match(/xt=urn:btih:([A-Za-z0-9]+)/i)?.[1];
    if (xt) return xt.toLowerCase();
    // fallback
    return magnet.match(/btih:([A-Za-z0-9]+)/i)?.[1]?.toLowerCase() ?? magnet;
  } catch { return magnet; }
}

function extOf(path: string) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i + 1).toLowerCase();
}

function pickByExt(
  files: RDFile[],
  {
    allowedExts,
    disallowExts = ["mkv"],
    excludeSamples = true,
  }: { allowedExts?: string[]; disallowExts?: string[]; excludeSamples?: boolean }
) {
  let vids = files.filter(f => VIDEO_RE.test(f.path));
  if (excludeSamples) vids = vids.filter(f => !BAD_NAME_RE.test(f.path));

  if (allowedExts?.length) {
    const allow = new Set(allowedExts.map(e => e.toLowerCase()));
    vids = vids.filter(f => allow.has(extOf(f.path)));
  } else if (disallowExts?.length) {
    const deny = new Set(disallowExts.map(e => e.toLowerCase()));
    vids = vids.filter(f => !deny.has(extOf(f.path)));
  }

  return vids.sort((a, b) => b.bytes - a.bytes)[0]; // largest
}

async function fetchInfo(accessToken: string, id: string) {
  const res = await fetch(`https://api.real-debrid.com/rest/1.0/torrents/info/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`info ${res.status}: ${text}`);
  return JSON.parse(text) as RDInfo;
}

export async function POST(request: NextRequest) {
  try {
    const {
      access_token,
      magnet,
      pollMS = 1000,
      timeoutMS = 30000,
      allowedExts,
      disallowExts = ["mkv"],
      excludeSamples = true,
    } = await request.json();

    if (!access_token || !magnet) {
      return NextResponse.json({ error: "Missing access_token or magnet" }, { status: 400 });
    }

    const key = getHashFromMagnet(magnet);

    // coalesce duplicate concurrent calls
    if (inflight.has(key)) {
      const reused = await inflight.get(key)!;
      return reused.clone();
    }

    const p = (async () => {
      // 1) add magnet with 429 handling
      const addRes = await addMagnetWithRetry(access_token, magnet);
      const addText = await addRes.text();
      if (!addRes.ok) {
        return NextResponse.json(
          { step: "addMagnet", status: addRes.status, body: addText },
          { status: addRes.status === 429 ? 429 : 502 }
        );
      }
      let id: string | undefined;
      try { ({ id } = JSON.parse(addText)); } catch {}
      if (!id) {
        return NextResponse.json({ step: "addMagnet", error: "No id in RD response", body: addText }, { status: 502 });
      }

      const deadline = Date.now() + Number(timeoutMS);
      const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

      // 2) poll until files (or links) appear
      let info: RDInfo = {};
      while (Date.now() < deadline) {
        info = await fetchInfo(access_token, id);
        const haveFiles = Array.isArray(info.files) && info.files.length > 0;
        const haveLinks = Array.isArray(info.links) && info.links.length > 0;
        if (haveFiles) break;
        if (haveLinks && info.status === "downloaded") break;
        await wait(pollMS);
      }

      // 3) select best supported video (e.g., avoid mkv)
      if (Array.isArray(info.files) && info.files.length > 0) {
        const pick = pickByExt(info.files, { allowedExts, disallowExts, excludeSamples });
        if (!pick) {
          return NextResponse.json({ step: "selectFiles", error: "no_supported_video", id }, { status: 409 });
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

      // 4) poll until RD marks downloaded & exposes links
      info = {};
      while (Date.now() < deadline) {
        info = await fetchInfo(access_token, id);
        if (info.status === "downloaded" && Array.isArray(info.links) && info.links.length > 0) break;
        await wait(pollMS);
      }
      if (!(Array.isArray(info.links) && info.links.length > 0)) {
        return NextResponse.json(
          { step: "poll-links", error: "No links before timeout", id, status: info.status },
          { status: 504 }
        );
      }

      // 5) unrestrict first link to get CDN URL
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
    })();

    inflight.set(key, p);
    const res = await p;
    inflight.delete(key);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", details: err?.message ?? String(err) }, { status: 500 });
  }
}
