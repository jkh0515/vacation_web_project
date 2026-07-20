import asyncio
import docker
from arq import Worker

# Initialize Docker client (connects to the host daemon or docker-in-docker)
try:
    client = docker.from_env()
    print("Successfully connected to Docker daemon.")
except Exception as e:
    print(f"Failed to connect to Docker daemon: {e}")

async def run_judge(ctx, submission_id: int, code: str, language: str):
    print(f"Judging submission {submission_id} in {language}...")
    # TODO: Implement actual container spinning logic here
    # Example:
    # client.containers.run(
    #     image="python:3.10-slim",
    #     command=["python", "-c", code],
    #     network_mode="none",
    #     mem_limit="256m",
    #     pids_limit=64,
    #     cap_drop=["ALL"],
    #     remove=True
    # )
    return {"status": "success", "message": f"Evaluated {language} code."}

class WorkerSettings:
    functions = [run_judge]
    # In production, read from REDIS_URL environment variable
    # For now, this is a placeholder matching the docker-compose setup
    redis_settings = "redis://redis:6379/0"
