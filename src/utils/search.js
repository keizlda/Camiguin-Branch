// Shared by every search box in the app (Dashboard, All Devices, New Sale,
// Sales History, Reserved, Supplier Defective, Customer Returns, ...) so
// they all tolerate the same things: different punctuation/spacing than
// what's stored ("2in1" finding "2-in-1 USB Cable") and small typos
// ("eaphones" finding "Earphones").

// Strips everything but letters/digits and lowercases — hyphens, spaces,
// and other punctuation differences between what's typed and what's
// stored should never be the reason an otherwise-correct search misses.
function normalize(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Iterative (not recursive) Levenshtein distance — fine at the scale this
// runs against (short product names/brands, one search box, a few hundred
// rows, recomputed per keystroke).
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Best (smallest) edit distance between `needle` and any substring of
// `haystack` whose length is within 2 of needle's own length — catches a
// misspelled word anywhere inside a longer name, not just a misspelled
// whole-string match.
function bestSubstringDistance(haystack, needle) {
  let best = Infinity;
  const minLen = Math.max(1, needle.length - 2);
  const maxLen = needle.length + 2;
  for (let start = 0; start < haystack.length; start++) {
    for (let len = minLen; len <= maxLen; len++) {
      if (start + len > haystack.length) break;
      const dist = levenshtein(haystack.slice(start, start + len), needle);
      if (dist < best) best = dist;
      if (best === 0) return 0;
    }
  }
  return best;
}

// True if `needle` reasonably matches somewhere in `haystack` — an exact
// (post-normalization) substring match first (the common, cheap case), and
// only if that fails, a near-miss within an edit-distance budget scaled to
// the needle's own length (so a short query like "sd" still has to be
// near-exact, while a longer one tolerates more of a typo).
export function fuzzyMatch(haystack, needle) {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return true;
  if (!h) return false;
  if (h.includes(n)) return true;

  const maxDistance = n.length <= 4 ? 1 : n.length <= 8 ? 2 : 3;
  return bestSubstringDistance(h, n) <= maxDistance;
}

// True if `query` fuzzy-matches ANY of the given fields (batch code,
// device name, brand, customer name, ...) — every search box passes
// whichever fields are relevant to it through here so a match against any
// one of them counts. Falsy fields (null/undefined) are skipped, and an
// empty query always matches (same as no filter applied).
export function searchMatches(query, ...fields) {
  const q = (query || "").trim();
  if (!q) return true;
  return fields.some((f) => f && fuzzyMatch(f, q));
}
