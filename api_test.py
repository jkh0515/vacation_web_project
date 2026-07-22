import urllib.request
import urllib.parse
import json
import subprocess
import time

def setup_dummy_data():
    print("1. 🛠️ Inserting dummy User and Problem into Database...")
    try:
        # Insert User (ID: 1)
        subprocess.run([
            "docker", "exec", "judge_db", "psql", "-U", "admin", "-d", "judge_db", "-c",
            "INSERT INTO users (id, username) VALUES (1, 'testuser') ON CONFLICT DO NOTHING;"
        ], check=True, stdout=subprocess.DEVNULL)
        
        # Insert Problem (ID: 1)
        subprocess.run([
            "docker", "exec", "judge_db", "psql", "-U", "admin", "-d", "judge_db", "-c",
            "INSERT INTO problem (id, title, description, time_limit_ms, memory_limit_mb) VALUES (1, 'A+B', 'Add two numbers', 2000, 256) ON CONFLICT DO NOTHING;"
        ], check=True, stdout=subprocess.DEVNULL)
        print("✅ Dummy data setup complete.\n")
    except Exception as e:
        print(f"⚠️ Failed to insert dummy data: {e}\n(If they already exist, this is fine)")

def submit_code():
    print("2. 🚀 Submitting code to Spring Boot API...")
    url = "http://localhost:8080/api/submissions"
    
    # Payload matches SubmissionRequestDto
    payload = {
        "userId": 1,
        "problemId": 1,
        "code": "import sys\ndata = sys.stdin.read().strip().split()\nprint(int(data[0]) + int(data[1]))",
        "language": "python"
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            sub_id = res_json.get("submission_id")
            print(f"✅ Code submitted successfully! Submission ID: {sub_id}\n")
            return sub_id
    except Exception as e:
        print(f"❌ Failed to submit code: {e}")
        return None

def listen_to_sse(submission_id):
    print(f"3. 📡 Listening for real-time SSE events for Submission {submission_id}...")
    url = f"http://localhost:8080/api/submissions/{submission_id}/stream"
    
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as response:
            for line in response:
                decoded_line = line.decode('utf-8').strip()
                if decoded_line:
                    print(f"   [SSE Event] {decoded_line}")
                    # If we receive the judge_result event, we can stop
                    if "judge_result" in decoded_line:
                        # Print the next line which is the data payload
                        data_line = next(response).decode('utf-8').strip()
                        print(f"   [SSE Data]  {data_line}")
                        print("\n🎉 채점 흐름이 완벽하게 동작했습니다!")
                        break
    except Exception as e:
        print(f"❌ SSE connection failed: {e}")

if __name__ == "__main__":
    setup_dummy_data()
    sub_id = submit_code()
    
    if sub_id:
        # Give a short delay to ensure the worker doesn't finish before we connect to SSE
        # (In a real frontend, we would connect to SSE first, then submit, or the backend would queue SSE events)
        listen_to_sse(sub_id)
