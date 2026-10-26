import { describe, it, expect, beforeAll } from "vitest";
import { build } from "vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

/**
 * ビルド成果物の検証。実際に `vite build` を実行して、オフライン対応（PWA）・フォントの自前配置・
 * アイコンなどが、配信される形で揃っていることを確かめる。
 * 「ビルドが通る」だけでは、オフラインで開けるか・外部に接続していないかは分からないため。
 */
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "toeic-dist-"));
const read = (p: string) => fs.readFileSync(path.join(outDir, p), "utf-8");
const exists = (p: string) => fs.existsSync(path.join(outDir, p));
const listAssets = () => fs.readdirSync(path.join(outDir, "assets"));
/** PNG の幅・高さ（IHDR チャンク） */
function pngSize(file: string): [number, number] {
  const b = fs.readFileSync(path.join(outDir, file));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

let sw = "";
let precache: string[] = [];
let precacheEntries: { url: string; revision: string | null }[] = [];

/**
 * Service Worker の `precacheAndRoute([...])` に渡された、事前保存するファイルの一覧を取り出す。
 * 出力の整形（ミニファイの有無）に左右されないよう、配列部分をJSの値として解釈する。
 */
function extractPrecacheEntries(source: string): { url: string; revision: string | null }[] {
  const start = source.indexOf("precacheAndRoute(");
  const open = source.indexOf("[", start);
  let depth = 0;
  let end = open;
  for (; end < source.length; end++) {
    if (source[end] === "[") depth++;
    if (source[end] === "]" && --depth === 0) break;
  }
  return new Function(`return ${source.slice(open, end + 1)}`)() as { url: string; revision: string | null }[];
}

beforeAll(async () => {
  // 利用者に配信される本番ビルドを検証する。vitest の中では NODE_ENV が "test" になり、
  // 開発向けの出力（ミニファイなし・別の書式）になってしまうため、本番として実行する
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await build({ logLevel: "silent", mode: "production", build: { outDir, emptyOutDir: true } });
  } finally {
    process.env.NODE_ENV = original;
  }
  sw = read("sw.js");
  precacheEntries = extractPrecacheEntries(sw);
  precache = precacheEntries.map((e) => e.url);
}, 120_000);

describe("ビルド成果物: オフライン対応（PWA）", () => {
  it("事前保存の一覧を取り出せている（空ではない）", () => {
    expect(precache.length).toBeGreaterThan(30);
    expect(new Set(precache).size).toBeGreaterThan(30);
  });

  it("マニフェストがあり、ホーム画面に追加できる項目（名前・表示・色・アイコン）が揃っている", () => {
    const m = JSON.parse(read("manifest.webmanifest"));
    expect(m).toMatchObject({ name: "TOEIC Drill", short_name: "TOEIC Drill", lang: "ja", display: "standalone", start_url: "/", theme_color: "#16213E" });
    const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ":" + i.purpose : ""}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512", "512x512:maskable"]));
    expect(read("index.html")).toContain('rel="manifest"');
  });

  it("マニフェストが参照するアイコン画像が実在し、宣言どおりの大きさになっている", () => {
    const m = JSON.parse(read("manifest.webmanifest"));
    for (const icon of m.icons as { src: string; sizes: string }[]) {
      expect(exists(icon.src), `${icon.src} がない`).toBe(true);
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(icon.src)).toEqual([w, h]);
    }
    expect(pngSize("apple-touch-icon.png")).toEqual([180, 180]);
  });

  it("Service Worker があり、画面の移動先として index.html を使う（オフラインでも開ける）", () => {
    expect(exists("sw.js")).toBe(true);
    expect(sw).toMatch(/createHandlerBoundToURL\(\s*"index\.html"\s*\)/);
  });

  it("画面の読み込みファイル（遅延読み込みのチャンクを含む）がすべて、あらかじめ保存される", () => {
    const js = listAssets().filter((f) => f.endsWith(".js"));
    expect(js.length).toBeGreaterThan(15);
    for (const f of js) expect(precache, `${f} が事前保存の対象にない`).toContain(`assets/${f}`);
  });

  it("問題データ（読解・Part 1・単語・文法など）を含むチャンクも事前保存される（オフラインで学習できる）", () => {
    const dataChunks = listAssets().filter((f) => f.endsWith(".js") && fs.statSync(path.join(outDir, "assets", f)).size > 400_000);
    expect(dataChunks.length).toBeGreaterThanOrEqual(4);
    for (const f of dataChunks) expect(precache).toContain(`assets/${f}`);
  });

  it("index.html・CSS・アイコン・マニフェストも事前保存される", () => {
    for (const f of ["index.html", "favicon.svg", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png", "manifest.webmanifest"]) {
      expect(precache, `${f} が事前保存の対象にない`).toContain(f);
    }
    expect(precache.some((u) => /^assets\/index-.*\.css$/.test(u))).toBe(true);
  });

  it("事前保存の合計サイズは約6MB以内（初回に取得する量の目安）", () => {
    const total = precache.filter((u, i) => precache.indexOf(u) === i).reduce((n, u) => n + (exists(u) ? fs.statSync(path.join(outDir, u)).size : 0), 0);
    expect(total).toBeLessThan(6 * 1024 * 1024);
  });
});

