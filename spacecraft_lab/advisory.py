"""Bounded, deterministic preliminary-design and cash-flow advisory calculators.

These pure functions use hypothetical/user-supplied inputs. They neither read
market data nor issue engineering, spacecraft, investment, or trading commands.
"""
import math


ENGINEERING_DEFAULTS = {
    'dry_mass_kg': 120, 'propellant_mass_kg': 20, 'isp_seconds': 220,
    'power_w': 120, 'eclipse_minutes': 35, 'battery_wh': 200,
    'usable_fraction': .8,
}
ECONOMY_DEFAULTS = {
    'initial_cost': 2000000, 'annual_revenue': 800000,
    'annual_operating_cost': 350000, 'discount_rate': .1,
    'years': 5, 'downside_fraction': .25,
}


def _inputs(data, defaults):
    if not isinstance(data, dict) or set(data) - set(defaults):
        raise ValueError('Expected an object containing only the documented calculator fields')
    return {**defaults, **data}


def _number(value, key, low, high, *, low_open=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f'{key} must be a finite number')
    try:
        number = float(value)
    except (OverflowError, ValueError):
        raise ValueError(f'{key} must be a finite bounded number') from None
    if not math.isfinite(number) or number > high or number < low or (low_open and number == low):
        bracket = '(' if low_open else '['
        raise ValueError(f'{key} must be in {bracket}{low}, {high}]')
    return number


def engineering_assessment(data):
    """Ideal rocket delta-v and constant-load eclipse energy, with explicit units."""
    values = _inputs(data, ENGINEERING_DEFAULTS)
    limits = {
        'dry_mass_kg': (.001, 1000000), 'propellant_mass_kg': (0, 1000000),
        'isp_seconds': (1, 10000), 'power_w': (0, 10000000),
        'eclipse_minutes': (0, 10080), 'battery_wh': (0, 1000000000),
        'usable_fraction': (0, 1),
    }
    inputs = {key: _number(values[key], key, *limit, low_open=key == 'usable_fraction')
              for key, limit in limits.items()}
    # log1p avoids loss of precision when the propellant fraction is very small.
    delta_v = 9.80665 * inputs['isp_seconds'] * math.log1p(
        inputs['propellant_mass_kg'] / inputs['dry_mass_kg'])
    required = inputs['power_w'] * inputs['eclipse_minutes'] / 60
    margin = inputs['battery_wh'] * inputs['usable_fraction'] - required
    if margin < 0:
        assessment = (f'The supplied constant-load eclipse case has a {-margin:.2f} Wh energy deficit. '
                      'Explore a lower eclipse load, shorter eclipse, or greater usable storage, then '
                      'check discharge power, losses, thermal behavior and aging in a detailed model.')
    elif margin == 0:
        assessment = ('The supplied energy budget balances with zero positive reserve. Explore additional '
                      'margin and verify discharge power, losses, temperature and aging before design selection.')
    else:
        assessment = (f'The supplied constant-load case leaves {margin:.2f} Wh of modeled energy reserve. '
                      'Verify peak discharge power, losses, thermal limits and end-of-life capacity; '
                      'positive energy reserve alone does not establish mission feasibility.')
    return {
        'schema_version': 'engineering-advisory-1.0',
        'source': 'SYNTHETIC / design inputs', 'inputs': inputs,
        'delta_v_m_s': delta_v, 'required_eclipse_wh': required,
        'battery_margin_wh': margin, 'assessment': assessment,
        'assumptions': [
            'Ideal single-stage Tsiolkovsky equation: delta_v = 9.80665 m/s² × Isp(s) × ln((dry + propellant)/dry).',
            'All supplied propellant is consumed at constant effective specific impulse; dry mass is constant.',
            'Eclipse energy (Wh) = constant load (W) × eclipse duration (minutes) / 60.',
            'Usable battery energy (Wh) = nameplate energy (Wh) × user-supplied usable fraction; zero solar credit.',
            'This standalone calculator does not alter the existing spacecraft simulation or its safety gates.',
        ],
        'limitations': [
            'Preliminary arithmetic only; not flight-qualified or a maneuver/launch trajectory solution.',
            'No gravity, drag, finite-burn, staging, reserve-propellant, residual or propulsion efficiency model.',
            'No peak-current/rate limits, conversion loss, recharge, thermal coupling, battery degradation or uncertainty propagation.',
        ],
        'references': [
            'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/',
            'https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/',
        ],
    }


