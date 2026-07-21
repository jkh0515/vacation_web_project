# 🚀 AI 기반 알고리즘 악질 저지(Judge) 및 리뷰 플랫폼

<div align="center">
  <h3>"단순한 문법 오류를 넘어, 치명적인 엣지 케이스(Edge Case)를 찾아내는 AI 채점 플랫폼"</h3>
</div>

---

## 📖 1. 기획 배경 및 문제 정의 (Background & Problem)
알고리즘 문제풀이 경험을 통해 기존 플랫폼들을 통한 학습의 한계를 느껴서 직접 만들게 되었습니다. 
- **기존의 한계**: ChatGPT 등 상용 AI는 코드를 잘 짜주지만, 유저가 제출한 코드의 논리적 반례(Edge Case)'나 '경계값(Boundary)'을 찾아내는 데는 매우 취약합니다.
- **해결책 (Our Solution)**: 
  1. 알고리즘 반례 생성에 특화된 데이터셋으로 **직접 파인튜닝한 LLM**을 구축합니다.
  2. 단순히 AI 프롬프트에 의존하는 것이 아니라, 실제 코드를 **샌드박스 환경에서 격리 실행(Judge)**하여 정확히 검증합니다.
  3. 클라우드 벤더에 종속되지 않는 **Cloud-Native / 오픈소스 기반의 마이크로서비스 아키텍처**를 설계하여 트래픽에 유연하게 대응합니다.

---

## 🏗 2. 시스템 아키텍처 (System Architecture)

```mermaid
graph TD
    User([User / Frontend]) -->|1. Submit Code & Image| API(Spring Boot Backend)
    API -->|2. Upload Image| MinIO[(MinIO Storage)]
    API -->|3. Save Submission| DB[(PostgreSQL)]
    API -.->|4. Push Task| RabbitMQ[(RabbitMQ Message Broker)]
    
    subgraph Async Workers
        Worker[Judge & AI Worker (Python)]
        RabbitMQ -.->|Consume Task| Worker
    end
    
    subgraph Private AI Server GPU
        vLLM[vLLM Inference]
        Paddle[PaddleOCR]
    end
    
    Worker -->|5. Image OCR| Paddle
    Worker -->|6. Gen Edge Cases| vLLM
    Worker -->|7. Run Code| DockerSandbox[Isolated Docker Sandbox]
    
    DockerSandbox -->|CPU/Memory limits, cap-drop| Result(Resource Stats)
    Result --> Worker
    Worker -->|8. Request Review| vLLM
    
    Worker -->|9. Update Status| API
    Worker -.->|10. Publish Event| RedisPubSub[(Redis Pub/Sub)]
    RedisPubSub -.-> API
    API -->|11. SSE Stream| User
```

---

## ✨ 3. 핵심 기능 및 워크플로우 (Core Workflow)
1. **문제 스캔 (OCR)**: 자체 AI 서버의 PaddleOCR이 MinIO에 업로드된 문제 캡처본에서 제약 조건을 정확히 추출.
2. **반례 생성 (AI Inference)**: 파인튜닝된 자체 LLM이 문제 조건을 분석, 통과하기 까다로운 엣지 케이스 데이터(5~10개) 생성.
3. **병렬 샌드박스 채점 (Judge Engine)**: 커스텀 Python 워커가 Docker API를 제어하여, 일회용 격리 컨테이너를 띄워 코드를 안전하게 채점.
4. **리뷰 분석 (AI Review)**: 채점 실패 시 오류 원인과 시간/공간 복잡도를 분석하여 리뷰 힌트 제공.
5. **실시간 피드백 (SSE)**: 각 테스트 케이스별 채점 진행 상황을 프론트엔드로 실시간 브로드캐스팅.

---

## 🛠 4. 기술 스택 및 엔지니어링 챌린지

### 4.1. 기술 스택 (Tech Stack)
- **Frontend**: React, Next.js, TailwindCSS
- **Backend API**: Java 17, Spring Boot, Spring Data JPA, Spring WebFlux (SSE)
- **Message Broker / Cache**: RabbitMQ (채점 비동기 큐), Redis (SSE 상태 브로드캐스팅)
- **Database / Storage**: PostgreSQL, MinIO (S3 호환)
- **Sandbox / DevOps**: Python Docker SDK, Docker Compose, Prometheus & Grafana (모니터링)
- **AI Server**: vLLM (Continuous Batching), QLoRA, PaddleOCR

### 4.2. 핵심 엔지니어링 주안점 (Engineering Highlights)
- **🛡️ 완벽한 샌드박스 보안 (Security Hardening)**: 
  악의적인 코드(Fork Bomb 등)로부터 호스트를 보호하기 위해 채점 컨테이너 실행 시 `--network none`, `--memory 256m`, `--pids-limit 64`, `--cap-drop=ALL` (리눅스 커널 권한 완전 회수) 옵션을 엄격하게 적용.
- **⚡ 이기종 언어(Polyglot) 간 비동기 분산 처리**: 
  Spring Boot(Java)의 안정적인 웹 응답 처리와 Python(AI/Worker)의 무거운 연산을 `RabbitMQ`를 통한 메시징으로 완벽히 분리하여 트래픽 병목을 방지.
- **👁️ 인프라 관측성 (Observability)**: 
  작업 큐 적재량, AI 서버 GPU 리소스, 채점 엔진 병목을 실시간 모니터링하기 위해 Prometheus와 Grafana 도입.

---

## 🗄️ 5. 데이터베이스 구조 (ERD 요약)
- **Users**: 유저 인증 및 권한 정보
- **Problems**: 알고리즘 문제 메타데이터 및 `image_url` (MinIO)
- **Submissions**: 제출 코드, 언어, 종합 결과
- **TestCases**: AI가 생성한 문제별 엣지 케이스 및 정답 데이터
- **SubmissionDetails (1:N)**: 각 테스트 케이스별 상세 채점 결과 (`Pass/Fail`, `exec_time`, `exec_memory`)
- **AiReviews**: 채점 종료 후 AI가 작성한 피드백 JSON

---

## 📂 6. 프로젝트 폴더 구조
```text
.
├── docker-compose.yml        # 전체 마이크로서비스 오케스트레이션 정의
├── monitoring/               # Prometheus, Grafana 설정 파일
├── frontend/                 # Next.js 프론트엔드
├── backend_api/              # Spring Boot 메인 웹 서버 (Java)
├── judge_worker/             # 커스텀 샌드박스 채점 엔진 (ARQ Worker)
│   └── runners/              # 격리 채점용 Base Docker 이미지 (C++, Python)
└── ai_server/                # GPU 가속 AI 추론 서버
```

---

## 🚀 7. 실행 방법 (Getting Started)

### 사전 요구 사항
- Docker, Docker Compose, Node.js (v18+)
- GPU 환경 (AI 서버 로컬 구동 시 필요)

### 실행 단계
1. **환경 변수 세팅**: `.env` 파일 설정 (DB, MinIO 접속 정보 등)
2. **인프라 통합 실행 (DB, Redis, MinIO, Backend, Worker, Monitoring)**
   ```bash
   docker-compose up -d
   ```
3. **AI 서버 구동 (GPU)**
   ```bash
   docker-compose --profile gpu up -d ai_server
   ```
4. **프론트엔드 구동**
   ```bash
   cd frontend && npm install && npm run dev
   ```
