FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && mkdir -p /app/data \
    && chown 10001:10001 /app/data
COPY server.py puzzle.py polyomino.py mindlogic.py ./
COPY web/ ./web/
COPY templates/ ./templates/
COPY puzzle/ ./puzzle/
USER 10001:10001
EXPOSE 8008
CMD ["python", "-u", "server.py", "--host", "0.0.0.0"]
