# RouteForge

RouteForge is a provider-independent intelligent model-routing engine.

## Product boundary

RouteForge decides **which configured model should handle a prompt**. The core engine does not generate text and does not require provider credentials.

## Production direction

The intended production architecture is:

`Client → API Gateway → RouteForge Router → Provider Adapter → LLM`

Key production components should include:

- versioned model/provider registry
- provider capability and availability checks
- API authentication and authorization
- rate limiting and request budgets
- structured observability with prompt redaction
- retries, timeouts, circuit breakers, and fallback policies
- deterministic routing controls for reproducibility
- offline evaluation and routing-quality monitoring
- versioned browser adapters only where first-party provider APIs are unavailable

The included browser integration is intentionally conservative: it never silently substitutes an incompatible model or submits a prompt when it cannot prove that the intended model control is available.
