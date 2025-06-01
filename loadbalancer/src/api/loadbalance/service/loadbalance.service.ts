import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoadbalanceService {
  private readonly logger = new Logger(LoadbalanceService.name);
  static nodeNum: number = 1;

  async getNodeStatus(): Promise<string> {
    const endpoint = `res-node-${LoadbalanceService.nodeNum}:3000`;
    const response = await fetch(`http://${endpoint}`);
    if (!response.ok) {
      throw new Error(`Error fetching from ${endpoint}: ${response.statusText}`);
    }
    const data = await response.text();
    this.logger.verbose(`Fetched data from ${endpoint}: ${data}`);
    LoadbalanceService.nodeNum++;
    if (LoadbalanceService.nodeNum > 3) {
      LoadbalanceService.nodeNum = 1; // Reset node number after reaching 3
    }
    return data;
  }
}
