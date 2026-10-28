"""SI/Wh reference balances. All engineering coefficients are scenario assumptions."""
import math

SIGMA = 5.670374419e-8  # W m^-2 K^-4, SI Stefan–Boltzmann constant


def _finite(*values):
    if any(type(v) not in (int,float) or not math.isfinite(v) for v in values):
        raise ValueError('Reference equations require finite numbers')


def power_step(battery_wh, capacity_wh, solar_w, demand_w, dt_seconds,
               charge_efficiency, discharge_efficiency, charge_limit_w, discharge_limit_w):
    _finite(battery_wh,capacity_wh,solar_w,demand_w,dt_seconds,charge_efficiency,
            discharge_efficiency,charge_limit_w,discharge_limit_w)
    if (capacity_wh <= 0 or not 0 <= battery_wh <= capacity_wh or min(solar_w,demand_w,charge_limit_w,discharge_limit_w)<0
            or dt_seconds <= 0 or not 0 < charge_efficiency <= 1 or not 0 < discharge_efficiency <= 1):
        raise ValueError('Nonphysical EPS input')
    h = dt_seconds/3600
    direct = min(solar_w,demand_w)
    charge_input_w = min(solar_w-direct,charge_limit_w,(capacity_wh-battery_wh)/(charge_efficiency*h))
    discharge_bus_w = min(demand_w-direct,discharge_limit_w,battery_wh*discharge_efficiency/h)
    stored_wh = charge_input_w*charge_efficiency*h
    removed_wh = discharge_bus_w/discharge_efficiency*h
    after = min(capacity_wh,max(0,battery_wh+stored_wh-removed_wh))
    curtailed_w = solar_w-direct-charge_input_w
    served_w = direct+discharge_bus_w
    loss_wh = (charge_input_w*h-stored_wh)+(removed_wh-discharge_bus_w*h)
    residual = battery_wh+solar_w*h-after-served_w*h-curtailed_w*h-loss_wh
    return dict(battery_wh=after,served_w=served_w,unserved_w=demand_w-served_w,
                charge_input_w=charge_input_w,discharge_bus_w=discharge_bus_w,
                curtailed_w=curtailed_w,conversion_loss_wh=loss_wh,balance_residual_wh=residual)


def radiated_power(temperature_k,sink_k,emissivity,area_m2):
    _finite(temperature_k,sink_k,emissivity,area_m2)
    if min(temperature_k,sink_k,area_m2)<0 or not 0 <= emissivity <= 1:
        raise ValueError('Radiation requires nonnegative absolute temperatures/area and emissivity [0,1]')
    return emissivity*SIGMA*area_m2*(temperature_k**4-sink_k**4)


def thermal_step(temperature_k,heat_w,sink_k,emissivity,area_m2,capacity_j_per_k,dt_seconds):
    _finite(heat_w,capacity_j_per_k,dt_seconds)
    if capacity_j_per_k <= 0 or dt_seconds <= 0 or heat_w < 0:
        raise ValueError('Thermal capacity/time must be positive and heating nonnegative')
    loss_w = radiated_power(temperature_k,sink_k,emissivity,area_m2)
    stored_j = (heat_w-loss_w)*dt_seconds
    after = temperature_k+stored_j/capacity_j_per_k
    if after <= 0 or not math.isfinite(after):
        raise ValueError('Thermal integration left physical range; reduce timestep or revise inputs')
    residual = heat_w*dt_seconds-loss_w*dt_seconds-capacity_j_per_k*(after-temperature_k)
    return dict(temperature_k=after,radiated_w=loss_w,stored_heat_j=stored_j,balance_residual_j=residual)
