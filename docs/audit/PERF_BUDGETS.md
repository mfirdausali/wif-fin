# Performance Budgets

## Frontend
- JS total (gzip): <= 200 kB for initial route
- CSS total (gzip): <= 50 kB
- Requests on initial load: <= 30
- TTI (p75, mid-tier laptop): <= 3.0s

## Lists
- List payload: <= 200 kB gzip per page
- Max rows per page: 50 (default)
- Scroll FPS: >= 55 on 1k rows (virtualized)
