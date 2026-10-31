"""Security-critical helpers: signed rotating QR codes + eligibility math.

QR code format:  "<session_id>.<rotation_ts>.<hmac_prefix>"
  - rotation_ts  = unix time floored to the rotation window
  - hmac_prefix  = HMAC-SHA256(key=session.secret, msg="<session_id>.<rotation_ts>")[:32]
A code is accepted only if the signature verifies AND the rotation timestamp is
the current or the immediately previous window.
"""
import hashlib
import hmac
import math
import time

from django.conf import settings


def rotation_window(ts=None):
    step = settings.QR_ROTATION_SECONDS
    ts = time.time() if ts is None else ts
    return int(ts // step) * step


def sign(session, rotation):
    msg = f'{session.id}:{rotation}'.encode()
    sig = hmac.new(session.secret.encode(), msg, hashlib.sha256).hexdigest()[:32]
    return f'{session.id}.{rotation}.{sig}'


def make_code(session):
    return sign(session, rotation_window())


def parse_code(code):
    """Return (session_id, rotation) or None if malformed/forged."""
    if not isinstance(code, str):
        return None
    parts = code.strip().split('.')
    if len(parts) != 3:
        return None
    try:
        sid, rot = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    if rot < 0 or len(parts[2]) != 32 or not all(c in '0123456789abcdef' for c in parts[2]):
        return None
    return sid, rot


def verify_window(session, code):
    """Return dict(ok, expired, reason). Forgery and staleness are distinct."""
    parsed = parse_code(code)
    if parsed is None:
        return {'ok': False, 'expired': False, 'reason': 'invalid'}
    sid, rot = parsed
    if sid != session.id:
        return {'ok': False, 'expired': False, 'reason': 'invalid'}
    expected = sign(session, rot)  # recomputed with this session's secret
    if not hmac.compare_digest(expected.split('.')[-1], code.strip().split('.')[-1]):
        return {'ok': False, 'expired': False, 'reason': 'invalid'}
    step = settings.QR_ROTATION_SECONDS
    current = rotation_window()
    if rot not in (current, current - step):  # current window + one grace window
        return {'ok': False, 'expired': True, 'reason': 'expired'}
    return {'ok': True, 'expired': False, 'reason': ''}


def eligibility(present, held, threshold):
    """percentage/status/classes_needed/can_miss for one student in one course.

    status: eligible  -> pct >= threshold
            at_risk   -> within 5 points below threshold
            not_eligible -> anything lower
    """
    pct = (present / held * 100) if held > 0 else None
    if pct is None:
        status = 'no_data'
        classes_needed, can_miss = 0, 0
    elif pct >= threshold:
        status = 'eligible'
        classes_needed = 0
        can_miss = max(0, math.floor(present / (threshold / 100) - held))
    elif pct >= threshold - 5:
        status = 'at_risk'
        classes_needed = math.ceil((threshold / 100 * held - present) / (1 - threshold / 100))
        can_miss = 0
    else:
        status = 'not_eligible'
        classes_needed = math.ceil((threshold / 100 * held - present) / (1 - threshold / 100))
        can_miss = 0
    return {'percentage': pct, 'status': status,
            'classes_needed': classes_needed, 'can_miss': can_miss}
