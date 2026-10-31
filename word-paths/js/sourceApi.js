// This module calls same-origin backend endpoints; provider credentials stay server-side.
async function enrich(path, wordId, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchImpl(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId }),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error ?? `Source lookup failed: HTTP ${response.status}`);
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Source lookup timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function enrichKrdictWord(wordId, fetchImpl) {
  return enrich("/api/krdict/enrich", wordId, fetchImpl);
}

export function enrichWiktionaryWord(wordId, fetchImpl) {
  return enrich("/api/wiktionary/enrich", wordId, fetchImpl);
}
