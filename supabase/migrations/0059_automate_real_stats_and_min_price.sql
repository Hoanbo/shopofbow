-- ============================================================================
-- BOW — Migration 0059: AUTOMATE REAL STATS & MIN PLAN PRICE
-- ============================================================================

set search_path = public, auth, extensions;

-- 1. HÀM TỰ ĐỘNG TÍNH TOÁN ĐÁNH GIÁ THẬT, ĐÃ BÁN THẬT VÀ GIÁ GÓI THẤP NHẤT
create or replace function public.recalc_product_stats(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sold_count int;
  v_avg_rating numeric;
  v_min_price numeric;
  v_min_ctv numeric;
begin
  if p_product_id is null then
    return;
  end if;

  -- 1. Đếm tổng số lượng đơn hàng hoàn thành thật (tính cả quantity và tương thích các đơn cũ)
  select coalesce(sum(coalesce(quantity, 1)), 0) into v_sold_count
  from public.orders o
  where (
    o.product_id = p_product_id
    or o.product_name = (select name from public.products where id = p_product_id)
    or o.product_name ilike ((select name from public.products where id = p_product_id) || '%')
  )
  and o.status = 'completed';

  -- 2. Tính trung bình sao từ đánh giá đã duyệt thật (null nếu chưa có review nào)
  select round(avg(rating)::numeric, 1) into v_avg_rating
  from public.product_reviews
  where product_id = p_product_id and status = 'approved';

  -- 3. Lấy giá bán lẻ thấp nhất từ các gói đang active
  select min(price) into v_min_price
  from public.product_plans
  where product_id = p_product_id and is_active = true and price > 0;

  -- 4. Lấy giá sỉ CTV thấp nhất từ các gói đang active
  select min(coalesce(price_ctv, price)) into v_min_ctv
  from public.product_plans
  where product_id = p_product_id and is_active = true and coalesce(price_ctv, price) > 0;

  -- 5. Cập nhật vào bảng products
  update public.products
  set
    sold = coalesce(v_sold_count, 0),
    rating = v_avg_rating,
    base_price = coalesce(v_min_price, base_price),
    price_ctv = coalesce(v_min_ctv, v_min_price, price_ctv)
  where id = p_product_id;
end;
$$;

-- 2. TRIGGER KHI CÓ THAY ĐỔI TRÊN ĐƠN HÀNG (ORDERS)
create or replace function public.trg_orders_recalc_stats()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if new.product_id is not null then
      perform public.recalc_product_stats(new.product_id);
    end if;
  end if;
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') then
    if old.product_id is not null and (new.product_id is distinct from old.product_id or tg_op = 'DELETE') then
      perform public.recalc_product_stats(old.product_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orders_stats on public.orders;
create trigger trg_orders_stats
after insert or update of status, product_id or delete on public.orders
for each row execute function public.trg_orders_recalc_stats();

-- 3. TRIGGER KHI CÓ THAY ĐỔI TRÊN ĐÁNH GIÁ (PRODUCT_REVIEWS)
drop trigger if exists on_review_rating_change on public.product_reviews;

create or replace function public.trg_reviews_recalc_stats()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if new.product_id is not null then
      perform public.recalc_product_stats(new.product_id);
    end if;
  end if;
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') then
    if old.product_id is not null and (new.product_id is distinct from old.product_id or tg_op = 'DELETE') then
      perform public.recalc_product_stats(old.product_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reviews_stats on public.product_reviews;
create trigger trg_reviews_stats
after insert or update of status, rating, product_id or delete on public.product_reviews
for each row execute function public.trg_reviews_recalc_stats();

-- 4. TRIGGER KHI CÓ THAY ĐỔI TRÊN GÓI GIÁ (PRODUCT_PLANS)
create or replace function public.trg_plans_recalc_stats()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    if new.product_id is not null then
      perform public.recalc_product_stats(new.product_id);
    end if;
  end if;
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') then
    if old.product_id is not null and (new.product_id is distinct from old.product_id or tg_op = 'DELETE') then
      perform public.recalc_product_stats(old.product_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_plans_stats on public.product_plans;
create trigger trg_plans_stats
after insert or update of price, price_ctv, is_active, product_id or delete on public.product_plans
for each row execute function public.trg_plans_recalc_stats();

-- 5. BACKFILL PRODUCT_ID CHO CÁC ĐƠN HÀNG CŨ & CHẠY ĐỒNG BỘ TOÀN BỘ SẢN PHẨM
update public.orders o
set product_id = p.id
from public.products p
where o.product_id is null
  and (o.product_name = p.name or o.product_name ilike (p.name || '%'));

do $$
declare
  r record;
begin
  for r in select id from public.products
  loop
    perform public.recalc_product_stats(r.id);
  end loop;
end;
$$;
