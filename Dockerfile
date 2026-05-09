FROM node:20-slim
RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN git clone --branch claude/chart-testing-recorder-NHYqc --single-branch \
    https://github.com/LydiaXuan/AI-project-26.git .
EXPOSE 5000
CMD ["node", "server.js"]
