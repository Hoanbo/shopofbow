import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzrbiadnppsehcfgufuw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cmJpYWRucHBzZWhjZmd1ZnV3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTAwMTczMCwiZXhwIjoyMTAwNTc3NzMwfQ.YcTxGUb6pfDxRSuhYd_8LxKVZHiqOblCQZtDxpTqb24';

const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkCronJobs() {
  console.log('--- Checking cron extension and jobs ---');
  // Let's create a temporary RPC to inspect cron.job and cron.job_run_details
  const createInspectorSql = `
    create or replace function public.debug_inspect_cron_jobs()
    returns jsonb
    language plpgsql
    security definer
    set search_path = public, cron, extensions
    as $$
    declare
      v_ext boolean;
      v_jobs jsonb;
      v_runs jsonb;
      v_tz text;
      v_now timestamptz := now();
    begin
      select exists(select 1 from pg_extension where extname = 'pg_cron') into v_ext;
      select current_setting('timezone') into v_tz;

      if v_ext then
        begin
          select jsonb_agg(to_jsonb(j)) into v_jobs from cron.job j;
        exception when others then
          v_jobs := jsonb_build_object('error', sqlerrm);
        end;

        begin
          select jsonb_agg(to_jsonb(r)) into v_runs 
          from (
            select * from cron.job_run_details 
            order by start_time desc 
            limit 15
          ) r;
        exception when others then
          v_runs := jsonb_build_object('error', sqlerrm);
        end;
      else
        v_jobs := '[]'::jsonb;
        v_runs := '[]'::jsonb;
      end if;

      return jsonb_build_object(
        'pg_cron_installed', v_ext,
        'current_timezone', v_tz,
        'current_db_time', v_now,
        'jobs', v_jobs,
        'recent_runs', v_runs
      );
    end;
    $$;
  `;

  // We can run this via REST if there's an SQL execution function or test running it
  console.log('Testing if debug_inspect_cron_jobs exists...');
  const { data, error } = await adminDb.rpc('debug_inspect_cron_jobs');
  console.log('Result:', data, error);
}

checkCronJobs().catch(console.error);