describe("ビルド成果物: 事前保存の一覧が、配信されるファイルと一致している", () => {
  it("一覧のファイルがすべて実在する（リンク切れがない）", () => {
    const missing = precache.filter((u) => !exists(u));
    expect(missing).toEqual([]);
  });

  it("ファイル名にハッシュのないもの（index.html・アイコン等）は、内容のハッシュ（revision）が一覧にあり、実際のファイルと一致する", () => {
    // 更新の検知はこの revision で行う。ずれていると、ファイルを更新しても利用者の端末に反映されない
    const unhashed = precacheEntries.filter((e) => e.revision !== null);
    expect(unhashed.length).toBeGreaterThan(5);
    for (const e of unhashed) {
      const md5 = crypto.createHash("md5").update(fs.readFileSync(path.join(outDir, e.url))).digest("hex");
      expect(e.revision, `${e.url} の revision が実際のファイルと一致しない`).toBe(md5);
    }
  });

  it("ファイル名にハッシュのあるもの（assets/…）は revision を持たない（名前が変われば別ファイルとして扱われる）", () => {
    for (const e of precacheEntries.filter((x) => x.url.startsWith("assets/"))) expect(e.revision).toBeNull();
  });

  it("どの画面を開いても、必要なファイル（import の参照先）がすべて事前保存されている（オフラインで依存が欠けない）", () => {
    // 各JSが import している別のJSを辿り、事前保存の一覧にないものがないかを確認する
    const refs = (file: string): string[] => {
      const src = read(`assets/${file}`);
      return [...src.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g)].map((m) => m[1]);
    };
    const js = listAssets().filter((f) => f.endsWith(".js"));
    const notCached: string[] = [];
    for (const f of js) for (const dep of refs(f)) if (!precache.includes(`assets/${dep}`)) notCached.push(`${f} → ${dep}`);
    expect(notCached).toEqual([]);
    const total = js.reduce((n, f) => n + refs(f).length, 0);
    expect(total).toBeGreaterThan(20);   // 参照を実際に辿れている（空振りで通っていない）ことの確認
  });

  it("起点の index.html が読み込む JS と CSS も、事前保存されている", () => {
    const html = read("index.html");
    const entry = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((m) => m[1]);
    expect(entry.length).toBeGreaterThanOrEqual(2);
    for (const e of entry) expect(precache, `${e} が事前保存の対象にない`).toContain(e);
  });
});

describe("ビルド成果物: フォントの自前配置", () => {
  it("外部のフォント配信（Google Fonts）には接続しない", () => {
    expect(read("index.html")).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const css = listAssets().filter((f) => f.endsWith(".css")).map((f) => read(`assets/${f}`)).join("\n");
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it("Inter と Fraunces が、アプリに同梱されたファイル（woff2）として定義されている", () => {
    const css = listAssets().filter((f) => f.endsWith(".css")).map((f) => read(`assets/${f}`)).join("\n");
    expect(css).toMatch(/font-family:\s*Inter Variable/);
    expect(css).toMatch(/font-family:\s*Fraunces Variable/);
    expect(css).toMatch(/--font-body:\s*"Inter Variable"/);
    expect(css).toMatch(/--font-display:\s*"Fraunces Variable"/);
    for (const f of listAssets().filter((f) => f.endsWith(".woff2"))) expect(css).toContain(f);   // 取りこぼしなく参照されている
  });

  it("英数字の範囲（latin）のフォントは事前保存され、それ以外の範囲は事前保存されない（容量を抑える）", () => {
    const fonts = precache.filter((u) => u.endsWith(".woff2"));
    expect(fonts.length).toBe(2);
    expect(fonts.every((u) => /-latin-(wght|opsz)-normal-/.test(u))).toBe(true);
    expect(sw).toMatch(/cacheName:\s*"fonts"/);   // それ以外の範囲は、必要になったときに取得して保存する
  });
});

describe("ビルド成果物: アイコンとファビコン", () => {
  it("index.html のアイコンの参照先が、すべて実在する（以前は存在しない /vite.svg を参照していた）", () => {
    const html = read("index.html");
    const hrefs = [...html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBe(3);
    for (const h of hrefs) expect(exists(h.replace(/^\//, "")), `${h} が実在しない`).toBe(true);
    expect(html).not.toContain("vite.svg");
  });

  it("ファビコンは、このアプリのアイコン（Viteのテンプレートの紫のロゴではない）", () => {
    const svg = read("favicon.svg");
    expect(svg).toContain("#16213E");
    expect(svg).toContain("#C9932C");
    expect(svg).not.toContain("863bff");   // Vite テンプレートのロゴの色
  });

  it("使っていないテンプレートの画像（icons.svg）は含まれない", () => {
    expect(exists("icons.svg")).toBe(false);
  });
});
