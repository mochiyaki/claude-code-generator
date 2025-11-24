import { imageAgent } from './image.agent'
import { IAgent } from './type';

export class AgentsManager {
    private agents: Map<string, IAgent> = new Map();

    /**
     * @param agent
     * @param isDefault
     */
    registerAgent(agent: IAgent): void {
        this.agents.set(agent.name, agent);
    }
    /**t
     * @param name
     * @returns
     */
    getAgent(name: string): IAgent | undefined {
        return this.agents.get(name);
    }

    /**
     * @returns
     */
    getAllAgents(): IAgent[] {
        return Array.from(this.agents.values());
    }


    /**
     * @returns
     */
    getAllTools(): any[] {
        const allTools: any[] = [];
        for (const agent of this.agents.values()) {
            allTools.push(...agent.tools.values());
        }
        return allTools;
    }
}

const agentsManager = new AgentsManager()
agentsManager.registerAgent(imageAgent)
export default agentsManager
