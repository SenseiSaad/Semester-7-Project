#!/usr/bin/env python3
"""Backbencher abuse-test: Kamran Shah (2022-CS-010) tries to cheat AttendWise.

Run while the dev servers are up:
  backend  http://127.0.0.1:8000
  frontend http://127.0.0.1:5173
"""
import json
import sys
import time

import requests

API = 'http://127.0.0.1:8000/api'
FRONT = 'http://127.0.0.1:5173'

PASS_COUNT = 0
FAIL_COUNT = 0


def check(name, cond, extra=''):
    global PASS_COUNT, FAIL_COUNT
    if cond:
        PASS_COUNT += 1
        print(f'  ✓ {name}')
    else:
        FAIL_COUNT += 1
        print(f'  ✗ FAIL: {name} {extra}')


def jprint(d):
    return json.dumps(d, ensure_ascii=False)[:200]


def main():
    t = requests.Session()   # teacher client
    k = requests.Session()   # Kamran (backbencher)
    a = requests.Session()   # Ahmed (innocent classmate)

    print('— setup: teacher + innocent student log in —')
    r = t.post(f'{API}/auth/token/', json={'email': 'teacher@uni.edu', 'password': 'teach1234'})
    check('teacher login', r.status_code == 200, r.text[:120])
    t.headers['Authorization'] = 'Bearer ' + r.json()['access']

    r = a.post(f'{API}/auth/token/', json={'email': '2022-cs-001@uni.edu', 'password': 'study1234'})
    check('ahmed login', r.status_code == 200, r.text[:120])
    a.headers['Authorization'] = 'Bearer ' + r.json()['access']
    ahmed_device = 'ahmed-phone-token-abc123'
    r = a.post(f'{API}/devices/register/', json={'device_token': ahmed_device})
    check('ahmed registers his phone', r.status_code == 200, r.text[:120])

    print('— recon: anonymous probing —')
    r = requests.get(f'{API}/courses/')
    check('anon /courses/ → 401', r.status_code == 401)
    r = requests.get(f'{API}/violations/')
    check('anon /violations/ → 401', r.status_code == 401)
    r = requests.get(f'{API}/me/summary/')
    check('anon /me/summary/ → 401', r.status_code == 401)
    r = requests.post(f'{API}/attendance/scan/', json={'code': '1.2.3'})
    check('anon scan → 401', r.status_code == 401)

    print('— signup: claim code games —')
    r = k.post(f'{API}/auth/register/', json={
        'email': 'kamran@uni.edu', 'name': 'Kamran Shah',
        'student_id': '2022-CS-010', 'claim_code': 'WRONGCODE', 'password': 'backbench1'})
    check('bogus claim code rejected', r.status_code == 400, r.text[:120])

    # find Kamran's real CS-301 claim code from the teacher roster
    courses = t.get(f'{API}/courses/').json()
    cs301 = next(c for c in courses if c['code'] == 'CS-301')
    roster = t.get(f"{API}/courses/{cs301['id']}/roster/").json()['roster']
    kamran_row = next(e for e in roster if e['student_id'] == '2022-CS-010')
    real_code = kamran_row['claim_code']

    r = k.post(f'{API}/auth/register/', json={
        'email': 'kamran@uni.edu', 'name': 'Kamran Shah',
        'student_id': '2022-CS-999', 'claim_code': real_code, 'password': 'backbench1'})
    check('claim code + mismatched student ID rejected', r.status_code == 400, r.text[:120])

    r = k.post(f'{API}/auth/register/', json={
        'email': '2022-cs-001@uni.edu', 'name': 'Fake Ahmed',
        'student_id': '2022-CS-010', 'claim_code': real_code, 'password': 'backbench1'})
    check('duplicate email rejected', r.status_code == 400, r.text[:120])

    r = k.post(f'{API}/auth/register/', json={
        'email': 'kamran@uni.edu', 'name': "Kamran '; DROP TABLE users;--",
        'student_id': '2022-CS-010', 'claim_code': real_code.lower(), 'password': 'backbench1'})
    check('registration ok (code case-insensitive)', r.status_code == 201, r.text[:200])

    r = k.post(f'{API}/auth/register/', json={
        'email': 'kamran2@uni.edu', 'name': 'Kamran Again',
        'student_id': '2022-CS-010', 'claim_code': real_code, 'password': 'backbench1'})
    check('claim code reuse rejected', r.status_code == 400, r.text[:120])

    r = k.post(f'{API}/auth/token/', json={'email': 'kamran@uni.edu', 'password': 'backbench1'})
    check('kamran login', r.status_code == 200, r.text[:120])
    k.headers['Authorization'] = 'Bearer ' + r.json()['access']
    me = k.get(f'{API}/auth/me/').json()
    check('registration claimed ALL his roster rows', me['student_id'] == '2022-CS-010')

    summary = k.get(f'{API}/me/summary/').json()['courses']
    check(f'kamran enrolled in all courses ({len(summary)})', len(summary) == 3,
          jprint(summary))

    print('— kamran tries teacher powers with his student JWT —')
    check('create course → 403', t is not None and
          k.post(f'{API}/courses/', json={'name': 'Hack', 'code': 'HACK-1'}).status_code == 403)
    check('violations log → 403', k.get(f'{API}/violations/').status_code == 403)
    check("ahmed's eligibility → 403", k.get(f"{API}/courses/{cs301['id']}/eligibility/").status_code == 403)
    check('import roster → 403',
          k.post(f"{API}/courses/{cs301['id']}/roster/", json={'csv': 'X,Y'}).status_code == 403)
    r = k.post(f'{API}/sessions/', json={'course': cs301['id']})
    check('open session → 403', r.status_code == 403)
    r = k.get(f"{API}/sessions/{cs301['id']}/qr/") if False else None  # no open session yet
    # tampered JWT
    bad = k.headers['Authorization'][:-4] + 'beef'
    r = requests.get(f'{API}/auth/me/', headers={'Authorization': bad})
    check('tampered JWT → 401', r.status_code == 401)

    print('— first scan attempt: no registered device —')
    # teacher opens CS-301 session
    r = t.post(f'{API}/sessions/', json={'course': cs301['id']})
    if r.status_code == 409:  # open already (idempotent test runs)
        session_id = r.json()['session']['id']
    else:
        session_id = r.json()['id']
    qr = t.get(f'{API}/sessions/{session_id}/qr/').json()
    code0 = qr['code']

    r = k.post(f'{API}/attendance/scan/', json={'code': code0, 'device_token': ''})
    check('scan without device → 403 violation', r.status_code == 403 and
          r.json().get('reason') == 'unregistered_device', r.text[:150])
    vlog = t.get(f'{API}/violations/').json()['violations']
    check('violation logged', any(v['student_id'] == '2022-CS-010' for v in vlog))
    notes = k.get(f'{API}/notifications/').json()['notifications']
    check('kamran warned in-app', any('violation' in n['message'] for n in notes))

    print('— QR tampering & expiry (no violations expected) —')
    tampered = code0[:-1] + ('0' if code0[-1] != '0' else '1')
    r = k.post(f'{API}/attendance/scan/', json={'code': tampered, 'device_token': 'whatever'})
    check('tampered signature rejected', r.status_code == 400 and r.json().get('reason') == 'invalid',
          r.text[:150])
    r = k.post(f'{API}/attendance/scan/', json={'code': '9999.1111111111.' + 'a' * 32,
                                                'device_token': 'whatever'})
    check('fabricated code rejected', r.status_code == 400)
    vcount_now = len(t.get(f'{API}/violations/').json()['violations'])
    r = k.post(f'{API}/attendance/scan/', json={'code': code0[:-1] + ('0' if code0[-1] != '0' else '1'),
                                                'device_token': 'whatever'})
    check('no violation for forged codes',
          len(t.get(f'{API}/violations/').json()['violations']) == vcount_now)

    print('— legit device, legit scan —')
    kamran_device = 'kamran-phone-token-xyz789'
    r = k.post(f'{API}/devices/register/', json={'device_token': kamran_device})
    check('kamran registers device', r.status_code == 200, r.text[:120])

    qr = t.get(f'{API}/sessions/{session_id}/qr/').json()  # fresh code
    r = k.post(f'{API}/attendance/scan/', json={'code': qr['code'], 'device_token': kamran_device})
    check('legit scan → present', r.status_code == 201 and r.json()['status'] == 'present',
          r.text[:150])

    r = k.post(f'{API}/attendance/scan/', json={'code': qr['code'], 'device_token': kamran_device})
    check('re-scan → already_marked, no penalty', r.status_code == 200 and
          r.json()['status'] == 'already_marked', r.text[:150])

    print('— QR replay: the 40-second-old screenshot —')
    print('  (waiting 42s — codes stay valid for the current + 1 grace window…)')
    time.sleep(42)
    r = k.post(f'{API}/attendance/scan/', json={'code': code0, 'device_token': kamran_device})
    check('expired code rejected', r.status_code == 400 and r.json().get('reason') == 'expired',
          r.text[:150])
    vcount_now = len(t.get(f'{API}/violations/').json()['violations'])
    check('no violation for expired code', len(t.get(f'{API}/violations/').json()['violations']) == vcount_now)

    print('— device sharing: kamran steals ahmed\'s device token —')
    r = k.post(f'{API}/devices/register/', json={'device_token': ahmed_device})
    check('duplicate token registration accepted (detectable at scan)', r.status_code == 200,
          r.text[:120])

    # a genuinely fresh session: the first one is closed so the 409 fallback can't bite
    t.post(f'{API}/sessions/{session_id}/close/')
    r = t.post(f'{API}/sessions/', json={'course': cs301['id']})
    check('fresh session opened', r.status_code == 201, r.text[:150])
    session2 = r.json()['id']
    r = a.post(f'{API}/attendance/scan/',
               json={'code': t.get(f'{API}/sessions/{session2}/qr/').json()['code'],
                     'device_token': ahmed_device})
    check('ahmed (owner) scans fine', r.status_code == 201, r.text[:150])

    r = k.post(f'{API}/attendance/scan/',
               json={'code': t.get(f'{API}/sessions/{session2}/qr/').json()['code'],
                     'device_token': ahmed_device})
    check('kamran with ahmed\'s device → device_shared violation',
          r.status_code == 403 and r.json().get('reason') == 'device_shared', r.text[:150])
    check('kamran got NO attendance from it',
          not any(rec['student_id'] == '2022-CS-010'
                  for rec in t.get(f'{API}/sessions/{session2}/').json()['records']))

    notes = t.get(f'{API}/notifications/').json()['notifications']
    check('instructor notified on kamran\'s 2nd violation',
          any('2nd violation' in n['message'] and 'Kamran' in n['message'] for n in notes),
          jprint(notes))

    print('— closed session & wrong course —')
    t.post(f'{API}/sessions/{session2}/close/')
    qr2 = t.get(f'{API}/sessions/{session2}/qr/')
    check('QR endpoint refuses closed session', qr2.status_code == 400)

    # not enrolled: fresh course, kamran not on roster
    r = t.post(f'{API}/courses/', json={'name': 'Secret Seminar', 'code': 'SS-900',
                                        'eligibility_threshold': 75})
    secret_course = r.json()['id']
    t.post(f"{API}/courses/{secret_course}/roster/", json={'csv': '2022-CS-777,Someone Else'})
    r = t.post(f'{API}/sessions/', json={'course': secret_course})
    secret_session = r.json()['id']
    code = t.get(f'{API}/sessions/{secret_session}/qr/').json()['code']
    r = k.post(f'{API}/attendance/scan/', json={'code': code, 'device_token': kamran_device})
    check('not enrolled → rejected', r.status_code == 400 and
          r.json().get('reason') == 'not_enrolled', r.text[:150])

    print('— campus IP check —')
    r = t.post(f'{API}/courses/', json={'name': 'IP Course', 'code': 'IP-100'})
    ip_course = r.json()['id']
    t.post(f"{API}/courses/{ip_course}/roster/", json={'csv': '2022-CS-010,Kamran Shah'})
    r = t.post(f'{API}/sessions/', json={'course': ip_course})
    ip_session = r.json()['id']
    code = t.get(f'{API}/sessions/{ip_session}/qr/').json()['code']
    # kamran's registered token is currently the STOLEN one, so use that
    r = k.post(f'{API}/attendance/scan/', json={'code': code, 'device_token': ahmed_device})
    check('scan inside campus passes (127.*)', r.status_code == 201, r.text[:150])

    print('— teacher-side integrity —')
    # the earlier session was closed on purpose; manual edits only work on open ones
    r = t.post(f'{API}/sessions/', json={'course': cs301['id']})
    integrity_session = r.json()['id']
    r = k.post(f'{API}/attendance/scan/',
               json={'code': t.get(f'{API}/sessions/{integrity_session}/qr/').json()['code'],
                     'device_token': ahmed_device})
    check('kamran has a QR record to edit', r.status_code == 201, r.text[:150])
    recs = t.get(f'{API}/sessions/{integrity_session}/records/').json()['rows']
    kamran_rec = next(x for x in recs if x['student_id'] == '2022-CS-010' and x['record_id'])
    r = t.patch(f"{API}/attendance/records/{kamran_rec['record_id']}/",
                json={'status': 'absent', 'reason': 'x'})
    check('manual edit rejects short reason', r.status_code == 400, r.text[:120])
    r = t.patch(f"{API}/attendance/records/{kamran_rec['record_id']}/",
                json={'status': 'absent', 'reason': 'caught sleeping in the back row'})
    check('manual edit works with reason', r.status_code == 200 and
          r.json()['method'] == 'manual', r.text[:150])
    r = t.post(f'{API}/attendance/records/',
               json={'session': integrity_session, 'enrollment_id': 999999,
                     'status': 'present', 'reason': 'fake'})
    check('manual entry for bogus student rejected', r.status_code == 404)
    # frozen after close
    t.post(f'{API}/sessions/{integrity_session}/close/')
    r = t.patch(f"{API}/attendance/records/{kamran_rec['record_id']}/",
                json={'status': 'present', 'reason': 'too late, session closed'})
    check('closed session freezes records', r.status_code == 400)

    print('— frontend reachability —')
    r = requests.get(FRONT)
    check('vite serving app', r.status_code == 200 and 'attendwise' in r.text.lower())

    print(f'\n===== RESULT: {PASS_COUNT} passed, {FAIL_COUNT} failed =====')
    return 1 if FAIL_COUNT else 0


if __name__ == '__main__':
    sys.exit(main())
