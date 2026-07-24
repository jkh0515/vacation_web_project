import json
import time
import docker
import pika
import redis
import os

# Initialize Docker client
try:
    client = docker.from_env()
    print("Successfully connected to Docker daemon.")
except Exception as e:
    print(f"Failed to connect to Docker daemon: {e}")
    exit(1)

# Initialize Redis client for SSE broadcasting
try:
    redis_host = os.environ.get('REDIS_HOST', 'localhost')
    redis_port = int(os.environ.get('REDIS_PORT', 6379))
    redis_password = os.environ.get('REDIS_PASSWORD', None)
    
    redis_client = redis.Redis(host=redis_host, port=redis_port, password=redis_password, db=0, decode_responses=True)
    redis_client.ping()
    print(f"Successfully connected to Redis at {redis_host}.")
except Exception as e:
    print(f"Failed to connect to Redis: {e}")

def run_judge(submission_id: int, code: str, language: str, input_data: str = "", expected_output: str = "", timeout: int = 2):
    print(f"Judging submission {submission_id} in {language}...")
    
    if language.lower() != "python":
        return {"status": "error", "message": "Only python is supported in Phase 3."}

    start_time = time.time()
    
    wrapper_script = (
        "import os, sys, subprocess\n"
        "with open('main.py', 'w', encoding='utf-8') as f:\n"
        "    f.write(os.environ.get('CODE', ''))\n"
        "with open('input.txt', 'w', encoding='utf-8') as f:\n"
        "    f.write(os.environ.get('INPUT_DATA', ''))\n"
        "res = subprocess.run(['python', 'main.py'], stdin=open('input.txt', 'r'), capture_output=True, text=True)\n"
        "sys.stdout.write(res.stdout)\n"
        "sys.stderr.write(res.stderr)\n"
        "sys.exit(res.returncode)\n"
    )
    
    try:
        container = client.containers.run(
            image="python:3.10-slim",
            command=["python", "-c", wrapper_script],
            environment={"CODE": code, "INPUT_DATA": input_data},
            network_mode="none",
            mem_limit="256m",
            pids_limit=64,
            cap_drop=["ALL"],
            detach=True
        )
        
        try:
            result = container.wait(timeout=timeout)
            exit_code = result['StatusCode']
            stdout = container.logs(stdout=True, stderr=False).decode('utf-8')
            stderr = container.logs(stdout=False, stderr=True).decode('utf-8')
            
            if exit_code != 0:
                status = "ERROR"
                output = stderr
            else:
                output = stdout
                # Check if it matches expected answer
                if expected_output and output.strip() == expected_output.strip():
                    status = "SUCCESS"
                else:
                    status = "FAIL"
        except Exception as wait_err:
            container.kill()
            status = "timeout"
            output = "Execution timed out."
            exit_code = 124
        finally:
            container.remove(force=True)
            
    except Exception as e:
        status = "system_error"
        output = str(e)
        exit_code = -1

    exec_time = time.time() - start_time
    return {
        "submission_id": submission_id,
        "status": status,
        "output": output,
        "exec_time": round(exec_time, 3),
        "exit_code": exit_code
    }

def callback(ch, method, properties, body):
    try:
        data = json.loads(body)
        submission_id = data.get("submission_id")
        code = data.get("code")
        language = data.get("language", "python")
        input_data = data.get("input_data", "")
        expected_output = data.get("expected_output", "")
        timeout = data.get("timeout", 2)
        
        # Run judge logic synchronously
        result = run_judge(submission_id, code, language, input_data, expected_output, timeout)
        
        # Publish result to Redis
        redis_client.publish('judge_events', json.dumps(result))
        print(f"Published result to Redis: {result}")
        
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"Error processing message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def main():
    # Connect to RabbitMQ
    # Retry mechanism could be added here for production readiness
    rabbitmq_host = os.environ.get('RABBITMQ_HOST', 'localhost')
    rabbitmq_port = int(os.environ.get('RABBITMQ_PORT', 5672))
    rabbitmq_user = os.environ.get('RABBITMQ_USERNAME', 'guest')
    rabbitmq_pass = os.environ.get('RABBITMQ_PASSWORD', 'guest')
    
    credentials = pika.PlainCredentials(rabbitmq_user, rabbitmq_pass)
    
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=rabbitmq_host, port=rabbitmq_port, credentials=credentials)
    )
    channel = connection.channel()
    
    # Declare queue
    channel.queue_declare(queue='judge_queue', durable=True)
    channel.basic_qos(prefetch_count=1)
    
    # Start consuming
    channel.basic_consume(queue='judge_queue', on_message_callback=callback)
    
    print(' [*] Waiting for messages. To exit press CTRL+C')
    channel.start_consuming()

if __name__ == '__main__':
    main()
