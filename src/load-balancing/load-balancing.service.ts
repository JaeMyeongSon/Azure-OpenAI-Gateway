import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ERROR_CODE, ERROR_MESSAGE } from '../network.status.constants';
import { CircuitBreakerService } from './circuit-breaker.service';
import { InstanceConfigService, AiInstance } from './instance-config.service';

@Injectable()
export class LoadBalancingService {
  private readonly logger = new Logger(LoadBalancingService.name);

  private readonly instanceConfigService: InstanceConfigService;
  private readonly circuitBreakerService: CircuitBreakerService;
  constructor(instanceConfigService: InstanceConfigService, circuitBreakerService: CircuitBreakerService) {
      this.instanceConfigService = instanceConfigService;
      this.circuitBreakerService = circuitBreakerService;
  }


  private selectInstance(): AiInstance | null {
    const instances = this.instanceConfigService.getInstances();

    // Filter available instances
    const availableInstances = instances.filter(
        instance => this.circuitBreakerService.isInstanceAvailable(instance.id)
    );

    if (availableInstances.length === 0) {
        return null;
    }

    // priority가 높을수록 선택확률이 높아지도록
    const instancesWithPriority = availableInstances.map(instance => ({            
        instance,
        priority: instance.weight * this.circuitBreakerService.getSuccessRate(instance.id)
    }));

    // 전체 가중치 구하기
    let totalPriority = 0;
    for (const entry of instancesWithPriority) {
        totalPriority += entry.priority;
    }

    // 모든 instance의 weight이 0일 경우, 누적값으로 선택될 수 없음 -> 균등한 확률부여
    if (totalPriority === 0) {
        const randomIndex = Math.floor(Math.random() * availableInstances.length);
        return availableInstances[randomIndex];
    }

    let randomValue = Math.random() * totalPriority;
    let accumulated = 0;
    for (const item of instancesWithPriority) {
        accumulated += item.priority;
        // 누적값이 randomValues를 넘는 최초의 항목 선택
        if (randomValue < accumulated) {
            return item.instance;
        } 
    }
    // Fallback (shouldn't reach here, but just in case)
    return instancesWithPriority[instancesWithPriority.length - 1].instance;
}

           
async makeRequest(requestBody: any, timeout?: number): Promise<any> {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // 1초
  const REQUEST_TIMEOUT = timeout || 30000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
     
      const selectedInstance = this.selectInstance();
      if (!selectedInstance){
          throw new Error('No available Instances');
      }

      // HALF_OPEN 상태인 경우, 잠금 획득 => 
      // 사실 이미 테스팅하고있는 애들은 select instance할 때 이미 걸러짐 이건 동시성 문제 체크용도
      let hasHalfOpenLock = false;
      const circuitState = this.circuitBreakerService.getCircuitState(selectedInstance.id);
      if (circuitState === 'HALF_OPEN') {
          hasHalfOpenLock = this.circuitBreakerService.acquireHalfOpenLock(selectedInstance.id);
          if (!hasHalfOpenLock) {
              continue;
          }
      }

      try {

          const url = `${selectedInstance.instanceEndpoint}openai/deployments/${selectedInstance.instanceDeployment}/chat/completions?api-version=${selectedInstance.instanceVersion}`;
          const headers = {
            'api-key': selectedInstance.instanceApiKey,
            'Content-Type': 'application/json'
          };

          const response = await axios.post(url, requestBody, {
              headers, 
              timeout: REQUEST_TIMEOUT
          })
          
          this.circuitBreakerService.recordSuccess(selectedInstance.id);
          return response.data;
          
      } catch (error) {
          if (axios.isAxiosError(error) && error.response) {
              const statusCode = error.response.status;

              //client errors not an instance failure, throw immediately
              if([400, 401, 404, 413, 422, 403].includes(statusCode)){
                  throw error; 
              }

              //Rate limit - exponential backoff
              if (statusCode === 429) {
                  this.circuitBreakerService.recordFailure(selectedInstance.id);
                  if (attempt < MAX_RETRIES) {
                      //If attempt is 1: 2^0, if 2: 2^1
                      const delay = BASE_DELAY * (2 ** (attempt - 1));
                      //timeout 만큼 기다렸다가 continue retry loop
                      await new Promise(resolve => setTimeout(resolve, delay));
                  }
                  continue;
              }

              if ([500, 502, 503].includes(statusCode)) {
                  this.circuitBreakerService.recordFailure(selectedInstance.id);
                  //continue retry loop
                  continue;
              }
          }
          //Timeout or other errors
          this.circuitBreakerService.recordFailure(selectedInstance.id);
      } finally {
          if (hasHalfOpenLock) {
              this.circuitBreakerService.releaseHalfOpenLock(selectedInstance.id);
          }
      }
  }

  throw new Error('All retries failed');
}
}