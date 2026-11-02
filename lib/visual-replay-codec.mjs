/** A deliberately restricted rrweb dialect for the public marketing homepage. */
export const VISUAL_FORMAT = "rrweb-v1";
export const VISUAL_MAX_BATCH_BYTES = 262144;
export const VISUAL_MAX_SESSION_BYTES = 3145728;
export const VISUAL_MAX_EVENTS = 5000;
export const VISUAL_MAX_BATCH_EVENTS = 128;
export const VISUAL_MAX_DURATION = 600000;
const MAX_NODES = 7000;
const MAX_TEXT = 20000;
const MAX_CSS = 160000;
const ASSETS = new Set(["/favicon.svg", "/images/landing/reading.webp", "/images/landing/analysis.webp", "/images/landing/controls.webp", "/images/landing/beta.webp", "/images/landing/rhythms.webp", "/brand/satinlore-waitlist.jpg", "/brand/satinlore-concept.jpg"]);
const BLOCKED_TAGS = new Set(["script", "noscript", "meta", "base", "iframe", "frame", "frameset", "object", "embed", "canvas", "video", "audio", "source", "track", "form", "input", "textarea", "select", "option"]);
const TAGS = new Set(["html", "head", "body", "title", "style", "link", "div", "span", "p", "section", "article", "aside", "header", "footer", "main", "nav", "h1", "h2", "h3", "h4", "h5", "h6", "a", "button", "img", "picture", "figure", "figcaption", "strong", "em", "b", "i", "small", "br", "hr", "ul", "ol", "li", "dl", "dt", "dd", "details", "summary", "label", "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "text", "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "use"]);
const SIMPLE_ATTRIBUTES = new Set(["class", "id", "role", "lang", "dir", "aria-label", "aria-hidden", "alt", "title", "width", "height", "viewBox", "viewbox", "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2", "points", "transform", "preserveAspectRatio", "preserveaspectratio", "xmlns", "open", "hidden", "loading", "decoding", "_cssText", "rr_width", "rr_height"]);
const integer = (v, min = 0, max = 10000000) => Number.isSafeInteger(v) && v >= min && v <= max;
const object = v => !!v && typeof v === "object" && !Array.isArray(v);
const list = (v, max = MAX_NODES) => Array.isArray(v) && v.length <= max;
const plainText = (v, max = MAX_TEXT) => typeof v === "string" && v.length <= max && !/[\u0000]/.test(v);
const validId = value => integer(value, 1);
const coordinate = value => typeof value === "number" && Number.isFinite(value) && value >= -60000 && value <= 60000;

/** Asset URLs can reference only the fixed public image catalogue, never queries or APIs. */
export function safeVisualAsset(value, assetOrigin = "https://satinlore.com") {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value, "https://satinlore.com");
    if (!["https://satinlore.com", assetOrigin].includes(url.origin) || url.username || url.password || !ASSETS.has(url.pathname)) return null;
    return url.pathname;
  } catch { return null; }
}

export function safeVisualCss(value) {
  if (!plainText(value, MAX_CSS)) return null;
  // No replay CSS may fetch a network resource. Images use the separate exact
  // public catalogue. The replay document additionally enforces a closed CSP.
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\\/g, "")
    .replace(/@import[^;{}]*(?:;|$)/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/-moz-binding\s*:[^;{}]*/gi, "")
    .replace(/behavior\s*:[^;{}]*/gi, "")
    .replace(/https?:\/\/[^)'"\s;}]+/gi, "");
}

function attributes(value, tag, assetOrigin = "https://satinlore.com") {
  if (!object(value) || Object.keys(value).length > 100) return null;
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "href" || key === "xlink:href") {
      if (tag === "a") result.href = "#";
      else if (typeof raw === "string" && /^#[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(raw)) result[key] = raw;
      continue;
    }
    if (key === "src") { const asset = safeVisualAsset(raw, assetOrigin); if (tag === "img" && asset) result.src = asset; continue; }
    if (raw === null && (SIMPLE_ATTRIBUTES.has(key) || key === "style")) { result[key] = null; continue; }
    if (key === "style" || key === "_cssText") { const css = safeVisualCss(raw); if (css !== null) result[key] = css; continue; }
    if (!SIMPLE_ATTRIBUTES.has(key)) continue;
    if (typeof raw === "boolean") { if (["open", "hidden"].includes(key)) result[key] = raw; continue; }
    if (typeof raw === "number" && Number.isFinite(raw) && Math.abs(raw) <= 60000) { result[key] = raw; continue; }
    const bound = key === "d" || key === "points" ? 8192 : 1024;
    if (!plainText(raw, bound) || /(?:javascript:|data:|url\s*\()/i.test(raw)) continue;
    result[key] = raw;
  }
  return result;
}

