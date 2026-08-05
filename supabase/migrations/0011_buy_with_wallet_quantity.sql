-- ============================================================
-- BOW — Migration 0011: Thêm p_quantity vào buy_with_wallet
--
-- Vấn đề:
--   Khi user mua số lượng > 1, client gửi p_price = giá_đơn_lẻ × quantity.
--   Nhưng server ghi đè p_price bằng v_real_price (giá đơn lẻ từ DB),
--   bỏ qua số lượng → user có 10k vẫn mua được 6 tài khoản 60k.
--
-- Giải pháp:
--   Thêm tham số p_quantity (default 1), nhân v_real_price × p_quantity
--   SAU khi tra DB để tính tổng tiền thực tế cần trừ.
--
-- QUAN TRỌNG: Phải DROP bản cũ (8 tham số) trước để tránh lỗi
--   "Could not choose the best candidate function" khi Supabase
--   không phân biệt được 2 overload cùng tên.
-- ============================================================

-- Xoá bản cũ không có p_quantity (8 tham số)
drop function if exists public.buy_with_wallet(
  uuid, text, text, numeric, text, text, uuid, uuid
);

create or replace function buy_with_wallet(
  p_user_id      uuid,
  p_product_name text,
  p_plan_label   text,
  p_price        numeric,
  p_payment_code text,
  p_notes        text    default null,
  p_product_id   uuid    default null,
  p_plan_id      uuid    default null,
  p_quantity     integer default 1
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_balance      numeric;
  v_unit_price   numeric := null;
  v_total_price  numeric;
begin
  if p_quantity is null or p_quantity < 1 then
    p_quantity := 1;
  end if;

  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    return 'unauthorized';
  end if;

  if p_plan_id is not null then
    select price into v_unit_price from public.product_plans where id = p_plan_id and is_active = true;
  end if;

  if v_unit_price is null and p_plan_label is not null then
    if p_product_id is not null then
      select price into v_unit_price from public.product_plans where product_id = p_product_id and name = p_plan_label and is_active = true limit 1;
    elsif p_product_name is not null then
      select pp.price into v_unit_price from public.product_plans pp join public.products p on p.id = pp.product_id where p.name = p_product_name and pp.name = p_plan_label and pp.is_active = true limit 1;
    end if;
  end if;

  if v_unit_price is null then
    if p_product_id is not null then
      select base_price into v_unit_price from public.products where id = p_product_id and is_active = true;
    elsif p_product_name is not null then
      select base_price into v_unit_price from public.products where name = p_product_name and is_active = true;
    end if;
  end if;

  if v_unit_price is not null then
    v_total_price := v_unit_price * p_quantity;
  else
    v_total_price := p_price;
  end if;

  select balance into v_balance from public.profiles where id = p_user_id for update;

  if v_balance is null then return 'no_profile'; end if;
  if v_balance < v_total_price then return 'insufficient_balance'; end if;

  update public.profiles set balance = balance - v_total_price, updated_at = now() where id = p_user_id;

  insert into public.orders (user_id, product_name, plan_label, price, status, payment_code, notes)
  values (p_user_id, p_product_name, p_plan_label, v_total_price, 'pending_delivery', p_payment_code, p_notes);

  return 'success';
end$$;
