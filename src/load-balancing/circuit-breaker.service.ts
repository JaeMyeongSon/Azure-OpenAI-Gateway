import { Injectable } from "@nestjs/common";

interface CircuitBreakerState {
    instanceId: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    successCount: number;
    totalRequests: number;
    // optional
    openedAt?: number;
}

@Injectable()
export class CircuitBreakerService {
    private static readonly FAILURE_THRESHOLD = 5;
    private static readonly RECOVERY_TIMEOUT = 60000 // 60초

    private circuitStates: Map<number, CircuitBreakerState> = new Map();
    private halfOpenLocks: Set<number> = new Set();

    constructor() {}

    private getOrCreateCircuitState(instanceId: number): CircuitBreakerState {
        let state = this.circuitStates.get(instanceId);
        if(!state) {
            state = {
                instanceId,
                state: 'CLOSED',
                failureCount: 0,
                successCount: 0,
                totalRequests: 0,
            };
            this.circuitStates.set(instanceId, state);
        }

        if (state.state === 'OPEN' && state.openedAt) {
            const elapsed = Date.now() - state.openedAt;
            if (elapsed >= CircuitBreakerService.RECOVERY_TIMEOUT) {
                state.state = 'HALF_OPEN';
            }
        }

        return state;
    }

    recordSuccess(instanceId: number): void {
        const state  = this.getOrCreateCircuitState(instanceId);
        if (state.state === 'HALF_OPEN'){
            state.state = 'CLOSED';
        } 
        
        state.successCount++;
        state.totalRequests++;
        state.failureCount = 0;
    }

    recordFailure(instanceId: number): void {
        const state  = this.getOrCreateCircuitState(instanceId);
        if (state.state === 'HALF_OPEN'){
            state.state = 'OPEN'
            state.openedAt = Date.now();
        }

        state.failureCount++;
        state.totalRequests++;

        //check if we should change the circuit state
        if (state.failureCount >= CircuitBreakerService.FAILURE_THRESHOLD) {
            state.state = 'OPEN';
            state.openedAt = Date.now();
        }
    }

    getSuccessRate(instanceId: number): number {
        const state = this.circuitStates.get(instanceId);
        if (!state || state.totalRequests === 0){
            return 1.0; //circuit 기록 안된 경우 & 아직 요청이 없는 경우
        }
        //TODO: 최근 시간 가중치 고려해서 successCount reset하는 로직 추가 고려
        return state.successCount/state.totalRequests;
    }

    getCircuitState(instanceId: number): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
        const state = this.getOrCreateCircuitState(instanceId);
        return state.state;
    }

    isInstanceAvailable(instanceId: number): boolean {
        const circuitState = this.getCircuitState(instanceId);
        if (circuitState === 'CLOSED'){
            return true;
        }
        if (circuitState === 'HALF_OPEN') {
            if (this.halfOpenLocks.has(instanceId)) {
                return false;
            }
            return true;
        }

        //OPEN인 경우,
        return false;
    }

    acquireHalfOpenLock(instanceId: number): boolean {
        const state = this.getOrCreateCircuitState(instanceId);
        if (state.state === 'HALF_OPEN' && !this.halfOpenLocks.has(instanceId)) {
            this.halfOpenLocks.add(instanceId);
            return true;
        }
        return false;
    }

    releaseHalfOpenLock(instanceId: number): void {
        this.halfOpenLocks.delete(instanceId);
    }
}