function blockedNode(node) {
  const a = node.attributes || {};
  return BLOCKED_TAGS.has(String(node.tagName).toLowerCase()) || Object.hasOwn(a, "data-experience-mask") ||
    Object.hasOwn(a, "contenteditable") && a.contenteditable !== "false" ||
    /(?:^|\s)(?:signup-card|website-experience|experience-banner|experience-dialog|cf-turnstile|rr-block|satinlore-replay-masked)(?:\s|$)/.test(String(a.class || ""));
}

function placeholderAttributes(attrs = {}) {
  const dimension = value => {
    const number = typeof value === "number" ? value : typeof value === "string" && /^\d{1,5}(?:\.\d{1,3})?px$/.test(value) ? Number(value.slice(0, -2)) : NaN;
    return Number.isFinite(number) && number >= 0 && number <= 60000 ? Math.round(number * 10) / 10 : null;
  };
  const width = dimension(attrs.rr_width), height = dimension(attrs.rr_height);
  return {class: "satinlore-replay-masked", ...(width !== null ? {rr_width: `${width}px`} : {}), ...(height !== null ? {rr_height: `${height}px`} : {}),
    style: `${width !== null ? `width:${width}px;` : ""}${height !== null ? `height:${height}px;` : "min-height:48px;"}box-sizing:border-box;background:#e8e0e4;border-radius:8px;overflow:hidden;color:transparent;pointer-events:none`};
}

/**
 * Stateful capture/replay sanitiser: blocked descendants and unrelated IDs never
 * become eligible through a later text/attribute mutation.
 */
