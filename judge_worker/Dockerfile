FROM python:3.10-slim

# Install docker CLI so the worker can launch sandbox containers
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure the worker can run python commands directly
ENTRYPOINT ["python", "worker.py"]
