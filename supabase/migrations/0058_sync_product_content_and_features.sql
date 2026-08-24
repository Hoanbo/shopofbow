-- ============================================================================
-- BOW — Migration 0058: SYNC PRODUCT DETAILED CONTENT & PLAN FEATURES
-- (IMMUTABLE RULE: NO PRICE MODIFICATION)
-- ============================================================================

set search_path = public, auth, extensions;

-- Function to safely update content, descriptions, common features, and plan features without altering prices
create or replace function public.sync_product_content(
  p_slug text,
  p_short_desc text,
  p_description text,
  p_common_features jsonb,
  p_plans jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prod_id uuid;
  v_feat text;
  v_plan jsonb;
  v_plan_id uuid;
  v_idx int;
begin
  select id into v_prod_id from public.products where slug = p_slug;
  if v_prod_id is null then
    return;
  end if;

  -- 1. Update Product Descriptions
  update public.products
  set 
    short_description = p_short_desc,
    description = p_description,
    updated_at = now()
  where id = v_prod_id;

  -- 2. Sync Common Features (delete and re-insert)
  delete from public.product_features where product_id = v_prod_id;
  v_idx := 1;
  for v_feat in select * from jsonb_array_elements_text(p_common_features)
  loop
    insert into public.product_features (product_id, feature, sort_order)
    values (v_prod_id, v_feat, v_idx);
    v_idx := v_idx + 1;
  end loop;

  -- 3. Sync Plan Metadata & Specific Features (PRICE UNCHANGED)
  for v_plan in select * from jsonb_array_elements(p_plans)
  loop
    select id into v_plan_id from public.product_plans
    where product_id = v_prod_id
      and (name = (v_plan->>'name') or duration = (v_plan->>'duration'));

    if v_plan_id is not null then
      update public.product_plans
      set
        badge = (v_plan->>'badge'),
        notes = case when (v_plan->>'warranty') is not null then 'Bảo hành: ' || (v_plan->>'warranty') else null end,
        is_highlight = coalesce((v_plan->>'is_highlight')::boolean, false),
        features = case when (v_plan->'features') is not null then array(select jsonb_array_elements_text(v_plan->'features')) else null end
      where id = v_plan_id;
    end if;
  end loop;
end;
$$;
