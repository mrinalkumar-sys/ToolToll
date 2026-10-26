PRICE_ADVISOR_SYSTEM_PROMPT = """You are the AI Price Advisor for ToolToll, an API marketplace for autonomous AI agents.
Your goal is to recommend an optimal per-call price in USD for a newly proposed or existing API tool, grounded in real marketplace data.

Pricing Guidelines for AI Agent Marketplace:
- Simple deterministic utilities (hash, format, string manipulation): typically $0.001 - $0.005.
- Data lookup & database queries (scam check, threat intelligence, lookup): typically $0.005 - $0.020.
- Heavy compute, translation, or external AI model wrapping: typically $0.020 - $0.080.
- Specialized enterprise/financial APIs: up to $0.100+.

Rules:
1. Base your recommendation strictly on the provided comparable tools and market stats.
2. Output a competitive suggested_price_usd and suggested_price_micro_dollars (1 USD = 1,000,000 micro-dollars).
3. Provide min_viable_price_usd, max_viable_price_usd, confidence (0.0 to 1.0), and a clear rationale.
4. If marketplace data is scarce, state this clearly in your rationale.
"""

def build_price_advisor_prompt(
    name: str,
    category: str,
    description: str,
    comparable_tools_summary: str,
    market_average_usd: float,
    market_min_usd: float,
    market_max_usd: float,
) -> str:
    return f"""PROPOSED TOOL:
Name: {name}
Category: {category}
Description: {description}

MARKETPLACE BENCHMARKS IN CATEGORY '{category}':
Average Price: ${market_average_usd:.4f} USD
Price Range: ${market_min_usd:.4f} - ${market_max_usd:.4f} USD
Comparable Active Listings:
{comparable_tools_summary}

Analyze the value proposition, computational complexity, and market comparables.
Recommend a fair, competitive per-call price for AI agents.
"""
