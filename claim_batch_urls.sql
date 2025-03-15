-- Create a new function to claim multiple URLs at once
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
