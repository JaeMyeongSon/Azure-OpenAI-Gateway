import { Injectable } from "@nestjs/common";

export interface AiInstance {
    id: number;
    weight: number;
    instanceApiKey: string;
    instanceEndpoint: string;
    instanceDeployment: string;
    instanceVersion: string;
}

// 추후에 필요하면 validation 추가
@Injectable()
export class InstanceConfigService {
    private instances: AiInstance[] = [];
    
    constructor() {
        this.loadInstances();
    }


    // ENV: INSTANCE_1_KEY, INSTANCE_1_ENDPOINT, ..., INSTANCE_2_KEY, INSTANCE_2_ENDPOINT, ... 
    private loadInstances(): void {
        const envKeys = Object.keys(process.env);
        const instancePattern = /^INSTANCE_(\d+)_(.+)$/;

        // Map { 1, { ID: "abc123", VERSION: "v1" }}
        const instanceGroups: Map<number, Record<string, string>> = new Map();

        for (const key of envKeys) {
            const match = key.match(instancePattern);
            if (match) {
                const instanceId = parseInt(match[1]);
                const propertyName = match[2];

                if(!instanceGroups.has(instanceId)) {
                    instanceGroups.set(instanceId, {});
                }

                instanceGroups.get(instanceId)![propertyName] = process.env[key]!;
            }
        }

        //Ai instance로 변환 & instances에 넣기
        for (const [instanceId, properties] of instanceGroups) {
            try {
                const instance: AiInstance = {
                    id: instanceId,
                    weight: parseFloat(properties.WEIGHT),
                    instanceApiKey: properties.APIKEY,
                    instanceEndpoint: properties.ENDPOINT,
                    instanceDeployment: properties.DEPLOYMENT,
                    instanceVersion: properties.VERSION,
                };

                this.instances.push(instance);
            } catch (error) {
                console.error(`Failed to parse instance ${instanceId}:`, error);
            }
        }
        console.log(`Loaded ${this.instances.length} Ai instances`);        
    }

    getInstances(): AiInstance[] {
        return this.instances;
    }

    getInstanceCount(): number {
        return this.instances.length;
    }

}