# Round Robin Loadbalancer

## Prerequisites

- Docker
- Docker Compose

## How to run

```bash
docker compose up -d
```

## How to test

1. `localhost:8081/docs` 로 접속
2. Swagger UI에서 `GET /` 엔드포인트를 호출하여 라운드 로빈 로드밸런싱을 확인합니다.
