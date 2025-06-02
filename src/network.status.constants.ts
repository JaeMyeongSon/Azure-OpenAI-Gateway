// 추후 백엔드 전체 에러코드를 정의할 때 사용할 상수 파일 (라이브러리로 분리할 예정)

// 아래 Custom Status Code 규칙 준수 (필요한 경우에만 추가 가능하며, 가급적 통상적으로 할당되지 않은 코드만 사용하세요.)
// 1xx: 정보 - 요청 수신, 프로세스 계속 관련
// 2xx: 성공 - 작업이 성공적으로 수신, 이해 및 수락된 경우 등
// 3xx: 리디렉션 관련 오류 - 추가 조치가 필요합니다. 리소스가 이전되었거나 일시적으로 사용할 수 없습니다.
// 4xx: 클라이언트 오류 - 요청에 잘못된 구문이 포함되어 있거나 요청을 처리 할 수 없는 경우
// 5xx: 서버 오류 - 서버가 명백히 유효한 요청을 이행하지 못한 경우 등.

export const ERROR_CODE = Object.freeze({
  NET_E_CONTENT_FILTER_UNSAFE: 428, // Content Filter Unsafe
  NET_E_TOO_MANY_REQUESTS: 429, // Rate Limit Exceeded (Azure OpenAI)
});

export const ERROR_MESSAGE = (error: number) => {
  switch (error) {
    case ERROR_CODE.NET_E_TOO_MANY_REQUESTS:
      return "NET_E_TOO_MANY_REQUESTS";
    case ERROR_CODE.NET_E_CONTENT_FILTER_UNSAFE:
      return "NET_E_CONTENT_FILTER_UNSAFE";
    default:
      return "";
  }
};