def economy_assessment(data):
    """Three fixed-input project cash-flow sensitivities; no market prediction."""
    values = _inputs(data, ECONOMY_DEFAULTS)
    years = values['years']
    if isinstance(years, bool) or not isinstance(years, int) or not 1 <= years <= 30:
        raise ValueError('years must be an integer from 1 to 30')
    inputs = {key: _number(values[key], key, 0, 1000000000000)
              for key in ('initial_cost', 'annual_revenue', 'annual_operating_cost')}
    inputs.update(discount_rate=_number(values['discount_rate'], 'discount_rate', 0, 1),
                  years=years,
                  downside_fraction=_number(values['downside_fraction'], 'downside_fraction', 0, 1))
    fraction = inputs['downside_fraction']
    discount_factor = sum(1 / (1 + inputs['discount_rate']) ** year for year in range(1, years + 1))
    scenarios = []
    for name, revenue_factor, cost_factor in (
        ('Downside', 1 - fraction, 1 + fraction),
        ('Base', 1, 1), ('Upside', 1 + fraction, 1 - fraction),
    ):
        revenue = inputs['annual_revenue'] * revenue_factor
        operating_cost = inputs['annual_operating_cost'] * cost_factor
        net_cash = revenue - operating_cost
        scenarios.append({
            'name': name, 'annual_revenue': revenue,
            'annual_operating_cost': operating_cost, 'annual_net_cash': net_cash,
            'npv': -inputs['initial_cost'] + net_cash * discount_factor,
        })
    downside, base, _ = scenarios
    if base['npv'] < 0:
        recommendation = ('The base-case NPV is negative under the supplied assumptions. Revisit capital cost, '
                          'revenue evidence, operating costs and the chosen discount rate before advancing '
                          'this project scenario; an upside sensitivity does not establish viability.')
    elif downside['npv'] < 0:
        recommendation = ('The base-case NPV is nonnegative, while the supplied downside sensitivity is negative. '
                          'Prioritize revenue/cost validation and contingency funding before treating the '
                          'project economics as robust.')
    else:
        recommendation = ('The supplied scenarios have nonnegative NPV' +
                          (' and positive modeled value. ' if base['npv'] > 0 else ' with zero modeled base-case value. ') +
                          'Validate customer demand, costs, schedule and failure exposure before a funding decision; '
                          'these selected sensitivities are not probabilities or investment forecasts.')
    return {
        'schema_version': 'economy-advisory-1.0',
        'source': 'SYNTHETIC / user-defined USD cash-flow inputs',
        'inputs': inputs, 'scenarios': scenarios, 'recommendation': recommendation,
        'assumptions': [
            'USD nominal unlevered constant annual cash flows; initial capital cost occurs at time zero.',
            'Annual net cash = revenue − operating cost, received at each year end.',
            'NPV = −initial cost + sum(annual net cash / (1 + discount rate)^year).',
            'The discount rate is user supplied and is not a recommended market rate.',
            'Downside reduces revenue and increases operating cost by the selected fraction; upside reverses those changes.',
        ],
        'limitations': [
            'A project scenario calculator, not personalized securities advice, market research or a trading recommendation.',
            'No live market prices, financial news, audited space-sector costs or external economic data are loaded.',
            'Excludes taxes, financing, inflation escalation, launch/mission failure, delays, replacement, salvage, exit value and working capital.',
            'Three chosen sensitivities do not estimate an outcome distribution, success probability or risk-adjusted return.',
        ],
        'references': ['https://doi.org/10.6028/NIST.HB.135e2025'],
    }
