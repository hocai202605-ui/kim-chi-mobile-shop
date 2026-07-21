-- Fix: báo cáo tháng/năm không còn nhân doanh thu/lãi theo số dòng sale_items.
-- Trước: join sales × sale_items rồi sum(s.total_amount) → phiếu N dòng bị ×N.
-- Sau: DT/lãi từ sales (1 lần/phiếu); số máy từ sale_items riêng.

create or replace function public.report_inventory_monthly(
  p_year_month text,
  p_store_id uuid default null
)
returns table (
  sold_phones bigint,
  revenue bigint,
  profit bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_store_id is null and not public.is_owner() then
    p_store_id := public.my_store_id();
  end if;
  if p_store_id is not null and not public.is_owner()
     and p_store_id is distinct from public.my_store_id() then
    raise exception 'store_forbidden';
  end if;

  return query
  select
    coalesce(
      (
        select sum(si.quantity)::bigint
        from public.sale_items si
        inner join public.sales s2 on s2.id = si.sale_id
        where si.item_type = 'phone'
          and si.sale_status = 'completed'
          and s2.status = 'completed'
          and coalesce(s2.channel, 'retail') = 'retail'
          and to_char(s2.sold_at, 'YYYY-MM') = p_year_month
          and (p_store_id is null or s2.store_id = p_store_id)
      ),
      0
    )::bigint as sold_phones,
    coalesce(sum(s.total_amount), 0)::bigint as revenue,
    coalesce(sum(s.total_profit), 0)::bigint as profit
  from public.sales s
  where s.status = 'completed'
    and coalesce(s.channel, 'retail') = 'retail'
    and to_char(s.sold_at, 'YYYY-MM') = p_year_month
    and (p_store_id is null or s.store_id = p_store_id);
end;
$$;

grant execute on function public.report_inventory_monthly(text, uuid) to authenticated;

create or replace function public.report_inventory_yearly(
  p_year integer,
  p_store_id uuid default null
)
returns table (
  month integer,
  revenue bigint,
  profit bigint,
  sold bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_store_id is null and not public.is_owner() then
    p_store_id := public.my_store_id();
  end if;
  if p_store_id is not null and not public.is_owner()
     and p_store_id is distinct from public.my_store_id() then
    raise exception 'store_forbidden';
  end if;

  return query
  with months as (
    select generate_series(1, 12) as month
  ),
  sales_agg as (
    select
      extract(month from s.sold_at)::int as month,
      coalesce(sum(s.total_amount), 0)::bigint as revenue,
      coalesce(sum(s.total_profit), 0)::bigint as profit
    from public.sales s
    where s.status = 'completed'
      and coalesce(s.channel, 'retail') = 'retail'
      and extract(year from s.sold_at) = p_year
      and (p_store_id is null or s.store_id = p_store_id)
    group by 1
  ),
  phones_agg as (
    select
      extract(month from s.sold_at)::int as month,
      coalesce(sum(si.quantity), 0)::bigint as sold
    from public.sales s
    inner join public.sale_items si
      on si.sale_id = s.id
     and si.sale_status = 'completed'
     and si.item_type = 'phone'
    where s.status = 'completed'
      and coalesce(s.channel, 'retail') = 'retail'
      and extract(year from s.sold_at) = p_year
      and (p_store_id is null or s.store_id = p_store_id)
    group by 1
  )
  select
    m.month,
    coalesce(sa.revenue, 0)::bigint,
    coalesce(sa.profit, 0)::bigint,
    coalesce(pa.sold, 0)::bigint
  from months m
  left join sales_agg sa on sa.month = m.month
  left join phones_agg pa on pa.month = m.month
  order by m.month;
end;
$$;

grant execute on function public.report_inventory_yearly(integer, uuid) to authenticated;
