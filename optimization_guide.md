# LEGO Scraper Optimization Guide

## Current Status
- 5,516 items need to be scraped
- Current rate: 42 items per 30 minutes (1.4 items/minute)
- Estimated completion time: ~65.7 hours

## Optimization Strategies

### 1. Batch URL Processing

The most effective way to increase throughput is to process multiple URLs in parallel within your existing worker instance.

#### Implementation Steps:

1. **Create a batch URL claiming function in Supabase:**

```sql
CREATE OR REPLACE FUNCTION public.claim_batch_urls(worker_id text, batch_size int)
RETURNS SETOF lego_url_pairs
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
begin
  -- Return the claimed URL pairs
  return query
  update public.lego_url_pairs
  set
    status = 'in_progress',
    worker_id = claim_batch_urls.worker_id,
    processing_started_at = now()
  where id in (
    select id 
    from public.lego_url_pairs
    where (status is null OR status = 'pending')
    and (
      dutch_crawl_status is null or
      dutch_crawl_status != 'completed' or
      english_crawl_status is null or
      english_crawl_status != 'completed'
    )
    order by id asc
    limit claim_batch_urls.batch_size
    for update skip locked
  )
  returning *;
end;
$function$;
```

2. **Modify your n8n workflow to use the parallel processing pattern:**
   - Replace the single URL claiming with batch claiming
   - Process multiple URLs concurrently using n8n's parallel execution
   - Set appropriate batch size based on your server resources

### 2. Crawler API Optimization

#### 2.1 Increase Concurrent Requests

Modify your Crawl4AI config to increase concurrent connections:

```yaml
crawler:
  concurrency:
    max_connections: 10  # Increase from default
    max_requests_per_host: 5  # Increase from default
  timeouts:
    batch_process: 300.0  # Adjust based on your needs
```

#### 2.2 Optimize Browser Configuration

Reduce Chrome's resource usage per instance:

```json
"browser_config": {
  "type": "BrowserConfig",
  "params": {
    "headless": true,
    "disable_images": true,
    "disable_css": false,
    "disable_javascript": false,
    "args": [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--disable-accelerated-2d-canvas",
      "--disable-extensions"
    ]
  }
}
```

#### 2.3 Cache Optimization

Implement a more aggressive caching strategy to reduce redundant crawls:

```json
"crawler_config": {
  "type": "CrawlerRunConfig",
  "params": {
    "cache_mode": "aggressive",
    "cache_ttl": 86400  // 24 hours in seconds
  }
}
```

### 3. Resource Allocation

#### 3.1 CPU & Memory

Make sure your worker has adequate resources:

- **Recommended Minimum**: 4 CPU cores, 8GB RAM
- **Optimal**: 8 CPU cores, 16GB RAM

#### 3.2 Network Bandwidth

- Ensure your worker has sufficient network bandwidth
- Consider placing the worker in a datacenter close to the LEGO website's servers

### 4. Proxy Configuration

For better throughput, use a rotating proxy service with multiple IPs to avoid rate limiting:

```json
"crawler_config": {
  "type": "CrawlerRunConfig",
  "proxy": "http://user-{{ $env.OXYLABS_USERNAME }}:{{ $env.OXYLABS_PASSWORD }}@dc.oxylabs.io:8000",
  "proxy_options": {
    "country": "us",  // Or another relevant location
    "session_id": "{{ $json.id }}"  // Use unique session per URL
  }
}
```

### 5. Extraction Strategy Optimization

Use a more efficient extraction method for faster processing:

```json
"extraction_strategy": {
  "type": "LLMExtractionStrategy",
  "params": {
    "instruction": "Extract detailed information about this LEGO product...",
    "llm_config": {
      "type": "LLMConfig",
      "params": {
        "provider": "deepseek/deepseek-chat",
        "temperature": 0.1,  // Lower temperature for faster, more deterministic results
        "max_tokens": 1200   // Limit token count for faster responses
      }
    }
  }
}
```

## Expected Improvement Calculations

With these optimizations, we can expect:

| Optimization | Improvement Factor | New Rate (items/30min) |
|--------------|-------------------|------------------------|
| Batch Processing (5 URLs) | 5x | 210 |
| Browser Optimization | 1.2x | 252 |
| Extraction Strategy Optimization | 1.1x | 277 |
| **Total Expected Improvement** | **6.6x** | **277** |

**New estimated completion time: ~10 hours** (65.7 hours ÷ 6.6)

## Implementation Priorities

1. **High Impact, Easy Implementation:**
   - Batch URL claiming function
   - Browser optimization parameters

2. **High Impact, Medium Complexity:**
   - n8n workflow parallel processing
   - Extraction strategy optimization

3. **Medium Impact, Higher Complexity:**
   - Proxy rotation configuration
   - Caching strategy implementation

## Monitoring

After implementing these changes, monitor:

1. CPU/Memory usage on the worker
2. Error rates and completion rates
3. Actual throughput vs. expected

Adjust batch sizes and concurrency settings based on observed performance.
