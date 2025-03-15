// Modified workflow with parallel execution

// 1. Claim Pending URL node
// Replace this with our batch URL claiming function
const BATCH_SIZE = 5; // Process 5 URLs per batch

// Modified HTTP Request to claim a batch of URLs
const claimUrlNode = {
  "parameters": {
    "method": "POST",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/rpc/claim_batch_urls",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "supabaseApi",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "{\n  \"worker_id\": \"{{ $json.worker_hostname }}\",\n  \"batch_size\": " + BATCH_SIZE + "\n}",
    "options": {}
  }
};

// 2. Modified Generate Language Items node to handle batched results
const modifiedGenerateLanguageItems = `
// Handle batch of items instead of a single item
const result = [];

// API now returns an array of items
const items = $input.all();
if (!items || items.length === 0) {
  return [{
    json: {
      found_item: false,
      iteration: 1,
      worker_hostname: "crawl-worker-2",
      site_type: "lego_official"
    }
  }];
}

// Process each item in the batch
for (const batchItem of items) {
  const item = batchItem.json;
  console.log(\`Found item to process: \${item.product_id} (ID: \${item.id})\`);
  
  const siteType = item.site_type || "lego_official";
  const workerHostname = item.worker_hostname || "crawl-worker-2";
  const currentIteration = item.iteration || 1;
  
  // Only process Dutch if it needs scraping and has a URL
  if (
    (item.dutch_crawl_status === 'pending' || !item.dutch_crawl_status) && 
    item.dutch_url && 
    item.dutch_url.trim() !== ''
  ) {
    console.log('Will process Dutch URL:', item.dutch_url);
    result.push({
      json: {
        ...item,
        language: 'dutch',
        url_to_crawl: item.dutch_url,
        found_item: true,
        iteration: currentIteration,
        worker_hostname: workerHostname,
        site_type: siteType
      }
    });
  }
  
  // Only process English if it needs scraping and has a URL
  if (
    (item.english_crawl_status === 'pending' || !item.english_crawl_status) && 
    item.english_url && 
    item.english_url.trim() !== ''
  ) {
    console.log('Will process English URL:', item.english_url);
    result.push({
      json: {
        ...item,
        language: 'english',
        url_to_crawl: item.english_url,
        found_item: true,
        iteration: currentIteration,
        worker_hostname: workerHostname,
        site_type: siteType
      }
    });
  }
}

// If no languages need processing, mark as not found
if (result.length === 0) {
  console.log('No languages need processing for these items');
  return [{
    json: {
      found_item: false,
      iteration: 1,
      worker_hostname: "crawl-worker-2",
      site_type: "lego_official"
    }
  }];
}

console.log(\`Will process \${result.length} language(s) for this batch\`);
return result;
`;

// 3. Configure crawler request with higher timeout and retry settings
const optimizedCrawlerRequest = {
  "parameters": {
    "method": "POST",
    "url": "=http://{{ $json.worker_hostname }}:8000/crawl",
    "jsonBody": "={\n  \"urls\": [\"{{ $json.url_to_crawl }}\"],\n  \"browser_config\": {\n    \"type\": \"BrowserConfig\",\n    \"params\": {\n      \"headless\": true\n    }\n  },\n  \"crawler_config\": {\n    \"type\": \"CrawlerRunConfig\",\n    \"proxy\": \"http://user-{{ $env.OXYLABS_USERNAME }}:{{ $env.OXYLABS_PASSWORD }}@dc.oxylabs.io:8000\",\n    \"params\": {\n      \"remove_overlay_elements\": true,\n      \"verbose\": true,\n      \"word_count_threshold\": 10,\n      \"check_robots_txt\": false,\n      \"delay_before_return_html\": 2.0,\n      \"cache_mode\": \"bypass\",\n      \"js_code\": \"\",\n      \"extraction_strategy\": {\n        \"type\": \"LLMExtractionStrategy\",\n        \"params\": {\n          \"instruction\": \"Extract detailed information about this LEGO product...\",\n          \"llm_config\": {\n            \"type\": \"LLMConfig\",\n            \"params\": {\n              \"provider\": \"deepseek/deepseek-chat\"\n            }\n          },\n          \"schema\": {...}\n        }\n      }\n    }\n  }\n}",
    "options": {
      "timeout": 180000
    }
  },
  "retryOnFail": true,
  "maxTries": 5,
  "waitBetweenTries": 3000
};

// 4. Modified workflow configuration
const modifiedWorkflowStructure = {
  // Existing workflow structure, but with:
  // 1. Replace the claim_pending_url with claim_batch_urls
  // 2. Add parallel processing capabilities
  // 3. Optimize execution parameters
  
  // The key changes are:
  // - Batch URL claiming instead of single URL
  // - Processing multiple URLs in parallel using n8n parallel execution
  // - Optimized crawler configuration
};
