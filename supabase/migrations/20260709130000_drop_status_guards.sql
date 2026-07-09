-- Allow plain INSERT/UPDATE of phones/accessories status from app SQL.
-- Previously triggers required set_config('app.skip_status_guard') or RPC only,
-- which fails easily under transaction pooler / manual SQL.

drop trigger if exists phones_guard_status on public.phones;
drop trigger if exists accessories_guard_status on public.accessories;

create or replace function public.guard_phone_status()
returns trigger
language plpgsql
as $$
begin
  -- No-op: status may be changed by app or SQL directly.
  return new;
end;
$$;

create or replace function public.guard_accessory_status()
returns trigger
language plpgsql
as $$
begin
  -- No-op: status may be changed by app or SQL directly.
  return new;
end;
$$;
