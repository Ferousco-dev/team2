import requests
import json

# Replace with your local XAMPP/Postgres URL or your Render URL
# Example: "https://your-app.onrender.com/api"
BASE_URL = "http://localhost/OpportunityHub/api"

def test_json_response(name, url, method="GET", data=None, files=None):
    print(f"Testing {name}...", end=" ")
    try:
        if method == "GET":
            response = requests.get(url, timeout=5)
        else:
            if files:
                response = requests.post(url, data=data, files=files, timeout=5)
            else:
                response = requests.post(url, json=data, timeout=5)

        # Check if content type is JSON
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' not in content_type:
            print(f"\033[91mFAILED\033[0m (Invalid Content-Type: {content_type})")
            return False

        # Try parsing JSON
        try:
            result = response.json()
            print("\033[92mPASSED\033[0m")
            return True
        except json.JSONDecodeError:
            print("\033[91mFAILED\033[0m (Response is not valid JSON)")
            return False

    except Exception as e:
        print(f"\033[91mERROR\033[0m ({str(e)})")
        return False

def run_suite():
    print("=== OpportunityHub Backend Verification Suite ===")
    print(f"Target: {BASE_URL}\n")

    # Check if DB connection works (Opportunities will fail if DB is down)
    test_json_response("GET Opportunities", f"{BASE_URL}/opportunities.php")

    # Check Auth endpoints
    test_json_response("GET Auth Me (Session Check)", f"{BASE_URL}/auth.php?action=me")

    # Check failure handling (Invalid Action)
    test_json_response("POST Auth (Invalid Action)", f"{BASE_URL}/auth.php?action=invalid", method="POST", data={})

if __name__ == "__main__":
    run_suite()
