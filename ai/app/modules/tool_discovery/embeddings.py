import math
import re
from typing import Dict, List, Set


def tokenize(text: str) -> List[str]:
    """Tokenizes and normalizes text into lowercase alphanumeric tokens."""
    if not text:
        return []
    return re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", text.lower())


class TextSearchRanker:
    """
    Lightweight BM25 / TF-IDF semantic relevance ranker.
    Calculates cosine similarity and term relevance against tool document profiles.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b

    def compute_scores(self, query: str, documents: List[Dict[str, str]]) -> List[float]:
        """
        Computes BM25 relevance scores for a query across a list of tool document profiles.
        """
        query_tokens = tokenize(query)
        if not query_tokens or not documents:
            return [0.0] * len(documents)

        num_docs = len(documents)
        doc_tokens_list = [tokenize(doc.get("text", "")) for doc in documents]
        doc_lens = [len(tokens) for tokens in doc_tokens_list]
        avg_doc_len = sum(doc_lens) / max(num_docs, 1)

        # Calculate Document Frequency (DF) for each query term
        df: Dict[str, int] = {}
        for token in set(query_tokens):
            df[token] = sum(1 for tokens in doc_tokens_list if token in tokens)

        scores = []
        for i, tokens in enumerate(doc_tokens_list):
            doc_len = doc_lens[i]
            score = 0.0
            token_counts: Dict[str, int] = {}
            for t in tokens:
                token_counts[t] = token_counts.get(t, 0) + 1

            for q_term in query_tokens:
                if q_term not in token_counts:
                    continue
                tf = token_counts[q_term]
                # Inverse Document Frequency (IDF) with smoothing
                term_df = df.get(q_term, 0)
                idf = math.log((num_docs - term_df + 0.5) / (term_df + 0.5) + 1.0)
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * (doc_len / max(avg_doc_len, 1)))
                score += idf * (numerator / max(denominator, 1e-6))

            scores.append(max(0.0, score))

        # Normalize scores to 0.0 - 1.0 range
        max_score = max(scores) if scores and max(scores) > 0 else 1.0
        normalized = [round(min(1.0, s / max_score), 4) for s in scores]
        return normalized