export function createVisualEventSanitizer({strictIds = true, assetOrigin = "https://satinlore.com"} = {}) {
  const included = new Map(), blocked = new Set(), parents = new Map();
  let nodes = 0;
  const rememberBlocked = node => {
    if (!object(node)) return;
    if (validId(node.id)) { blocked.add(node.id); included.delete(node.id); }
    if (Array.isArray(node.childNodes)) for (const child of node.childNodes.slice(0, MAX_NODES)) rememberBlocked(child);
  };
  const eligible = id => validId(id) && !blocked.has(id) && (!strictIds || included.has(id));
  const blockExisting = id => {
    for (const candidate of included.keys()) {
      let at = candidate, hops = 0;
      while (at && at !== id && ++hops < 70) at = parents.get(at);
      if (at === id) blocked.add(candidate);
    }
    blocked.add(id);
    for (const value of blocked) included.delete(value);
  };
  function node(value, parentTag = "", depth = 0, parentId = null) {
    if (!object(value) || !validId(value.id) || !integer(value.type, 0, 5) || ++nodes > MAX_NODES || depth > 60) throw new Error("Invalid visual tree.");
    const id = value.id;
    if (parentId !== null) parents.set(id, parentId);
    if (value.type === 0) {
      if (!list(value.childNodes)) throw new Error();
      included.set(id, "document");
      return {type: 0, id, childNodes: value.childNodes.map(child => node(child, "document", depth + 1, id)).filter(Boolean)};
    }
    if (value.type === 1) { included.set(id, "doctype"); return {type: 1, id, name: "html", publicId: "", systemId: ""}; }
    if (value.type === 4 || value.type === 5) { rememberBlocked(value); return null; }
    if (value.type === 3) {
      if (!plainText(value.textContent, parentTag === "style" ? MAX_CSS : MAX_TEXT)) throw new Error();
      const textContent = parentTag === "style" ? safeVisualCss(value.textContent) : value.textContent;
      if (textContent === null) throw new Error();
      included.set(id, parentTag === "style" ? "css-text" : "text");
      return {type: 3, id, textContent};
    }
    const tag = typeof value.tagName === "string" ? value.tagName.toLowerCase() : "";
    if (!object(value.attributes) || !list(value.childNodes)) throw new Error();
    if (parentTag === "head" && BLOCKED_TAGS.has(tag)) { rememberBlocked(value); return null; }
    if (blockedNode(value) || !TAGS.has(tag)) {
      rememberBlocked(value);
      return {type: 2, id, tagName: "div", attributes: placeholderAttributes(value.attributes), childNodes: []};
    }
    const attrs = attributes(value.attributes, tag, assetOrigin); if (!attrs) throw new Error();
    if (tag === "link" && !Object.hasOwn(attrs, "_cssText")) { rememberBlocked(value); return null; }
    included.set(id, tag);
    return {type: 2, id, tagName: tag, attributes: attrs,
      childNodes: value.childNodes.map(child => node(child, tag, depth + 1, id)).filter(Boolean),
      ...(value.isSVG === true ? {isSVG: true} : {})};
  }
  function sanitize(input) {
    try {
      if (!object(input) || !integer(input.type, 0, 4) || !integer(input.timestamp, 0, VISUAL_MAX_DURATION) || !object(input.data)) return null;
      const {type, timestamp} = input, data = input.data;
      if (type === 0 || type === 1) return {type, timestamp, data: {}};
      if (type === 4) {
        if (!integer(data.width, 100, 4000) || !integer(data.height, 100, 4000)) return null;
        return {type, timestamp, data: {href: "https://satinlore.com/", width: data.width, height: data.height}};
      }
      if (type === 2) {
        included.clear(); blocked.clear(); parents.clear(); nodes = 0;
        if (!object(data.initialOffset) || !coordinate(data.initialOffset.left) || !coordinate(data.initialOffset.top)) return null;
        const tree = node(data.node);
        if (!tree || tree.type !== 0) return null;
        return {type, timestamp, data: {node: tree, initialOffset: {left: Math.max(0, data.initialOffset.left), top: Math.max(0, data.initialOffset.top)}}};
      }
      if (!integer(data.source, 0, 6) || data.source === 5) return null;
      const source = data.source;
      if (source === 0) {
        if (![data.texts, data.attributes, data.removes, data.adds].every(value => list(value, 1000))) return null;
        // Establish newly private boundaries before any text in this same
        // mutation packet is considered. Privacy cannot be reversed by a later class change.
        const changes = [];
        for (const item of data.attributes) {
          if (!object(item) || !validId(item.id) || !object(item.attributes)) return null;
          if (eligible(item.id) && blockedNode({tagName: included.get(item.id) || "div", attributes: item.attributes})) {
            blockExisting(item.id); changes.push({id: item.id, attributes: placeholderAttributes(item.attributes)});
          }
        }
        for (const item of data.adds) {
          if (!object(item) || !validId(item.parentId)) return null;
          if (!eligible(item.parentId)) rememberBlocked(item.node);
        }
        const texts = [];
        for (const item of data.texts) {
          if (!object(item) || !validId(item.id) || !plainText(item.value)) return null;
          if (!eligible(item.id)) continue;
          const value = included.get(item.id) === "css-text" ? safeVisualCss(item.value) : item.value;
          if (value !== null) texts.push({id: item.id, value});
        }
        for (const item of data.attributes) {
          if (!object(item) || !validId(item.id) || !object(item.attributes)) return null;
          if (!eligible(item.id)) continue;
          const attrs = attributes(item.attributes, included.get(item.id) || "div", assetOrigin);
          if (attrs && Object.keys(attrs).length) changes.push({id: item.id, attributes: attrs});
        }
        const removes = [];
        for (const item of data.removes) {
          if (!object(item) || !validId(item.id) || !validId(item.parentId)) return null;
          if (eligible(item.id) && eligible(item.parentId)) removes.push({id: item.id, parentId: item.parentId});
        }
        const adds = [];
        for (const item of data.adds) {
          if (!object(item) || !validId(item.parentId) || item.nextId !== null && !validId(item.nextId)) return null;
          if (!eligible(item.parentId)) { rememberBlocked(item.node); continue; }
          nodes = 0; const child = node(item.node, included.get(item.parentId) || "div", 0, item.parentId);
          if (child) adds.push({parentId: item.parentId, nextId: item.nextId !== null && eligible(item.nextId) ? item.nextId : null, node: child});
        }
        if (!texts.length && !changes.length && !removes.length && !adds.length) return null;
        return {type, timestamp, data: {source, texts, attributes: changes, removes, adds}};
      }
      if (source === 1 || source === 6) {
        if (!list(data.positions, 100)) return null;
        const positions = data.positions.filter(p => object(p) && eligible(p.id) && coordinate(p.x) && coordinate(p.y) && integer(p.timeOffset, -2000, 2000))
          .map(p => ({id: p.id, x: p.x, y: p.y, timeOffset: p.timeOffset}));
        return positions.length ? {type, timestamp, data: {source, positions}} : null;
      }
      if (source === 2) {
        if (data.type !== 2 || !eligible(data.id) || !coordinate(data.x) || !coordinate(data.y)) return null;
        return {type, timestamp, data: {source, type: 2, id: data.id, x: data.x, y: data.y}};
      }
      if (source === 3) {
        if (!eligible(data.id) || !coordinate(data.x) || !coordinate(data.y)) return null;
        return {type, timestamp, data: {source, id: data.id, x: Math.max(0, data.x), y: Math.max(0, data.y)}};
      }
      if (source === 4) {
        if (!integer(data.width, 100, 4000) || !integer(data.height, 100, 4000)) return null;
        return {type, timestamp, data: {source, width: data.width, height: data.height}};
      }
      return null;
    } catch { return null; }
  }
  return {sanitize, reset() {included.clear(); blocked.clear(); parents.clear(); nodes = 0;}};
}

/** Stateless structural validation for bounded HTTP batches; client keeps the ID privacy map. */
export function validateVisualEvents(value) {
  if (!list(value, VISUAL_MAX_BATCH_EVENTS) || !value.length) return null;
  const cleaner = createVisualEventSanitizer({strictIds: false}), output = [];
  let previous = -1;
  for (const event of value) {
    const safe = cleaner.sanitize(event);
    if (!safe || safe.timestamp < previous) return null;
    previous = safe.timestamp; output.push(safe);
  }
  if (new TextEncoder().encode(JSON.stringify(output)).byteLength > VISUAL_MAX_BATCH_BYTES) return null;
  return output;
}
