import time, uuid, httpx
from jose import jwt as jose_jwt

HMS_APP_KEY = "69f12a91f8e80a674997e7f0"
HMS_APP_SECRET = "mBJ43bsDsBeO-e6OiIQymHaZguobvjDMEvfNa53TN-YthLE7WVa8hhnYMUtCzbaC1KABLVyo1IHiLjjIHrxzDcq6IhsjoQMJk-mtYvQGSJ8UKV4sYg_gchbbCcmY2U81qGub3FPThhVjkVqcnW2B-oitdsL91SMxBeMQNSCbKcw="
HMS_API = "https://api.100ms.live/v2"

def mgmt_token():
    now = int(time.time())
    return jose_jwt.encode({
        "access_key": HMS_APP_KEY,
        "type": "management",
        "version": 2,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + 86400,
    }, HMS_APP_SECRET, algorithm="HS256")

token = mgmt_token()

# List all rooms
rooms_resp = httpx.get(f"{HMS_API}/rooms", headers={"Authorization": f"Bearer {token}"}, timeout=10)
rooms = rooms_resp.json().get("data", [])
print(f"Found {len(rooms)} rooms\n")

# Test room codes for ALL rooms
for r in rooms:
    room_id = r["id"]
    name = r.get("name", "")
    print(f"Room: {name} ({room_id})")

    token2 = mgmt_token()
    resp = httpx.post(f"{HMS_API}/room-codes/room/{room_id}", headers={"Authorization": f"Bearer {token2}"}, timeout=10)
    print(f"  POST room-codes status: {resp.status_code}")
    data = resp.json().get("data", [])
    if data:
        for entry in data:
            print(f"  code={entry['code']} role={entry['role']} enabled={entry['enabled']}")
    else:
        print(f"  NO DATA: {resp.json()}")
    print()
