FROM python:3.12-slim

WORKDIR /app

# No system dependencies needed (no PostgreSQL, no gcc, no libpq-dev)
# Pillow needs minimal deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ /app/app/

# Cloud Run injects the PORT env variable
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
