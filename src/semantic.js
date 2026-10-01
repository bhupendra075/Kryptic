export function supportsSemanticSearch(userAgent, mobile = false) {
  return !mobile && !/Android|iPhone|iPad|Mobi/i.test(userAgent) && /Chrome\/|Edg\//.test(userAgent);
}

export function rankSemantic(queryVector, entries) {
  return entries.map(({ id, vector }) => {
    let score = 0;
    for (let i = 0; i < queryVector.length; i += 1) score += queryVector[i] * vector[i];
    return { id, score };
  }).sort((a, b) => b.score - a.score);
}
