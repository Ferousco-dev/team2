"""Read-only API smoke checks. Does not register users or submit applications."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "https://opportunity-hub-web.onrender.com/api/"


def check(name, url, validate, timeout):
    print(f"Testing {name}...", end=" ", flush=True)
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise ValueError(f"unexpected HTTP status {response.status}")
            if "application/json" not in response.headers.get("Content-Type", ""):
                raise ValueError("response is not application/json")
            data = json.load(response)
            if not isinstance(data, dict) or not validate(data):
                raise ValueError(f"unexpected API response: {data.get('message', 'invalid shape') if isinstance(data, dict) else 'invalid shape'}")
        print("PASSED")
        return True
    except (urllib.error.URLError, ValueError, TimeoutError, OSError) as error:
        print(f"FAILED ({error})")
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.getenv("API_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--timeout", type=float, default=90)
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    print(f"=== OpportunityHub API verification ===\nTarget: {base}\n")
    checks = [
        ("opportunity list", "opportunities.php", lambda data: data.get("success") is True and isinstance(data.get("opportunities"), list)),
        ("filtered opportunities", "opportunities.php?keyword=frontend", lambda data: data.get("success") is True and isinstance(data.get("opportunities"), list)),
        ("session check", "auth.php?action=me", lambda data: isinstance(data.get("loggedIn"), bool) and data.get("success") is not False),
    ]
    results = [check(name, f"{base}/{endpoint}", validate, args.timeout) for name, endpoint, validate in checks]
    print(f"\n{sum(results)}/{len(results)} checks passed.")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
